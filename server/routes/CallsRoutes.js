import { Router } from "express";
import { verifyToken } from "../middlewares/AuthMiddleware.js";
import { getIceConfig } from "../conrollers/CallsController.js";

const callsRoutes = Router();

callsRoutes.get("/ice-config", verifyToken, getIceConfig);

export default callsRoutes;