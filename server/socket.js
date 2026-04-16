import { Server as SocketIOServer } from "socket.io";
import Message from "./models/MessagesModel.js";
import Channel from "./models/ChannelModel.js";
import User from "./models/UserModel.js"
import {
  getChannelMemberIds,
  isChannelMember,
} from "./utils/channelPermissions.js";
import admin from "./lib/firebase-admin.js";

const CALL_EVENTS = {
  JOIN_CALL_ROOM: "join-call-room",
  LEAVE_CALL_ROOM: "leave-call-room",
  INVITE_CHANNEL_TO_CALL: "invite-channel-to-call",
};

const getCallRoomName = (callId) => `call:${callId}`;
const isCallRoom = (roomName) => roomName.startsWith("call:");

let ioInstance = null;
const userSocketMap = new Map();
const activeCallInvites = new Map();

const getUserSocketId = (userId) => {
  if (!userId) return null;
  return userSocketMap.get(String(userId));
};

const allowedOrigins = [
  process.env.ORIGIN,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  "https://corp-messenger.ddns.net",
  "http://178.205.150.242",
  "https://178.205.150.242",
  "http://localhost",
  "https://localhost",
  "capacitor://localhost",
].filter(Boolean);


export const emitToUser = (userId, eventName, payload) => {
  if (!ioInstance) return;

  const socketId = getUserSocketId(userId);

  if (socketId) {
    ioInstance.to(socketId).emit(eventName, payload);
  }
};

export const emitToManyUsers = (userIds, eventName, payload, excludedUserIds = []) => {
  const excluded = new Set(excludedUserIds.map((id) => String(id)));

  userIds.forEach((userId) => {
    const normalizedUserId = String(userId);

    if (excluded.has(normalizedUserId)) {
      return;
    }

    emitToUser(normalizedUserId, eventName, payload);
  });
};

const disconnect = (socket) => {
  console.log(`Client disconnected: ${socket.id}`);

  for (const [userId, socketId] of userSocketMap.entries()) {
    if (socketId === socket.id) {
      userSocketMap.delete(userId);
      break;
    }
  }
};

const setupSocket = (server) => {
const io = new SocketIOServer(server, {
cors: {
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }

if (allowedOrigins.includes(origin)) {
  return callback(null, true);
}

return callback(new Error(`Socket.IO CORS blocked for origin: ${origin}`));
},
methods: ["GET", "POST"],
  credentials: true,
  },
  });

