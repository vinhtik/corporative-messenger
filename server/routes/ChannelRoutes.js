import { Router } from "express";
import { verifyToken } from "../middlewares/AuthMiddleware.js"
import { createChannel, getChannelMessages, getUserChannels } from "../conrollers/ChannelController.js";

const channelRoutes = Router();

channelRoutes.post("/create-channel", verifyToken, createChannel);
channelRoutes.get("/get-user-channels", verifyToken, getUserChannels);
channelRoutes.get("/get-channel-messages/:channelId", verifyToken, getChannelMessages)

export default channelRoutes;