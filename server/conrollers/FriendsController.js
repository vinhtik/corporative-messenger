import User from "../models/UserModel.js";
import Friendship, { FRIENDSHIP_STATUS } from "../models/FriendshipModel.js";
import {
  buildPairKey,
  getAcceptedFriendIds,
  normalizeUserId,
} from "../utils/friendship.js";

const USER_SELECT_FIELDS = "email firstName lastName image color";

const buildUserLabel = (user) => {
  if (!user) return "";
  return user.firstName
    ? `${user.firstName} ${user.lastName || ""}`.trim()
    : user.email;
};

const formatUser = (user) => {
  if (!user) return null;

  return {
    _id: user._id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    image: user.image,
    color: user.color,
  };
};

const formatFriendRequest = (friendship, sideKey) => {
  return {
    _id: friendship._id,
    status: friendship.status,
    createdAt: friendship.createdAt,
    respondedAt: friendship.respondedAt,
    [sideKey]: formatUser(friendship[sideKey]),
  };
};

const sanitizeSearchTerm = (value = "") => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

export const searchUsersForFriendship = async (request, response) => {
  try {
    const { searchTerm } = request.body;
    const currentUserId = normalizeUserId(request.userId);

    if (searchTerm === undefined || searchTerm === null) {
      return response.status(400).send("searchTerm is required");
    }

    const trimmedSearchTerm = String(searchTerm).trim();

    if (!trimmedSearchTerm.length) {
      return response.status(200).json({ users: [] });
    }

    const regex = new RegExp(sanitizeSearchTerm(trimmedSearchTerm), "i");

    const users = await User.find({
      $and: [
        { _id: { $ne: request.userId } },
        {
          $or: [{ firstName: regex }, { lastName: regex }, { email: regex }],
        },
      ],
    })
      .select(USER_SELECT_FIELDS)
      .limit(20);

    if (!users.length) {
      return response.status(200).json({ users: [] });
    }

    const userIds = users.map((user) => user._id);

    const friendships = await Friendship.find({
      $or: [
        { requester: request.userId, recipient: { $in: userIds } },
        { recipient: request.userId, requester: { $in: userIds } },
      ],
    });

    const friendshipMap = new Map(
      friendships.map((friendship) => [
        friendship.pairKey ||
          buildPairKey(friendship.requester, friendship.recipient),
        friendship,
      ])
    );

    const formattedUsers = users.map((user) => {
      const friendship = friendshipMap.get(buildPairKey(currentUserId, user._id));

      let friendshipStatus = "none";
      let friendshipDirection = null;
      let friendshipRequestId = null;

      if (friendship) {
        friendshipRequestId = friendship._id;

        if (friendship.status === FRIENDSHIP_STATUS.ACCEPTED) {
          friendshipStatus = "friend";
        } else if (friendship.status === FRIENDSHIP_STATUS.PENDING) {
          if (normalizeUserId(friendship.requester) === currentUserId) {
            friendshipStatus = "outgoing_request";
            friendshipDirection = "outgoing";
          } else {
            friendshipStatus = "incoming_request";
            friendshipDirection = "incoming";
          }
        }
      }

      return {
        ...formatUser(user),
        friendshipStatus,
        friendshipDirection,
        friendshipRequestId,
      };
    });

    return response.status(200).json({ users: formattedUsers });
  } catch (err) {
    console.log({ err });
    return response.status(500).send("Internal Server Error");
  }
};

