import Channel from "../models/ChannelModel.js";
import User from "../models/UserModel.js";
import {
  CHANNEL_ROLES,
  buildChannelMembers,
  canAssignRole,
  canManageMember,
  formatChannel,
  getChannelMember,
  getChannelMemberIds,
  getChannelRole,
  isChannelMember,
  isOwnerOrModerator,
  normalizeId,
  uniqueIds,
} from "../utils/channelPermissions.js";
import { emitToManyUsers, emitToUser } from "../socket.js";

const channelMemberPopulation = [
  {
    path: "members.user",
    select: "firstName lastName email _id image color",
  },
  {
    path: "members.addedBy",
    select: "firstName lastName email _id image color",
  },
];

const populateChannelQuery = (query) => {
  return query.populate(channelMemberPopulation);
};

const getPopulatedChannelById = async (channelId) => {
  return populateChannelQuery(Channel.findById(channelId));
};

const getPopulatedChannelWithMessagesById = async (channelId) => {
  return populateChannelQuery(
    Channel.findById(channelId).populate({
      path: "messages",
      populate: {
        path: "sender",
        select: "firstName lastName email _id image color",
      },
    })
  );
};

const broadcastChannelUpdate = async (channelId, options = {}) => {
  const channel = await getPopulatedChannelById(channelId);

  if (!channel) {
    return null;
  }

  const payload = {
    channel: formatChannel(channel),
    reason: options.reason || "updated",
  };

  emitToManyUsers(getChannelMemberIds(channel), "channel-updated", payload);

  if (options.removedUserId) {
    emitToUser(options.removedUserId, "channel-member-removed", {
      channelId: String(channel._id),
      reason: options.reason || "removed",
    });
  }

  return channel;
};

export const createChannel = async (request, response) => {
  try {
    const { name, members = [] } = request.body;
    const userId = request.userId;

    if (!name?.trim()) {
      return response.status(400).send("Channel name is required");
    }

    const creator = await User.findById(userId);

    if (!creator) {
      return response.status(400).send("Admin user not found");
    }

    const requestedMemberIds = uniqueIds(members).filter(
      (memberId) => memberId !== normalizeId(userId)
    );

    if (requestedMemberIds.length) {
      const validMembers = await User.find({ _id: { $in: requestedMemberIds } });

      if (validMembers.length !== requestedMemberIds.length) {
        return response.status(400).send("Some members are not valid users");
      }
    }

    const newChannel = new Channel({
      name: name.trim(),
      members: buildChannelMembers({
        ownerId: userId,
        memberIds: requestedMemberIds,
        addedBy: userId,
      }),
    });

    await newChannel.save();

    const populatedChannel = await getPopulatedChannelById(newChannel._id);

    return response.status(201).json({
      channel: formatChannel(populatedChannel, userId),
    });
  } catch (err) {
    console.log({ err });
    return response.status(500).send("Internal Server Error");
  }
};

export const getUserChannels = async (request, response) => {
  try {
    const userId = request.userId;

    const channels = await populateChannelQuery(
      Channel.find({
        "members.user": userId,
      }).sort({ updatedAt: -1 })
    );

    return response.status(200).json({
      channels: channels.map((channel) => formatChannel(channel, userId)),
    });
  } catch (err) {
    console.log({ err });
    return response.status(500).send("Internal Server Error");
  }
};

export const getChannel = async (request, response) => {
  try {
    const { channelId } = request.params;
    const userId = request.userId;

    const channel = await getPopulatedChannelById(channelId);

    if (!channel) {
      return response.status(404).send("Channel not found");
    }

    if (!isChannelMember(channel, userId)) {
      return response.status(403).send("You are not a member of this channel");
    }

    return response.status(200).json({
      channel: formatChannel(channel, userId),
    });
  } catch (err) {
    console.log({ err });
    return response.status(500).send("Internal Server Error");
  }
};

export const getChannelMessages = async (request, response) => {
  try {
    const { channelId } = request.params;
    const userId = request.userId;

    const channel = await getPopulatedChannelWithMessagesById(channelId);

    if (!channel) {
      return response.status(404).send("Channel not found");
    }

    if (!isChannelMember(channel, userId)) {
      return response.status(403).send("You are not a member of this channel");
    }

    return response.status(200).json({
      messages: channel.messages,
      channel: formatChannel(channel, userId),
    });
  } catch (err) {
    console.log({ err });
    return response.status(500).send("Internal Server Error");
  }
};

export const updateChannel = async (request, response) => {
  try {
    const { channelId } = request.params;
    const { name } = request.body;
    const userId = request.userId;

    if (!name?.trim()) {
      return response.status(400).send("Channel name is required");
    }

    const channel = await Channel.findById(channelId);

    if (!channel) {
      return response.status(404).send("Channel not found");
    }

    if (!isOwnerOrModerator(channel, userId)) {
      return response.status(403).send("You do not have permission to update this channel");
    }

    channel.name = name.trim();
    await channel.save();

    const updatedChannel = await broadcastChannelUpdate(channel._id, {
      reason: "channel-renamed",
    });

    return response.status(200).json({
      channel: formatChannel(updatedChannel, userId),
    });
  } catch (err) {
    console.log({ err });
    return response.status(500).send("Internal Server Error");
  }
};

