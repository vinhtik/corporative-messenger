import { Router } from "express";
import { verifyToken } from "../middlewares/AuthMiddleware.js";
import { getMessages, uploadFile, getMessageFile } from "../conrollers/MessagesController.js";
import multer from 'multer';

const messageRoutes = Router();
const upload = multer({ dest: "uploads/files" });

messageRoutes.post("/get-messages", verifyToken, getMessages);
messageRoutes.post("/upload-file" , verifyToken, upload.single("file"), uploadFile)
messageRoutes.get("/file/:messageId", verifyToken, getMessageFile)


export default messageRoutes;