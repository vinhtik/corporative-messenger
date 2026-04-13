import mongoose from "mongoose";

const MEDIA_MESSAGE_TYPES = ["file", "audio", "video-note"];

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
    required: true,
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
    required: false,
  },
  messageType: {
    type: String,
    enum: ["text", ...MEDIA_MESSAGE_TYPES],
    required: true,
  },
  content: {
    type: String,
    required: function () {
      return this.messageType === "text";
    },
  },
  fileUrl: {
    type: String,
    required: function () {
      return MEDIA_MESSAGE_TYPES.includes(this.messageType);
    },
  },
  mimeType: {
    type: String,
    required: function () {
      return MEDIA_MESSAGE_TYPES.includes(this.messageType);
    },
  },
  duration: {
    type: Number,
    required: false,
    min: 0,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const Message = mongoose.model("Messages", messageSchema);

export default Message;

