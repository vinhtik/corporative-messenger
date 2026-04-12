/* eslint-disable no-irregular-whitespace */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { RiCloseFill } from "react-icons/ri";
import {
  Phone,
  Settings2,
  Crown,
  Shield,
  UserMinus,
  UserPlus,
  Pencil,
  Trash2,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import MultipleSelector from "@/components/ui/multipleselect";
import { useSocket } from "@/context/SocketContext";
import { getColor } from "@/lib/utils";
import { apiClient } from "@/lib/api-client";
import { useAppStore } from "@/store";
import UserProfileDialog from "@/components/profile/user-profile-dialog";
import {
  ADD_CHANNEL_MEMBERS_ROUTE,
  DELETE_CHANNEL_MEMBER_ROUTE,
  DELETE_CHANNEL_ROUTE,
  GET_ALL_CONTACTS_ROUTES,
  GET_CHANNEL_ROUTE,
  HOST,
  UPDATE_CHANNEL_MEMBER_ROLE_ROUTE,
  UPDATE_CHANNEL_ROUTE,
  CONTACT_PROFILE_ROUTE,
} from "@/utils/constants";

const createShortCallId = (prefix = "call") => {
  const randomPart =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

  return `${prefix}-${randomPart}`;
};

const buildUserPayload = (userInfo) => ({
  _id: userInfo.id,
  firstName: userInfo.firstName,
  lastName: userInfo.lastName,
  email: userInfo.email,
  image: userInfo.image,
  color: userInfo.color,
});

const ROLE_LABELS = {
  owner: "Создатель",
  moderator: "Модератор",
  member: "Участник",
};

const roleBadgeClass = (role) => {
  if (role === "owner") {
    return "bg-yellow-500/20 text-yellow-300 border-yellow-500/30";
  }

  if (role === "moderator") {
    return "bg-blue-500/20 text-blue-300 border-blue-500/30";
  }

  return "bg-white/10 text-white/70 border-white/10";
};

const sortMembersByRole = (members = []) => {
  const order = {
    owner: 0,
    moderator: 1,
    member: 2,
  };

  return [...members].sort((a, b) => {
    const first = order[a.role] ?? 99;
    const second = order[b.role] ?? 99;
    return first - second;
  });
};

const ChatHeader = () => {
  const navigate = useNavigate();
  const socket = useSocket();

  const {
    closeChat,
    selectedChatData,
    selectedChatType,
    userInfo,
    setSelectedChatData,
    replaceChannelData,
    removeChannel,
  } = useAppStore();

  const [channelDialogOpen, setChannelDialogOpen] = useState(false);
  const [allContacts, setAllContacts] = useState([]);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [channelName, setChannelName] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const [profileOpen, setProfileOpen] = useState(false);
  const [profileUser, setProfileUser] = useState(null);

  const selectedChannelId =
    selectedChatType === "channel" ? selectedChatData?._id : null;

  const currentUserRole = selectedChatData?.currentUserRole;
  const memberDetails = sortMembersByRole(selectedChatData?.memberDetails || []);

  const memberIds = useMemo(() => {
    return new Set(
      memberDetails.map((member) => String(member?.user?._id || member?.user))
    );
  }, [memberDetails]);

  const availableContacts = useMemo(() => {
    return allContacts.filter((contact) => !memberIds.has(String(contact.value)));
  }, [allContacts, memberIds]);

  const canRenameChannel =
    selectedChatType === "channel" &&
    (currentUserRole === "owner" || currentUserRole === "moderator");

  const canAddMembers =
    selectedChatType === "channel" &&
    (currentUserRole === "owner" || currentUserRole === "moderator");

  const canDeleteChannel =
    selectedChatType === "channel" && currentUserRole === "owner";

  const canPromoteToModerator = (member) => {
    return (
      currentUserRole === "owner" &&
      member?.role === "member" &&
      String(member?.user?._id) !== String(userInfo?.id)
    );
  };

  const canDemoteModerator = (member) => {
    return (
      currentUserRole === "owner" &&
      member?.role === "moderator" &&
      String(member?.user?._id) !== String(userInfo?.id)
    );
  };

  const canRemoveMember = (member) => {
    const targetId = String(member?.user?._id || "");
    const targetRole = member?.role;

    if (targetId === String(userInfo?.id || "")) {
      return false;
    }

    if (currentUserRole === "owner") {
      return targetRole !== "owner";
    }

    if (currentUserRole === "moderator") {
      return targetRole === "member";
    }

    return false;
  };

  const syncChannelInStore = useCallback(
    (channel, successMessage = "") => {
      if (!channel?._id) {
        return;
      }

      setSelectedChatData(channel);
      replaceChannelData(channel);
      setChannelName(channel.name || "");
      setSelectedContacts([]);

      if (successMessage) {
        toast.success(successMessage);
      }
    },
    [setSelectedChatData, replaceChannelData]
  );

  const fetchChannelDetails = useCallback(async () => {
    if (!selectedChannelId) {
      return;
    }

    try {
      const response = await apiClient.get(`${GET_CHANNEL_ROUTE}/${selectedChannelId}`, {
        withCredentials: true,
      });

      if (response.data?.channel) {
        syncChannelInStore(response.data.channel);
      }
    } catch (error) {
      console.log(error);
    }
  }, [selectedChannelId, syncChannelInStore]);

  const fetchAllContacts = useCallback(async () => {
    try {
      const response = await apiClient.get(GET_ALL_CONTACTS_ROUTES, {
        withCredentials: true,
      });

      if (response.data?.contacts) {
        setAllContacts(response.data.contacts);
      }
    } catch (error) {
      console.log(error);
    }
  }, []);

  useEffect(() => {
    if (selectedChatType === "channel" && selectedChatData?.name) {
      setChannelName(selectedChatData.name);
    }
  }, [selectedChatType, selectedChatData]);

  useEffect(() => {
    if (selectedChatType === "channel" && selectedChannelId) {
      fetchChannelDetails();
    }
  }, [selectedChatType, selectedChannelId, fetchChannelDetails]);

  useEffect(() => {
    if (channelDialogOpen) {
      fetchChannelDetails();
      fetchAllContacts();
    }
  }, [channelDialogOpen, fetchAllContacts, fetchChannelDetails]);

  const openUserProfile = async (userId, fallbackUser = null) => {
    if (!userId) return;

    try {
      const response = await apiClient.get(`${CONTACT_PROFILE_ROUTE}/${userId}`, {
        withCredentials: true,
      });

      if (response.data?.user) {
        setProfileUser(response.data.user);
        setProfileOpen(true);
        return;
      }

      if (fallbackUser) {
        setProfileUser(fallbackUser);
        setProfileOpen(true);
      }
    } catch (error) {
      console.log(error);

      if (fallbackUser) {
        setProfileUser(fallbackUser);
        setProfileOpen(true);
      } else {
        toast.error("Не удалось открыть профиль");
      }
    }
  };

  const openContactProfile = async () => {
    if (selectedChatType !== "contact" || !selectedChatData?._id) {
      return;
    }

    openUserProfile(selectedChatData._id, selectedChatData);
  };

  const openChannelSettings = () => {
    if (selectedChatType === "channel") {
      setChannelDialogOpen(true);
    }
  };

  const startCall = () => {
    if (!socket) {
      toast.error("Сокет ещё не подключился. Попробуй снова через секунду.");
      return;
    }

    if (!selectedChatData?._id || !selectedChatType || !userInfo?.id) {
      return;
    }

    const fromUser = buildUserPayload(userInfo);

    if (selectedChatType === "channel") {
      const callId = createShortCallId("channel");

      socket.emit("call-channel", {
        callId,
        mode: "video",
        fromUser,
        channelId: selectedChatData._id,
      });

      const params = new URLSearchParams({
        mode: "video",
        chatType: "channel",
        channelId: selectedChatData._id,
        initiator: "true",
      });

      navigate(`/call/${callId}?${params.toString()}`);
      return;
    }

    const callId = createShortCallId("dm");

    socket.emit("call-user", {
      callId,
      mode: "video",
      fromUser,
      targetUserId: selectedChatData._id,
    });

    const params = new URLSearchParams({
      mode: "video",
      chatType: "contact",
      peerId: selectedChatData._id,
      initiator: "true",
    });

    navigate(`/call/${callId}?${params.toString()}`);
  };

  const saveChannelName = async () => {
    if (!selectedChannelId || !channelName.trim()) {
      return;
    }

    try {
      setIsBusy(true);

      const response = await apiClient.patch(
        `${UPDATE_CHANNEL_ROUTE}/${selectedChannelId}`,
        { name: channelName.trim() },
        { withCredentials: true }
      );

      if (response.data?.channel) {
        syncChannelInStore(response.data.channel, "Название группы обновлено.");
      }
    } catch (error) {
      console.log(error);
      toast.error(error?.response?.data || "Не удалось обновить название.");
    } finally {
      setIsBusy(false);
    }
  };

  const addMembers = async () => {
    if (!selectedChannelId || !selectedContacts.length) {
      return;
    }

    try {
      setIsBusy(true);

      const response = await apiClient.post(
        `${ADD_CHANNEL_MEMBERS_ROUTE}/${selectedChannelId}`,
        { memberIds: selectedContacts.map((contact) => contact.value) },
        { withCredentials: true }
      );

      if (response.data?.channel) {
        syncChannelInStore(response.data.channel, "Участники добавлены.");
      }
    } catch (error) {
      console.log(error);
      toast.error(error?.response?.data || "Не удалось добавить участников.");
    } finally {
      setIsBusy(false);
    }
  };

  const changeMemberRole = async (memberId, role) => {
    if (!selectedChannelId || !memberId) {
      return;
    }

    try {
      setIsBusy(true);

      const response = await apiClient.patch(
        `${UPDATE_CHANNEL_MEMBER_ROLE_ROUTE}/${selectedChannelId}/${memberId}/role`,
        { role },
        { withCredentials: true }
      );

      if (response.data?.channel) {
        syncChannelInStore(
          response.data.channel,
          role === "moderator"
            ? "Пользователь назначен модератором."
            : "Роль пользователя обновлена."
        );
      }
    } catch (error) {
      console.log(error);
      toast.error(error?.response?.data || "Не удалось изменить роль.");
    } finally {
      setIsBusy(false);
    }
  };

  const removeMember = async (memberId) => {
    if (!selectedChannelId || !memberId) {
      return;
    }

    try {
      setIsBusy(true);

      const response = await apiClient.delete(
        `${DELETE_CHANNEL_MEMBER_ROUTE}/${selectedChannelId}/${memberId}`,
        { withCredentials: true }
      );

      if (response.data?.channel) {
        syncChannelInStore(response.data.channel, "Участник удалён из группы.");
      }
    } catch (error) {
      console.log(error);
      toast.error(error?.response?.data || "Не удалось удалить участника.");
    } finally {
      setIsBusy(false);
    }
  };

  const deleteChannel = async () => {
    if (!selectedChannelId) {
      return;
    }

    try {
      setIsBusy(true);

      const response = await apiClient.delete(
        `${DELETE_CHANNEL_ROUTE}/${selectedChannelId}`,
        { withCredentials: true }
      );

      if (response.data?.success) {
        removeChannel(selectedChannelId);
        closeChat();
        setChannelDialogOpen(false);
        toast.success("Группа удалена.");
      }
    } catch (error) {
      console.log(error);
      toast.error(error?.response?.data || "Не удалось удалить группу.");
    } finally {
      setIsBusy(false);
    }
  };

  const renderRoleIcon = (role) => {
    if (role === "owner") {
      return <Crown className="h-4 w-4 text-yellow-300" />;
    }

    if (role === "moderator") {
      return <Shield className="h-4 w-4 text-blue-300" />;
    }

    return null;
  };

  return (
    <>
      <div className="h-[10vh] border-b-2 border-[#2f303b] flex items-center justify-between px-20">
        <div className="flex gap-5 items-center w-full justify-between">
          <div className="flex gap-3 items-center justify-center">
            <button
              type="button"
              className={`w-12 h-12 relative ${
                selectedChatType === "contact" || selectedChatType === "channel"
                  ? "cursor-pointer"
                  : "cursor-default"
              }`}
              onClick={
                selectedChatType === "contact"
                  ? openContactProfile
                  : selectedChatType === "channel"
                  ? openChannelSettings
                  : undefined
              }
            >
              {selectedChatType === "contact" ? (
                <Avatar className="h-12 w-12 rounded-full overflow-hidden">
                  {selectedChatData.image ? (
                    <AvatarImage
                      src={`${HOST}/${selectedChatData.image}`}
                      alt="profile"
                      className="object-cover w-full h-full bg-black"
                    />
                  ) : (
                    <div
                      className={`uppercase h-12 w-12 text-lg border-[0.1rem] flex items-center justify-center rounded-full ${getColor(
                        selectedChatData.color
                      )}`}
                    >
                      {selectedChatData.firstName
                        ? selectedChatData.firstName.split("").shift()
                        : selectedChatData.email.split("").shift()}
                    </div>
                  )}
                </Avatar>
              ) : (
                <div className="bg-[#ffffff22] h-10 w-10 flex items-center justify-center rounded-full">
                  #
                </div>
              )}
            </button>

            <button
              type="button"
              className={`flex flex-col text-left ${
                selectedChatType === "contact" || selectedChatType === "channel"
                  ? "cursor-pointer"
                  : "cursor-default"
              }`}
              onClick={
                selectedChatType === "contact"
                  ? openContactProfile
                  : selectedChatType === "channel"
                  ? openChannelSettings
                  : undefined
              }
            >
              <div>
                {selectedChatType === "channel" && selectedChatData.name}
                {selectedChatType === "contact" &&
                  (selectedChatData.firstName
                    ? `${selectedChatData.firstName} ${selectedChatData.lastName || ""}`.trim()
                    : selectedChatData.email)}
              </div>

              {selectedChatType === "channel" && (
                <div className="text-xs text-white/50">
                  {selectedChatData?.memberCount || memberDetails.length || 0} участников
                </div>
              )}
            </button>
          </div>

          <div className="flex items-center justify-center gap-3">
            {selectedChatType === "channel" && (
              <button
                type="button"
                className="text-neutral-400 hover:text-white duration-200 transition-all rounded-full p-2 hover:bg-[#2a2c37]"
                onClick={() => setChannelDialogOpen(true)}
                title="Управление группой"
              >
                <Settings2 className="h-5 w-5" />
              </button>
            )}

            <button
              type="button"
              className="text-neutral-400 hover:text-white duration-200 transition-all rounded-full p-2 hover:bg-[#2a2c37]"
              onClick={startCall}
              title="Звонок"
            >
              <Phone className="h-5 w-5" />
            </button>

            <button
              className="text-neutral-500 focus:border-none focus:outline-none focus:text-white duration-200 transition-all"
              onClick={closeChat}
            >
              <RiCloseFill className="text-3xl" />
            </button>
          </div>
        </div>
      </div>

      <Dialog open={channelDialogOpen} onOpenChange={setChannelDialogOpen}>
        <DialogContent className="bg-[#181920] border-none text-white w-[720px] max-w-[95vw] max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Управление группой</DialogTitle>
            <DialogDescription className="text-white/50">
              Здесь можно менять название, добавлять участников и управлять ролями.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-5 overflow-y-auto scrollbar-hidden pr-1">
            <div className="rounded-xl bg-[#2c2e3b] p-4">
              <div className="text-sm text-white/60 mb-2">Название группы</div>

              <div className="flex gap-2">
                <Input
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  disabled={!canRenameChannel || isBusy}
                  className="rounded-lg bg-[#1f212b] border-none"
                  placeholder="Название группы"
                />

                {canRenameChannel && (
                  <Button
                    className="bg-green-700 hover:bg-green-900 transition-all duration-200"
                    onClick={saveChannelName}
                    disabled={isBusy || !channelName.trim()}
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Сохранить
                  </Button>
                )}
              </div>
            </div>

            {canAddMembers && (
              <div className="rounded-xl bg-[#2c2e3b] p-4">
                <div className="text-sm text-white/60 mb-2">Добавить участников</div>

                <div className="flex flex-col gap-3">
                  <MultipleSelector
                    className="rounded-lg bg-[#1f212b] border-none py-2 text-white"
                    defaultOptions={availableContacts}
                    placeholder="Найти контакты"
                    value={selectedContacts}
                    onChange={setSelectedContacts}
                    emptyIndicator={
                      <p className="text-center text-lg leading-10 text-gray-600">
                        Нет доступных контактов
                      </p>
                    }
                  />

                  <Button
                    className="bg-green-700 hover:bg-green-900 transition-all duration-200"
                    onClick={addMembers}
                    disabled={isBusy || !selectedContacts.length}
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Добавить
                  </Button>
                </div>
              </div>
            )}

            <div className="rounded-xl bg-[#2c2e3b] p-4">
              <div className="text-sm text-white/60 mb-3">Участники</div>

              <div className="flex flex-col gap-3">
                {memberDetails.map((member) => {
                  const user = member.user;
                  const fullName = user?.firstName
                    ? `${user.firstName} ${user.lastName || ""}`.trim()
                    : user?.email;

                  return (
                    <div
                      key={user?._id}
                      className="bg-[#1f212b] rounded-xl px-4 py-3 flex items-center justify-between gap-4"
                    >
                      <button
                        type="button"
                        className="flex items-center gap-3 min-w-0 text-left"
                        onClick={() => openUserProfile(user?._id, user)}
                      >
                        <Avatar className="h-10 w-10 rounded-full overflow-hidden shrink-0">
                          {user?.image ? (
                            <AvatarImage
                              src={`${HOST}/${user.image}`}
                              alt="profile"
                              className="object-cover w-full h-full bg-black"
                            />
                          ) : (
                            <AvatarFallback
                              className={`uppercase h-10 w-10 text-lg flex items-center justify-center rounded-full ${getColor(
                                user?.color
                              )}`}
                            >
                              {user?.firstName
                                ? user.firstName.split("").shift()
                                : user?.email?.split("").shift()}
                            </AvatarFallback>
                          )}
                        </Avatar>

                        <div className="min-w-0">
                          <div className="truncate">{fullName}</div>
                          <div className="text-xs text-white/45 truncate">
                            {user?.email}
                          </div>
                        </div>
                      </button>

                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        <div
                          className={`px-2 py-1 text-xs rounded-full border flex items-center gap-1 ${roleBadgeClass(
                            member.role
                          )}`}
                        >
                          {renderRoleIcon(member.role)}
                          <span>{ROLE_LABELS[member.role]}</span>
                        </div>

                        {canPromoteToModerator(member) && (
                          <Button
                            size="sm"
                            className="bg-blue-700 hover:bg-blue-900"
                            onClick={() => changeMemberRole(user._id, "moderator")}
                            disabled={isBusy}
                          >
                            <Shield className="h-4 w-4 mr-2" />
                            Сделать модератором
                          </Button>
                        )}

                        {canDemoteModerator(member) && (
                          <Button
                            size="sm"
                            className="bg-[#3a3d4c] hover:bg-[#4b4f62]"
                            onClick={() => changeMemberRole(user._id, "member")}
                            disabled={isBusy}
                          >
                            Снять модератора
                          </Button>
                        )}

                        {canRemoveMember(member) && (
                          <Button
                            size="sm"
                            variant="destructive"
                            className="bg-red-700 hover:bg-red-900"
                            onClick={() => removeMember(user._id)}
                            disabled={isBusy}
                          >
                            <UserMinus className="h-4 w-4 mr-2" />
                            Удалить
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {canDeleteChannel && (
              <div className="rounded-xl bg-[#2c2e3b] p-4">
                <div className="text-sm text-white/60 mb-3">Опасная зона</div>

                <Button
                  variant="destructive"
                  className="bg-red-700 hover:bg-red-900 w-full"
                  onClick={deleteChannel}
                  disabled={isBusy}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Удалить группу
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <UserProfileDialog
        open={profileOpen}
        onOpenChange={setProfileOpen}
        user={profileUser}
      />
    </>
  );
};

export default ChatHeader;