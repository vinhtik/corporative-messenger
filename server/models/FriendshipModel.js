import mongoose from "mongoose";

const FRIENDSHIP_STATUS = {
  PENDING: "pending",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
};

const friendshipSchema = new mongoose.Schema(
  {
    requester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
    pairKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(FRIENDSHIP_STATUS),
      default: FRIENDSHIP_STATUS.PENDING,
      required: true,
    },
    respondedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

friendshipSchema.index({ requester: 1, recipient: 1 });
friendshipSchema.index({ recipient: 1, status: 1 });
friendshipSchema.index({ requester: 1, status: 1 });

const Friendship = mongoose.model("Friendships", friendshipSchema);

export { FRIENDSHIP_STATUS };
export default Friendship;
