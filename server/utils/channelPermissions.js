export const CHANNEL_ROLES = {
  OWNER: "owner",
  MODERATOR: "moderator",
  MEMBER: "member",
};

export const normalizeId = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value._id) return String(value._id);
  return String(value);
};

export const uniqueIds = (ids = []) => {
  return [...new Set(ids.map(normalizeId).filter(Boolean))];
};

export const buildChannelMembers = ({ ownerId, memberIds = [], addedBy = null }) => {
  const allIds = uniqueIds([ownerId, ...memberIds]);

  return allIds.map((userId) => ({
    user: userId,
    role: normalizeId(userId) === normalizeId(ownerId)
      ? CHANNEL_ROLES.OWNER
      : CHANNEL_ROLES.MEMBER,
    joinedAt: new Date(),
    addedBy: addedBy || null,
  }));
};

export const getChannelMember = (channel, userId) => {
  const normalizedUserId = normalizeId(userId);

  return (channel.members || []).find(
    (member) => normalizeId(member.user) === normalizedUserId
  );
};

export const getChannelRole = (channel, userId) => {
  const member = getChannelMember(channel, userId);
  return member?.role || null;
};

export const isChannelMember = (channel, userId) => {
  return Boolean(getChannelMember(channel, userId));
};

export const isOwnerOrModerator = (channel, userId) => {
  const role = getChannelRole(channel, userId);

  return role === CHANNEL_ROLES.OWNER || role === CHANNEL_ROLES.MODERATOR;
};

export const canManageMember = ({ actorRole, targetRole }) => {
  if (!actorRole || !targetRole) return false;

  if (actorRole === CHANNEL_ROLES.OWNER) {
    return targetRole !== CHANNEL_ROLES.OWNER;
  }

  if (actorRole === CHANNEL_ROLES.MODERATOR) {
    return targetRole === CHANNEL_ROLES.MEMBER;
  }

  return false;
};

export const canAssignRole = ({ actorRole, targetRole, newRole }) => {
  if (actorRole !== CHANNEL_ROLES.OWNER) return false;
  if (targetRole === CHANNEL_ROLES.OWNER) return false;

  return [CHANNEL_ROLES.MODERATOR, CHANNEL_ROLES.MEMBER].includes(newRole);
};

export const getChannelMemberIds = (channel) => {
  return uniqueIds((channel.members || []).map((member) => member.user));
};

export const formatChannel = (channel, currentUserId = null) => {
  const plainChannel = channel.toObject ? channel.toObject() : channel;

  const memberDetails = (plainChannel.members || [])
    .map((member) => ({
      user: member.user,
      role: member.role,
      joinedAt: member.joinedAt,
      addedBy: member.addedBy || null,
    }))
    .filter((member) => member.user);

  const owner =
    memberDetails.find((member) => member.role === CHANNEL_ROLES.OWNER)?.user || null;

  return {
    ...plainChannel,
    owner,
    admin: owner,
    members: memberDetails.map((member) => member.user),
    memberDetails,
    memberCount: memberDetails.length,
    currentUserRole: currentUserId ? getChannelRole(plainChannel, currentUserId) : null,
  };
};