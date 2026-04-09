import { Router } from "express";
import { verifyToken } from "../middlewares/AuthMiddleware.js";
import {
  addChannelMembers,
  createChannel,
  deleteChannel,
  getChannel,
  getChannelMessages,
  getUserChannels,
  removeChannelMember,
  updateChannel,
  updateChannelMemberRole,
} from "../conrollers/ChannelController.js";

const channelRoutes = Router();

channelRoutes.post("/create-channel", verifyToken, createChannel);
channelRoutes.get("/get-user-channels", verifyToken, getUserChannels);
channelRoutes.get("/get-channel/:channelId", verifyToken, getChannel);
channelRoutes.get("/get-channel-messages/:channelId", verifyToken, getChannelMessages);

channelRoutes.patch("/update-channel/:channelId", verifyToken, updateChannel);
channelRoutes.post("/add-members/:channelId", verifyToken, addChannelMembers);
channelRoutes.delete("/members/:channelId/:memberId", verifyToken, removeChannelMember);
channelRoutes.patch("/members/:channelId/:memberId/role", verifyToken, updateChannelMemberRole);
channelRoutes.delete("/delete-channel/:channelId", verifyToken, deleteChannel);

export default channelRoutes;