import mongoose from "mongoose";
import { CHANNEL_ROLES } from "../utils/channelPermissions.js";

const channelMemberSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
    role: {
      type: String,
      enum: Object.values(CHANNEL_ROLES),
      default: CHANNEL_ROLES.MEMBER,
      required: true,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      default: null,
    },
  },
  { _id: false }
);

const channelSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    members: {
      type: [channelMemberSchema],
      default: [],
    },
    messages: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Messages",
        required: false,
      },
    ],
  },
  {
    timestamps: true,
  }
);

channelSchema.index({ "members.user": 1 });

const Channel = mongoose.model("Channels", channelSchema);
export default Channel;