export const sendFriendRequest = async (request, response) => {
  try {
    const currentUserId = normalizeUserId(request.userId);
    const targetUserId = normalizeUserId(request.params.userId);

    if (!targetUserId) {
      return response.status(400).send("Target userId is required");
    }

    if (currentUserId === targetUserId) {
      return response.status(400).send("You cannot add yourself");
    }

    const targetUser = await User.findById(targetUserId).select(USER_SELECT_FIELDS);

    if (!targetUser) {
      return response.status(404).send("User not found");
    }

    const pairKey = buildPairKey(currentUserId, targetUserId);
    const existingFriendship = await Friendship.findOne({ pairKey });

    if (existingFriendship) {
      if (existingFriendship.status === FRIENDSHIP_STATUS.ACCEPTED) {
        return response.status(400).send("User is already in your friends list");
      }

      if (existingFriendship.status === FRIENDSHIP_STATUS.PENDING) {
        if (normalizeUserId(existingFriendship.requester) === currentUserId) {
          return response.status(400).send("Friend request already sent");
        }

        return response
          .status(400)
          .send("This user has already sent you a friend request");
      }

      existingFriendship.requester = currentUserId;
      existingFriendship.recipient = targetUserId;
      existingFriendship.status = FRIENDSHIP_STATUS.PENDING;
      existingFriendship.respondedAt = null;

      await existingFriendship.save();

      return response.status(200).json({
        message: "Friend request sent",
        requestId: existingFriendship._id,
        friendshipStatus: "outgoing_request",
        user: formatUser(targetUser),
      });
    }

    const friendship = await Friendship.create({
      requester: currentUserId,
      recipient: targetUserId,
      pairKey,
      status: FRIENDSHIP_STATUS.PENDING,
    });

    return response.status(201).json({
      message: "Friend request sent",
      requestId: friendship._id,
      friendshipStatus: "outgoing_request",
      user: formatUser(targetUser),
    });
  } catch (err) {
    console.log({ err });
    return response.status(500).send("Internal Server Error");
  }
};

export const getIncomingFriendRequests = async (request, response) => {
  try {
    const requests = await Friendship.find({
      recipient: request.userId,
      status: FRIENDSHIP_STATUS.PENDING,
    })
      .populate("requester", USER_SELECT_FIELDS)
      .sort({ createdAt: -1 });

    return response.status(200).json({
      requests: requests.map((friendship) =>
        formatFriendRequest(friendship, "requester")
      ),
    });
  } catch (err) {
    console.log({ err });
    return response.status(500).send("Internal Server Error");
  }
};

export const cancelOutgoingFriendRequest = async (request, response) => {
  try {
    const { requestId } = request.params;
    const currentUserId = normalizeUserId(request.userId);

    const friendship = await Friendship.findById(requestId);

    if (!friendship) {
      return response.status(404).send("Friend request not found");
    }

    if (normalizeUserId(friendship.requester) !== currentUserId) {
      return response.status(403).send("You cannot cancel this request");
    }

    if (friendship.status !== FRIENDSHIP_STATUS.PENDING) {
      return response.status(400).send("Friend request is no longer pending");
    }

    await Friendship.deleteOne({ _id: friendship._id });

    return response.status(200).json({
      success: true,
      requestId,
    });
  } catch (err) {
    console.log({ err });
    return response.status(500).send("Internal Server Error");
  }
};


export const getOutgoingFriendRequests = async (request, response) => {
  try {
    const requests = await Friendship.find({
      requester: request.userId,
      status: FRIENDSHIP_STATUS.PENDING,
    })
      .populate("recipient", USER_SELECT_FIELDS)
      .sort({ createdAt: -1 });

    return response.status(200).json({
      requests: requests.map((friendship) =>
        formatFriendRequest(friendship, "recipient")
      ),
    });
  } catch (err) {
    console.log({ err });
    return response.status(500).send("Internal Server Error");
  }
};

export const acceptFriendRequest = async (request, response) => {
  try {
    const { requestId } = request.params;
    const currentUserId = normalizeUserId(request.userId);

    const friendship = await Friendship.findById(requestId);

    if (!friendship) {
      return response.status(404).send("Friend request not found");
    }

    if (normalizeUserId(friendship.recipient) !== currentUserId) {
      return response.status(403).send("You cannot accept this request");
    }

    if (friendship.status !== FRIENDSHIP_STATUS.PENDING) {
      return response.status(400).send("Friend request is no longer pending");
    }

    friendship.status = FRIENDSHIP_STATUS.ACCEPTED;
    friendship.respondedAt = new Date();

    await friendship.save();

    const friend = await User.findById(friendship.requester).select(
      USER_SELECT_FIELDS
    );

    return response.status(200).json({
      success: true,
      requestId: friendship._id,
      friend: formatUser(friend),
    });
  } catch (err) {
    console.log({ err });
    return response.status(500).send("Internal Server Error");
  }
};

