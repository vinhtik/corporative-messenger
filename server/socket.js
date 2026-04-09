import { Server as SocketIOServer } from "socket.io";
import Message from "./models/MessagesModel.js";
import Channel from "./models/ChannelModel.js";

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

  const acceptCall = async (payload) => {
    const { callId, mode, chatType, toUserId, fromUser } = payload;

    emitToUser(toUserId, "call-accepted", {
      callId,
      mode,
      chatType,
      fromUser,
    });
  };

  const rejectCall = async (payload) => {
    const { callId, mode, chatType, toUserId, fromUser } = payload;

    emitToUser(toUserId, "call-rejected", {
      callId,
      mode,
      chatType,
      fromUser,
    });
  };

  const endCall = async (payload) => {
    const { callId, toUserId, fromUserId } = payload;

    emitToUser(toUserId, "call-ended", {
      callId,
      fromUserId,
    });
  };

  const forwardOffer = async (payload) => {
    const { callId, toUserId, fromUserId, description } = payload;

    emitToUser(toUserId, "webrtc-offer", {
      callId,
      fromUserId,
      description,
    });
  };

  const forwardAnswer = async (payload) => {
    const { callId, toUserId, fromUserId, description } = payload;

    emitToUser(toUserId, "webrtc-answer", {
      callId,
      fromUserId,
      description,
    });
  };

  const forwardIceCandidate = async (payload) => {
    const { callId, toUserId, fromUserId, candidate } = payload;

    emitToUser(toUserId, "webrtc-ice-candidate", {
      callId,
      fromUserId,
      candidate,
    });
  };

  const forwardReady = async (payload) => {
    const { callId, toUserId, fromUserId } = payload;

    emitToUser(toUserId, "webrtc-ready", {
      callId,
      fromUserId,
    });
  };

  io.on("connection", (socket) => {
    const userId = socket.handshake.query.userId;

    if (userId) {
      userSocketMap.set(String(userId), socket.id);
      console.log(`User connected: ${userId} with socket ID: ${socket.id}`);
    } else {
      console.log("User ID not provided during connection");
    }

    socket.on("sendMessage", sendMessage);
    socket.on("send-channel-message", sendChannelMessage);

    socket.on("call-user", callUser);
    socket.on("accept-call", acceptCall);
    socket.on("reject-call", rejectCall);
    socket.on("end-call", endCall);

    socket.on("webrtc-ready", forwardReady);
    socket.on("webrtc-offer", forwardOffer);
    socket.on("webrtc-answer", forwardAnswer);
    socket.on("webrtc-ice-candidate", forwardIceCandidate);

    socket.on("disconnect", () => disconnect(socket));
  });
};

export default setupSocket;