ioInstance = io;


  const sendMessage = async (message) => {
  const senderSocketId = getUserSocketId(message.sender);
  const recipientSocketId = getUserSocketId(message.recipient);

  const createdMessage = await Message.create(message);

  const messageData = await Message.findById(createdMessage._id)
    .populate("sender", "id email firstName lastName image color")
    .populate("recipient", "id email firstName lastName image color");

  const recipientUser = await User.findById(message.recipient).select("pushTokens");

  if (recipientUser?.pushTokens?.length) {
    const title =
      [messageData.sender?.firstName, messageData.sender?.lastName]
        .filter(Boolean)
        .join(" ")
        .trim() || messageData.sender?.email || "Новое сообщение";

    const body =
      message.messageType === "text"
        ? message.content || "Новое сообщение"
        : message.messageType === "audio"
        ? "Голосовое сообщение"
        : message.messageType === "video-note"
        ? "Видеосообщение"
        : "Файл";

    try {
      const pushResponse = await admin.messaging().sendEachForMulticast({
        tokens: recipientUser.pushTokens,
        notification: {
          title,
          body,
        },
        data: {
          type: "message",
          chatType: "contact",
          senderId: String(messageData.sender?._id || ""),
          recipientId: String(messageData.recipient?._id || ""),
        },
        android: {
          priority: "high",
          notification: {
            channelId: "messages",
          },
        },
      });

      if (pushResponse.failureCount > 0) {
        const invalidTokens = [];

        pushResponse.responses.forEach((resp, idx) => {
          if (!resp.success) {
            invalidTokens.push(recipientUser.pushTokens[idx]);
            console.log("FCM token send error:", resp.error);
          }
        });

        if (invalidTokens.length) {
          await User.findByIdAndUpdate(message.recipient, {
            $pull: { pushTokens: { $in: invalidTokens } },
          });
        }
      }
    } catch (error) {
      console.log("FCM send error", error);
    }
  }

  if (recipientSocketId) {
    io.to(recipientSocketId).emit("recieveMessage", messageData);
  }

  if (senderSocketId) {
    io.to(senderSocketId).emit("recieveMessage", messageData);
  }
};



  const sendChannelMessage = async (message) => {
  const { channelId, sender, content, messageType, fileUrl, mimeType, duration } =
    message;

  const channel = await Channel.findById(channelId);

  if (!channel) {
    return;
  }

  if (!isChannelMember(channel, sender)) {
    return;
  }

  const createdMessage = await Message.create({
    sender,
    recipient: null,
    content,
    messageType,
    timestamp: new Date(),
    fileUrl,
    mimeType,
    duration,
  });

  const messageData = await Message.findById(createdMessage._id)
    .populate("sender", "id email firstName lastName image color")
    .exec();

  const updatedChannel = await Channel.findByIdAndUpdate(
    channelId,
    {
      $push: { messages: createdMessage._id },
    },
    { new: true }
  );

  if (!updatedChannel) {
    return;
  }

  const finalData = { ...messageData._doc, channelId: updatedChannel._id };

  const memberIds = getChannelMemberIds(updatedChannel).filter(
    (userId) => String(userId) !== String(sender)
  );

  const usersToNotify = await User.find({
    _id: { $in: memberIds },
  }).select("_id pushTokens");

  const senderName =
    [messageData.sender?.firstName, messageData.sender?.lastName]
      .filter(Boolean)
      .join(" ")
      .trim() || messageData.sender?.email || "Новое сообщение";

  const body =
    messageType === "text"
      ? content || "Новое сообщение"
      : messageType === "audio"
      ? "Голосовое сообщение"
      : messageType === "video-note"
      ? "Видеосообщение"
      : "Файл";

  for (const user of usersToNotify) {
    if (!user?.pushTokens?.length) continue;

    try {
      const pushResponse = await admin.messaging().sendEachForMulticast({
        tokens: user.pushTokens,
        notification: {
          title: updatedChannel.name || senderName,
          body,
        },
        data: {
          type: "message",
          chatType: "channel",
          channelId: String(updatedChannel._id),
          senderId: String(messageData.sender?._id || ""),
        },
        android: {
          priority: "high",
          notification: {
            channelId: "messages",
          },
        },
      });

      if (pushResponse.failureCount > 0) {
        const invalidTokens = [];

        pushResponse.responses.forEach((resp, idx) => {
          if (!resp.success) {
            invalidTokens.push(user.pushTokens[idx]);
            console.log("FCM channel token send error:", resp.error);
          }
        });

        if (invalidTokens.length) {
          await User.findByIdAndUpdate(user._id, {
            $pull: { pushTokens: { $in: invalidTokens } },
          });
        }
      }
    } catch (error) {
      console.log("FCM channel send error", error);
    }
  }

  emitToManyUsers(
    getChannelMemberIds(updatedChannel),
    "recieve-channel-message",
    finalData
  );
};





  const getRoomParticipantSocketIds = (callId) => {
    const roomName = getCallRoomName(callId);
    return Array.from(io.sockets.adapter.rooms.get(roomName) || []);
  };

  const getRoomParticipantUserIds = (callId) => {
    return getRoomParticipantSocketIds(callId)
      .map((socketId) => io.sockets.sockets.get(socketId)?.data?.userId)
      .filter(Boolean)
      .map((userId) => String(userId));
  };

  const cleanupInviteIfUnused = (callId) => {
    const invite = activeCallInvites.get(callId);

    if (!invite) {
      return;
    }

    const roomUserIds = getRoomParticipantUserIds(callId);

    if (!roomUserIds.length && invite.invitedUserIds.size === 0) {
      activeCallInvites.delete(callId);
    }
  };

  const setActiveInvite = (callId, payload) => {
    activeCallInvites.set(callId, {
      ...payload,
      invitedUserIds: new Set((payload.invitedUserIds || []).map((id) => String(id))),
    });
  };

  const mergeInviteesIntoCall = (callId, userIds) => {
    const invite = activeCallInvites.get(callId);

    if (!invite) {
      return;
    }

    userIds.forEach((userId) => {
      invite.invitedUserIds.add(String(userId));
    });
  };

  const removeInviteeFromCall = (callId, userId) => {
    const invite = activeCallInvites.get(callId);

    if (!invite || !userId) {
      return invite || null;
    }

    invite.invitedUserIds.delete(String(userId));
    cleanupInviteIfUnused(callId);

    return activeCallInvites.get(callId) || null;
  };

  const leaveSpecificCallRoom = (socket, callId) => {
    if (!callId) {
      return;
    }

    const roomName = getCallRoomName(callId);

    if (socket.rooms.has(roomName)) {
      socket.leave(roomName);
    }

    if (socket.data.currentCallId === callId) {
      socket.data.currentCallId = null;
    }

    cleanupInviteIfUnused(callId);
  };

  const leaveAllCallRooms = (socket) => {
    Array.from(socket.rooms)
      .filter((roomName) => isCallRoom(roomName))
      .forEach((roomName) => {
        const callId = roomName.replace("call:", "");
        leaveSpecificCallRoom(socket, callId);
      });
  };

  const getChannelInviteTargets = async ({
    channelId,
    excludedUserIds = [],
    requesterUserId = null,
  }) => {
    const channel = await Channel.findById(channelId).populate(
      "members.user",
      "email firstName lastName image color"
    );

    if (!channel) {
      return null;
    }

    if (requesterUserId && !isChannelMember(channel, requesterUserId)) {
      return null;
    }

    const excluded = new Set(excludedUserIds.map((id) => String(id)));
    const recipients = new Map();

    channel.members.forEach((member) => {
      const user = member.user;

      if (!user?._id) {
        return;
      }

      const memberId = String(user._id);

      if (!excluded.has(memberId)) {
        recipients.set(memberId, user);
      }
    });

    return {
      channel,
      recipients,
    };
  };

  const callUser = async (payload) => {
    const { callId, mode, fromUser, targetUserId } = payload;

    if (!callId || !targetUserId) {
      return;
    }

    setActiveInvite(callId, {
      callId,
      chatType: "contact",
      initiatorUserId: String(fromUser?._id || ""),
      invitedUserIds: [String(targetUserId)],
      channelId: null,
      channel: null,
    });

    emitToUser(targetUserId, "incoming-call", {
      callId,
      mode,
      chatType: "contact",
      fromUser,
      createdAt: new Date().toISOString(),
    });
  };

  const callChannel = async (payload) => {
    const { callId, mode, fromUser, channelId } = payload;

    if (!callId || !channelId) {
      return;
    }

    const inviterId = String(fromUser?._id || "");
    const result = await getChannelInviteTargets({
      channelId,
      excludedUserIds: [inviterId],
      requesterUserId: inviterId,
    });

    if (!result) {
      return;
    }

    const { channel, recipients } = result;

    setActiveInvite(callId, {
      callId,
      chatType: "channel",
      initiatorUserId: inviterId,
      invitedUserIds: Array.from(recipients.keys()),
      channelId: channel._id.toString(),
      channel: {
        _id: channel._id.toString(),
        name: channel.name,
      },
    });

    recipients.forEach((_, recipientId) => {
      emitToUser(recipientId, "incoming-call", {
        callId,
        mode,
        chatType: "channel",
        fromUser,
        channelId: channel._id.toString(),
        channel: {
          _id: channel._id.toString(),
          name: channel.name,
        },
        createdAt: new Date().toISOString(),
      });
    });
  };

  const inviteChannelToCall = async (payload) => {
    const { callId, mode, fromUser, channelId } = payload;

    if (!callId || !channelId) {
      return;
    }

    const inviterId = String(fromUser?._id || "");
    const roomUserIds = getRoomParticipantUserIds(callId);
    const invite = activeCallInvites.get(callId);

    const excludedUserIds = new Set([inviterId, ...roomUserIds]);

    if (invite) {
      invite.invitedUserIds.forEach((userId) => excludedUserIds.add(String(userId)));
    }

    const result = await getChannelInviteTargets({
      channelId,
      excludedUserIds: Array.from(excludedUserIds),
      requesterUserId: inviterId,
    });

    if (!result) {
      return;
    }

    const { channel, recipients } = result;

    if (!recipients.size) {
      emitToUser(inviterId, "call-ended", {
        callId,
        fromUserId: inviterId,
        reason: "no-users-to-invite",
      });
      return;
    }

    mergeInviteesIntoCall(callId, Array.from(recipients.keys()));

    recipients.forEach((_, recipientId) => {
      emitToUser(recipientId, "incoming-call", {
        callId,
        mode,
        chatType: "channel",
        fromUser,
        channelId: channel._id.toString(),
        channel: {
          _id: channel._id.toString(),
          name: channel.name,
        },
        createdAt: new Date().toISOString(),
      });
    });
  };

  const acceptCall = async (payload) => {
    const { callId, mode, chatType, toUserId, fromUser, channelId, channel } = payload;

    if (!callId || !toUserId) {
      return;
    }

    removeInviteeFromCall(callId, fromUser?._id);

    emitToUser(toUserId, "call-accepted", {
      callId,
      mode,
      chatType,
      fromUser,
      channelId: channelId || null,
      channel: channel || null,
    });
  };

  const rejectCall = async (payload) => {
    const { callId, mode, chatType, toUserId, fromUser, channelId, channel } = payload;

    if (!callId || !toUserId) {
      return;
    }

    const updatedInvite = removeInviteeFromCall(callId, fromUser?._id);

    emitToUser(toUserId, "call-rejected", {
      callId,
      mode,
      chatType,
      fromUser,
      channelId: channelId || null,
      channel: channel || null,
    });

    if (chatType === "contact") {
      emitToUser(toUserId, "call-ended", {
        callId,
        fromUserId: fromUser?._id || null,
        reason: "rejected",
      });

      activeCallInvites.delete(callId);
      return;
    }

    const roomParticipants = getRoomParticipantUserIds(callId).filter(
      (userId) => String(userId) !== String(toUserId)
    );

    if ((!updatedInvite || updatedInvite.invitedUserIds.size === 0) && roomParticipants.length === 0) {
      emitToUser(toUserId, "call-ended", {
        callId,
        fromUserId: fromUser?._id || null,
        reason: "empty",
      });

      activeCallInvites.delete(callId);
    }
  };

  const joinCallRoom = (socket, payload) => {
    const { callId } = payload || {};

    if (!callId) {
      return;
    }

    const roomName = getCallRoomName(callId);

    if (!socket.rooms.has(roomName)) {
      socket.join(roomName);
    }

    socket.data.currentCallId = callId;
  };

  const leaveCallRoom = (socket, payload) => {
    const { callId } = payload || {};

    if (callId) {
      leaveSpecificCallRoom(socket, callId);
      return;
    }

    leaveAllCallRooms(socket);
  };

  const endCall = (socket, payload) => {
    const { callId, toUserId } = payload || {};

    if (!callId) {
      return;
    }

    const endedByUserId = socket.data.userId ? String(socket.data.userId) : null;
    const roomUserIds = getRoomParticipantUserIds(callId);
    const invite = activeCallInvites.get(callId);

    const recipients = new Set();

    roomUserIds.forEach((userId) => {
      if (userId && userId !== endedByUserId) {
        recipients.add(userId);
      }
    });

    if (invite) {
      invite.invitedUserIds.forEach((userId) => {
        if (userId && userId !== endedByUserId) {
          recipients.add(userId);
        }
      });
    }

    if (toUserId && String(toUserId) !== endedByUserId) {
      recipients.add(String(toUserId));
    }

    emitToManyUsers(recipients, "call-ended", {
      callId,
      fromUserId: endedByUserId,
      reason: "ended",
    });

    activeCallInvites.delete(callId);
    leaveSpecificCallRoom(socket, callId);
  };

  io.on("connection", (socket) => {
    const userId = socket.handshake.query.userId;

    socket.data.userId = userId ? String(userId) : null;
    socket.data.currentCallId = null;

    if (userId) {
      userSocketMap.set(String(userId), socket.id);
      console.log(`User connected: ${userId} with socket ID: ${socket.id}`);
    } else {
      console.log("User ID not provided during connection");
    }

    socket.on("sendMessage", sendMessage);
    socket.on("send-channel-message", sendChannelMessage);

    socket.on("call-user", callUser);
    socket.on("call-channel", callChannel);
    socket.on(CALL_EVENTS.INVITE_CHANNEL_TO_CALL, inviteChannelToCall);
    socket.on("accept-call", acceptCall);
    socket.on("reject-call", rejectCall);
    socket.on("end-call", (payload) => endCall(socket, payload));

    socket.on(CALL_EVENTS.JOIN_CALL_ROOM, (payload) => joinCallRoom(socket, payload));
    socket.on(CALL_EVENTS.LEAVE_CALL_ROOM, (payload) => leaveCallRoom(socket, payload));

    socket.on("disconnecting", () => {
      leaveAllCallRooms(socket);
    });

    socket.on("disconnect", () => disconnect(socket));
  });
};

export default setupSocket;