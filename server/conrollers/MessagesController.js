import Message from "../models/MessagesModel.js";
import Channel from "../models/ChannelModel.js";
import { mkdirSync, renameSync, existsSync } from "fs";
import { resolve } from "path";
import crypto from "crypto";

const MIME_EXTENSION_MAP = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/bmp": "bmp",
  "image/tiff": "tiff",
  "image/heic": "heic",
  "image/heif": "heif",

  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
  "audio/wav": "wav",
  "audio/x-wav": "wav",

  "video/webm": "webm",
  "video/mp4": "mp4",
  "video/quicktime": "mov",

  "application/pdf": "pdf",
  "text/plain": "txt",
  "application/zip": "zip",
  "application/rar": "rar",
  "application/x-zip-compressed": "zip",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.ms-powerpoint": "ppt",
};

const MEDIA_MESSAGE_TYPES = ["file", "audio", "video-note"];

const normalizeMimeType = (mimeType = "") => {
  return mimeType.split(";")[0].trim().toLowerCase();
};

const getExtensionFromMimeType = (mimeType) => {
  return MIME_EXTENSION_MAP[normalizeMimeType(mimeType)] || "bin";
};

const buildDownloadName = (message) => {
  const ext = getExtensionFromMimeType(message.mimeType);

  let baseName = "file";

  if (message.messageType === "audio") {
    baseName = "voice";
  } else if (message.messageType === "video-note") {
    baseName = "video-note";
  }

  return `${baseName}-${message._id}.${ext}`;
};

const hasDmAccess = (message, userId) => {
  return (
    String(message.sender) === String(userId) ||
    String(message.recipient) === String(userId)
  );
};

const hasChannelAccess = async (messageId, userId) => {
  const channel = await Channel.findOne({
    messages: messageId,
    "members.user": userId,
  }).select("_id");

  return Boolean(channel);
};

export const getMessages = async (request, response) => {
  try {
    const user1 = request.userId;
    const user2 = request.body.id;

    if (!user1 || !user2) {
      return response.status(400).send("Both user ID's are required");
    }

    const messages = await Message.find({
      $or: [
        { sender: user1, recipient: user2 },
        { sender: user2, recipient: user1 },
      ],
    }).sort({ timestamp: 1 });

    return response.status(200).json({ messages });
  } catch (err) {
    console.log({ err });
    return response.status(500).send("Internal Server Error");
  }
};

export const uploadFile = async (request, response) => {
  try {
    if (!request.file) {
      return response.status(400).send("File is reqired");
    }

    const mimeType = normalizeMimeType(
      request.file.mimetype || "application/octet-stream"
    );
    const ext = getExtensionFromMimeType(mimeType);
    const randomName = `${crypto.randomUUID()}.${ext}`;
    const fileDir = "uploads/files";
    const filePath = `${fileDir}/${randomName}`;

    mkdirSync(fileDir, { recursive: true });
    renameSync(request.file.path, filePath);

    return response.status(200).json({
      filePath,
      mimeType,
    });
  } catch (err) {
    console.log({ err });
    return response.status(500).send("Internal Server Error");
  }
};

export const getMessageFile = async (request, response) => {
  try {
    const { messageId } = request.params;
    const userId = request.userId;
    const forceDownload = String(request.query.download || "") === "1";

    const message = await Message.findById(messageId);

    if (!message) {
      return response.status(404).send("Message not found");
    }

    if (!MEDIA_MESSAGE_TYPES.includes(message.messageType) || !message.fileUrl) {
      return response.status(400).send("This message does not contain a file");
    }

    let hasAccess = false;

    if (message.recipient) {
      hasAccess = hasDmAccess(message, userId);
    } else {
      hasAccess = await hasChannelAccess(message._id, userId);
    }

    if (!hasAccess) {
      return response.status(403).send("Access denied");
    }

    const absolutePath = resolve(message.fileUrl);

    if (!existsSync(absolutePath)) {
      return response.status(404).send("File not found");
    }

    response.setHeader(
      "Content-Type",
      message.mimeType || "application/octet-stream"
    );
    response.setHeader(
      "Content-Disposition",
      `${forceDownload ? "attachment" : "inline"}; filename="${buildDownloadName(
        message
      )}"`
    );

    return response.sendFile(absolutePath);
  } catch (err) {
    console.log({ err });
    return response.status(500).send("Internal Server Error");
  }
};

