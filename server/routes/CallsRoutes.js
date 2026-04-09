import { Router } from "express";
import { verifyToken } from "../middlewares/AuthMiddleware.js";
import { createLivekitToken, getIceConfig } from "../conrollers/CallsController.js";

const callsRoutes = Router();

callsRoutes.get("/ice-config", verifyToken, getIceConfig);
callsRoutes.post("/livekit-token", verifyToken, createLivekitToken);

export default callsRoutes;