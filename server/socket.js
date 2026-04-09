import { Server as SocketIOServer } from "socket.io";
import Message from "./models/MessagesModel.js";
import Channel from "./models/ChannelModel.js";

const CALL_EVENTS = {
  JOIN_CALL_ROOM: "join-call-room",
  LEAVE_CALL_ROOM: "leave-call-room",
  ADD_PEER: "add-peer",
  REMOVE_PEER: "remove-peer",
  RELAY_SDP: "relay-sdp",
  RELAY_ICE: "relay-ice",
  SESSION_DESCRIPTION: "session-description",
  ICE_CANDIDATE: "ice-candidate",
};

const getCallRoomName = (callId) => `call:${callId}`;
const isCallRoom = (roomName) => roomName.startsWith("call:");

const setupSocket = (server) => {
  const io = new SocketIOServer(server, {
    cors: {
      origin: process.env.ORIGIN,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  const userSocketMap = new Map();

  const getUserSocketId = (userId) => {
    return userSocketMap.get(String(userId));
  };

  const emitToUser = (userId, eventName, payload) => {
    const socketId = getUserSocketId(userId);

    if (socketId) {
      io.to(socketId).emit(eventName, payload);
    }
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

  const sendMessage = async (message) => {
    const senderSocketId = getUserSocketId(message.sender);
    const recipientSocketId = getUserSocketId(message.recipient);

    const createdMessage = await Message.create(message);

    const messageData = await Message.findById(createdMessage._id)
      .populate("sender", "id email firstName lastName image color")
      .populate("recipient", "id email firstName lastName image color");

    if (recipientSocketId) {
      io.to(recipientSocketId).emit("recieveMessage", messageData);
    }

    if (senderSocketId) {
      io.to(senderSocketId).emit("recieveMessage", messageData);
    }
  };

  const sendChannelMessage = async (message) => {
    const { channelId, sender, content, messageType, fileUrl } = message;

    const createdMessage = await Message.create({
      sender,
      recipient: null,
      content,
      messageType,
      timestamp: new Date(),
      fileUrl,
    });

    const messageData = await Message.findById(createdMessage._id)
      .populate("sender", "id email firstName lastName image color")
      .exec();

    await Channel.findByIdAndUpdate(channelId, {
      $push: { messages: createdMessage._id },
    });

    const channel = await Channel.findById(channelId)
      .populate("members")
      .populate("admin");

    const finalData = { ...messageData._doc, channelId: channel._id };

    if (channel && channel.members) {
      channel.members.forEach((member) => {
        const memberSocketId = getUserSocketId(member._id.toString());

        if (memberSocketId) {
          io.to(memberSocketId).emit("recieve-channel-message", finalData);
        }
      });

      if (channel.admin?._id) {
        const adminSocketId = getUserSocketId(channel.admin._id.toString());

        if (adminSocketId) {
          io.to(adminSocketId).emit("recieve-channel-message", finalData);
        }
      }
    }
  };

  const leaveSpecificCallRoom = (socket, callId) => {
    if (!callId) {
      return;
    }

    const roomName = getCallRoomName(callId);

    if (!socket.rooms.has(roomName)) {
      return;
    }

    const otherClients = Array.from(io.sockets.adapter.rooms.get(roomName) || []).filter(
      (clientID) => clientID !== socket.id
    );

    otherClients.forEach((clientID) => {
      io.to(clientID).emit(CALL_EVENTS.REMOVE_PEER, {
        peerID: socket.id,
        peerUser: socket.data.callUser || null,
      });
    });

    socket.leave(roomName);
  };

  const leaveAllCallRooms = (socket) => {
    Array.from(socket.rooms)
      .filter((roomName) => isCallRoom(roomName))
      .forEach((roomName) => {
        const callId = roomName.replace("call:", "");
        leaveSpecificCallRoom(socket, callId);
      });
  };

  const callUser = async (payload) => {
    const { callId, mode, fromUser, targetUserId } = payload;

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

    const channel = await Channel.findById(channelId)
      .populate("members", "email firstName lastName image color")
      .populate("admin", "email firstName lastName image color");

    if (!channel) {
      return;
    }

    const recipients = new Map();
    const inviterId = String(fromUser?._id);

    channel.members.forEach((member) => {
      const memberId = String(member._id);

      if (memberId !== inviterId) {
        recipients.set(memberId, member);
      }
    });

    if (channel.admin?._id) {
      const adminId = String(channel.admin._id);

      if (adminId !== inviterId) {
        recipients.set(adminId, channel.admin);
      }
    }

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

    emitToUser(toUserId, "call-rejected", {
      callId,
      mode,
      chatType,
      fromUser,
      channelId: channelId || null,
      channel: channel || null,
    });

    emitToUser(toUserId, "call-ended", {
      callId,
      fromUserId: fromUser?._id || null,
      reason: "rejected",
    });
  };

  const joinCallRoom = (socket, payload) => {
    const { callId, user } = payload || {};

    if (!callId) {
      return;
    }

    const roomName = getCallRoomName(callId);

    if (socket.rooms.has(roomName)) {
      return;
    }

    socket.data.callUser = user || null;

    const existingClients = Array.from(io.sockets.adapter.rooms.get(roomName) || []);
    socket.join(roomName);

    existingClients.forEach((clientID) => {
      const peerSocket = io.sockets.sockets.get(clientID);

      io.to(clientID).emit(CALL_EVENTS.ADD_PEER, {
        peerID: socket.id,
        createOffer: false,
        peerUser: socket.data.callUser || null,
      });

      socket.emit(CALL_EVENTS.ADD_PEER, {
        peerID: clientID,
        createOffer: true,
        peerUser: peerSocket?.data?.callUser || null,
      });
    });
  };

  const leaveCallRoom = (socket, payload) => {
    const { callId } = payload || {};

    if (callId) {
      leaveSpecificCallRoom(socket, callId);
      return;
    }

    leaveAllCallRooms(socket);
  };

  const relaySessionDescription = (socket, payload) => {
    const { callId, peerID, sessionDescription } = payload || {};

    if (!peerID || !sessionDescription) {
      return;
    }

    io.to(peerID).emit(CALL_EVENTS.SESSION_DESCRIPTION, {
      callId,
      peerID: socket.id,
      sessionDescription,
      peerUser: socket.data.callUser || null,
    });
  };

  const relayIceCandidate = (socket, payload) => {
    const { callId, peerID, iceCandidate } = payload || {};

    if (!peerID || !iceCandidate) {
      return;
    }

    io.to(peerID).emit(CALL_EVENTS.ICE_CANDIDATE, {
      callId,
      peerID: socket.id,
      iceCandidate,
      peerUser: socket.data.callUser || null,
    });
  };

  const endCall = (socket, payload) => {
    const { callId, toUserId } = payload || {};

    if (!callId) {
      return;
    }

    const roomName = getCallRoomName(callId);
    const connectedPeers = Array.from(io.sockets.adapter.rooms.get(roomName) || []).filter(
      (clientID) => clientID !== socket.id
    );

    if (connectedPeers.length) {
      socket.to(roomName).emit("call-ended", {
        callId,
        fromUserId: socket.data.userId || null,
      });
    } else if (toUserId) {
      emitToUser(toUserId, "call-ended", {
        callId,
        fromUserId: socket.data.userId || null,
      });
    }

    leaveSpecificCallRoom(socket, callId);
  };

  io.on("connection", (socket) => {
    const userId = socket.handshake.query.userId;

    socket.data.userId = userId ? String(userId) : null;
    socket.data.callUser = null;

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
    socket.on("accept-call", acceptCall);
    socket.on("reject-call", rejectCall);
    socket.on("end-call", (payload) => endCall(socket, payload));

    socket.on(CALL_EVENTS.JOIN_CALL_ROOM, (payload) => joinCallRoom(socket, payload));
    socket.on(CALL_EVENTS.LEAVE_CALL_ROOM, (payload) => leaveCallRoom(socket, payload));
    socket.on(CALL_EVENTS.RELAY_SDP, (payload) => relaySessionDescription(socket, payload));
    socket.on(CALL_EVENTS.RELAY_ICE, (payload) => relayIceCandidate(socket, payload));

    socket.on("disconnecting", () => {
      leaveAllCallRooms(socket);
    });

    socket.on("disconnect", () => disconnect(socket));
  });
};

export default setupSocket;