export const addChannelMembers = async (request, response) => {
  try {
    const { channelId } = request.params;
    const { memberIds = [] } = request.body;
    const userId = request.userId;

    const channel = await Channel.findById(channelId);

    if (!channel) {
      return response.status(404).send("Channel not found");
    }

    if (!isOwnerOrModerator(channel, userId)) {
      return response.status(403).send("You do not have permission to add members");
    }

    const requestedMemberIds = uniqueIds(memberIds).filter(Boolean);

    if (!requestedMemberIds.length) {
      return response.status(400).send("No members provided");
    }

    const existingMemberIds = new Set(
      (channel.members || []).map((member) => normalizeId(member.user))
    );

    const usersToAdd = requestedMemberIds.filter(
      (memberId) => !existingMemberIds.has(memberId)
    );

    if (!usersToAdd.length) {
      const populatedChannel = await getPopulatedChannelById(channelId);

      return response.status(200).json({
        channel: formatChannel(populatedChannel, userId),
      });
    }

    const validUsers = await User.find({ _id: { $in: usersToAdd } });

    if (validUsers.length !== usersToAdd.length) {
      return response.status(400).send("Some members are not valid users");
    }

    usersToAdd.forEach((memberId) => {
      channel.members.push({
        user: memberId,
        role: CHANNEL_ROLES.MEMBER,
        joinedAt: new Date(),
        addedBy: userId,
      });
    });

    await channel.save();

    const updatedChannel = await broadcastChannelUpdate(channel._id, {
      reason: "members-added",
    });

    return response.status(200).json({
      channel: formatChannel(updatedChannel, userId),
    });
  } catch (err) {
    console.log({ err });
    return response.status(500).send("Internal Server Error");
  }
};

export const removeChannelMember = async (request, response) => {
  try {
    const { channelId, memberId } = request.params;
    const userId = request.userId;

    const channel = await Channel.findById(channelId);

    if (!channel) {
      return response.status(404).send("Channel not found");
    }

    const actorRole = getChannelRole(channel, userId);
    const targetMember = getChannelMember(channel, memberId);

    if (!actorRole) {
      return response.status(403).send("You are not a member of this channel");
    }

    if (!targetMember) {
      return response.status(404).send("Target member not found");
    }

    if (!canManageMember({ actorRole, targetRole: targetMember.role })) {
      return response.status(403).send("You do not have permission to remove this member");
    }

    channel.members = channel.members.filter(
      (member) => normalizeId(member.user) !== normalizeId(memberId)
    );

    await channel.save();

    const updatedChannel = await broadcastChannelUpdate(channel._id, {
      reason: "member-removed",
      removedUserId: memberId,
    });

    return response.status(200).json({
      channel: formatChannel(updatedChannel, userId),
    });
  } catch (err) {
    console.log({ err });
    return response.status(500).send("Internal Server Error");
  }
};

export const updateChannelMemberRole = async (request, response) => {
  try {
    const { channelId, memberId } = request.params;
    const { role } = request.body;
    const userId = request.userId;

    const channel = await Channel.findById(channelId);

    if (!channel) {
      return response.status(404).send("Channel not found");
    }

    const actorRole = getChannelRole(channel, userId);
    const targetMember = getChannelMember(channel, memberId);

    if (!actorRole) {
      return response.status(403).send("You are not a member of this channel");
    }

    if (!targetMember) {
      return response.status(404).send("Target member not found");
    }

    if (
      !canAssignRole({
        actorRole,
        targetRole: targetMember.role,
        newRole: role,
      })
    ) {
      return response.status(403).send("You do not have permission to change this role");
    }

    targetMember.role = role;
    await channel.save();

    const updatedChannel = await broadcastChannelUpdate(channel._id, {
      reason: "role-updated",
    });

    return response.status(200).json({
      channel: formatChannel(updatedChannel, userId),
    });
  } catch (err) {
    console.log({ err });
    return response.status(500).send("Internal Server Error");
  }
};

export const deleteChannel = async (request, response) => {
  try {
    const { channelId } = request.params;
    const userId = request.userId;

    const channel = await Channel.findById(channelId);

    if (!channel) {
      return response.status(404).send("Channel not found");
    }

    if (getChannelRole(channel, userId) !== CHANNEL_ROLES.OWNER) {
      return response.status(403).send("Only the owner can delete this channel");
    }

    const memberIds = getChannelMemberIds(channel);

    await Channel.findByIdAndDelete(channelId);

    emitToManyUsers(memberIds, "channel-deleted", {
      channelId: String(channelId),
    });

    return response.status(200).json({
      success: true,
      channelId: String(channelId),
    });
  } catch (err) {
    console.log({ err });
    return response.status(500).send("Internal Server Error");
  }
};