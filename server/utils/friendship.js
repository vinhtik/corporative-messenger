import mongoose from "mongoose";
import Friendship, { FRIENDSHIP_STATUS } from "../models/FriendshipModel.js";

export const normalizeUserId = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value._id) return String(value._id);
  return String(value);
};

export const buildPairKey = (firstId, secondId) => {
  return [normalizeUserId(firstId), normalizeUserId(secondId)].sort().join(":");
};

export const getAcceptedFriendIds = async (userId) => {
  const normalizedUserId = normalizeUserId(userId);

  const friendships = await Friendship.find({
    status: FRIENDSHIP_STATUS.ACCEPTED,
    $or: [{ requester: userId }, { recipient: userId }],
  });

  return friendships.map((friendship) => {
    const requesterId = normalizeUserId(friendship.requester);
    const recipientId = normalizeUserId(friendship.recipient);
    return requesterId === normalizedUserId ? recipientId : requesterId;
  });
};

export const areAllUsersFriendsWithUser = async (userId, targetIds = []) => {
  const acceptedFriendIds = await getAcceptedFriendIds(userId);
  const acceptedSet = new Set(acceptedFriendIds.map(String));
  return targetIds.every((id) => acceptedSet.has(String(id)));
};

export const toObjectId = (id) => new mongoose.Types.ObjectId(id);
export { FRIENDSHIP_STATUS };