export const rejectFriendRequest = async (request, response) => {
  try {
    const { requestId } = request.params;
    const currentUserId = normalizeUserId(request.userId);

    const friendship = await Friendship.findById(requestId);

    if (!friendship) {
      return response.status(404).send("Friend request not found");
    }

    if (normalizeUserId(friendship.recipient) !== currentUserId) {
      return response.status(403).send("You cannot reject this request");
    }

    if (friendship.status !== FRIENDSHIP_STATUS.PENDING) {
      return response.status(400).send("Friend request is no longer pending");
    }

    friendship.status = FRIENDSHIP_STATUS.REJECTED;
    friendship.respondedAt = new Date();

    await friendship.save();

    return response.status(200).json({
      success: true,
      requestId: friendship._id,
    });
  } catch (err) {
    console.log({ err });
    return response.status(500).send("Internal Server Error");
  }
};

export const removeFriend = async (request, response) => {
  try {
    const currentUserId = normalizeUserId(request.userId);
    const friendId = normalizeUserId(request.params.friendId);

    if (!friendId) {
      return response.status(400).send("friendId is required");
    }

    const pairKey = buildPairKey(currentUserId, friendId);
    const friendship = await Friendship.findOne({ pairKey });

    if (!friendship) {
      return response.status(404).send("Friendship not found");
    }

    const isRequester = normalizeUserId(friendship.requester) === currentUserId;
    const isRecipient = normalizeUserId(friendship.recipient) === currentUserId;

    if (!isRequester && !isRecipient) {
      return response.status(403).send("You cannot remove this friendship");
    }

    if (friendship.status !== FRIENDSHIP_STATUS.ACCEPTED) {
      return response.status(400).send("User is not in your friends list");
    }

    await Friendship.deleteOne({ _id: friendship._id });

    return response.status(200).json({
      success: true,
      friendId,
    });
  } catch (err) {
    console.log({ err });
    return response.status(500).send("Internal Server Error");
  }
};

export const getFriendsList = async (request, response) => {
  try {
    const friendIds = await getAcceptedFriendIds(request.userId);

    if (!friendIds.length) {
      return response.status(200).json({ friends: [] });
    }

    const users = await User.find({
      _id: { $in: friendIds },
    }).select(USER_SELECT_FIELDS);

    const usersMap = new Map(
      users.map((user) => [normalizeUserId(user._id), user])
    );

    const orderedFriends = friendIds
      .map((friendId) => usersMap.get(normalizeUserId(friendId)))
      .filter(Boolean);

    return response.status(200).json({
      friends: orderedFriends.map((user) => formatUser(user)),
    });
  } catch (err) {
    console.log({ err });
    return response.status(500).send("Internal Server Error");
  }
};

export const getFriendsSelector = async (request, response) => {
  try {
    const friendIds = await getAcceptedFriendIds(request.userId);

    if (!friendIds.length) {
      return response.status(200).json({ friends: [] });
    }

    const users = await User.find({
      _id: { $in: friendIds },
    }).select(USER_SELECT_FIELDS);

    const usersMap = new Map(
      users.map((user) => [normalizeUserId(user._id), user])
    );

    const orderedFriends = friendIds
      .map((friendId) => usersMap.get(normalizeUserId(friendId)))
      .filter(Boolean);

    return response.status(200).json({
      friends: orderedFriends.map((user) => ({
        label: buildUserLabel(user),
        value: user._id,
      })),
    });
  } catch (err) {
    console.log({ err });
    return response.status(500).send("Internal Server Error");
  }
};
