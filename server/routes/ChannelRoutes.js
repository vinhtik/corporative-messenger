import { Router } from "express";
import { verifyToken } from "../middlewares/AuthMiddleware.js"
import { createChannel, getUserChannels } from "../conrollers/ChannelController.js";

const channelRoutes = Router();

channelRoutes.post("/create-channel", verifyToken, createChannel);
channelRoutes.get("/get-user-channels", verifyToken, getUserChannels)

export default channelRoutes;