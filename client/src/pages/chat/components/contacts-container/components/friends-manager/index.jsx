import { useEffect, useState } from "react";
import { FaUserPlus } from "react-icons/fa";
import { toast } from "sonner";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarImage } from "@/components/ui/avatar";

import { apiClient } from "@/lib/api-client";
import { getColor } from "@/lib/utils";
import { useAppStore } from "@/store";
import UserProfileDialog from "@/components/profile/user-profile-dialog";
import {
  ACCEPT_FRIEND_REQUEST_ROUTE,
  CANCEL_FRIEND_REQUEST_ROUTE,
  CONTACT_PROFILE_ROUTE,
  GET_FRIENDS_LIST_ROUTE,
  GET_INCOMING_FRIEND_REQUESTS_ROUTE,
  GET_OUTGOING_FRIEND_REQUESTS_ROUTE,
  HOST,
  REJECT_FRIEND_REQUEST_ROUTE,
  REMOVE_FRIEND_ROUTE,
  SEARCH_USERS_FOR_FRIENDSHIP_ROUTE,
  SEND_FRIEND_REQUEST_ROUTE,
} from "@/utils/constants";

const TABS = {
  FRIENDS: "friends",
  REQUESTS: "requests",
  SEARCH: "search",
};

const FriendsManager = () => {
  const { setSelectedChatType, setSelectedChatData } = useAppStore();

  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(TABS.FRIENDS);

  const [friends, setFriends] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [searchedUsers, setSearchedUsers] = useState([]);

  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const [profileOpen, setProfileOpen] = useState(false);
  const [profileUser, setProfileUser] = useState(null);

  const loadFriends = async () => {
    try {
      setIsLoadingFriends(true);

      const response = await apiClient.get(GET_FRIENDS_LIST_ROUTE, {
        withCredentials: true,
      });

      setFriends(response.data?.friends || []);
    } catch (error) {
      console.log(error);
      toast.error("Не удалось загрузить друзей");
    } finally {
      setIsLoadingFriends(false);
    }
  };

  const loadRequests = async () => {
    try {
      setIsLoadingRequests(true);

      const [incomingResponse, outgoingResponse] = await Promise.all([
        apiClient.get(GET_INCOMING_FRIEND_REQUESTS_ROUTE, {
          withCredentials: true,
        }),
        apiClient.get(GET_OUTGOING_FRIEND_REQUESTS_ROUTE, {
          withCredentials: true,
        }),
      ]);

      setIncomingRequests(incomingResponse.data?.requests || []);
      setOutgoingRequests(outgoingResponse.data?.requests || []);
    } catch (error) {
      console.log(error);
      toast.error("Не удалось загрузить заявки");
    } finally {
      setIsLoadingRequests(false);
    }
  };

  const searchUsers = async (value) => {
    try {
      setSearchTerm(value);

      if (!value.trim()) {
        setSearchedUsers([]);
        return;
      }

      setIsSearchingUsers(true);

      const response = await apiClient.post(
        SEARCH_USERS_FOR_FRIENDSHIP_ROUTE,
        { searchTerm: value },
        { withCredentials: true }
      );

      setSearchedUsers(response.data?.users || []);
    } catch (error) {
      console.log(error);
      toast.error("Не удалось выполнить поиск");
    } finally {
      setIsSearchingUsers(false);
    }
  };

  useEffect(() => {
    if (!open) return;

    loadFriends();
    loadRequests();
  }, [open]);

  const refreshAll = async () => {
    await Promise.all([loadFriends(), loadRequests()]);

    if (searchTerm.trim()) {
      await searchUsers(searchTerm);
    }
  };

  const sendFriendRequest = async (userId) => {
    try {
      setBusyId(String(userId));

      await apiClient.post(
        `${SEND_FRIEND_REQUEST_ROUTE}/${userId}`,
        {},
        { withCredentials: true }
      );

      toast.success("Заявка в друзья отправлена");
      await refreshAll();
    } catch (error) {
      console.log(error);
      toast.error(error?.response?.data || "Не удалось отправить заявку");
    } finally {
      setBusyId(null);
    }
  };

  const acceptFriendRequest = async (requestId) => {
    try {
      setBusyId(String(requestId));

      await apiClient.patch(
        `${ACCEPT_FRIEND_REQUEST_ROUTE}/${requestId}/accept`,
        {},
        { withCredentials: true }
      );

      toast.success("Заявка принята");
      await refreshAll();
    } catch (error) {
      console.log(error);
      toast.error(error?.response?.data || "Не удалось принять заявку");
    } finally {
      setBusyId(null);
    }
  };

  const rejectFriendRequest = async (requestId) => {
    try {
      setBusyId(String(requestId));

      await apiClient.patch(
        `${REJECT_FRIEND_REQUEST_ROUTE}/${requestId}/reject`,
        {},
        { withCredentials: true }
      );

      toast.success("Заявка отклонена");
      await refreshAll();
    } catch (error) {
      console.log(error);
      toast.error(error?.response?.data || "Не удалось отклонить заявку");
    } finally {
      setBusyId(null);
    }
  };

  const cancelOutgoingFriendRequest = async (requestId) => {
    try {
      setBusyId(String(requestId));

      await apiClient.delete(`${CANCEL_FRIEND_REQUEST_ROUTE}/${requestId}`, {
        withCredentials: true,
      });

      toast.success("Заявка отменена");
      await refreshAll();
    } catch (error) {
      console.log(error);
      toast.error(error?.response?.data || "Не удалось отменить заявку");
    } finally {
      setBusyId(null);
    }
  };

  const removeFriend = async (friendId) => {
    try {
      setBusyId(String(friendId));

      await apiClient.delete(`${REMOVE_FRIEND_ROUTE}/${friendId}`, {
        withCredentials: true,
      });

      toast.success("Пользователь удалён из друзей");
      await refreshAll();
    } catch (error) {
      console.log(error);
      toast.error(error?.response?.data || "Не удалось удалить из друзей");
    } finally {
      setBusyId(null);
    }
  };

  const openChatWithUser = (user) => {
    if (!user?._id) return;

    setProfileOpen(false);
    setOpen(false);
    setSelectedChatType("contact");
    setSelectedChatData(user);
  };

  const openUserProfile = async (user, fallbackUser = null) => {
    const userId = user?._id || fallbackUser?._id;

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

      if (fallbackUser || user) {
        setProfileUser(fallbackUser || user);
        setProfileOpen(true);
      }
    } catch (error) {
      console.log(error);

      if (fallbackUser || user) {
        setProfileUser(fallbackUser || user);
        setProfileOpen(true);
      } else {
        toast.error("Не удалось открыть профиль");
      }
    }
  };

  const renderAvatar = (user) => {
    return (
      <Avatar className="h-11 w-11 rounded-full overflow-hidden shrink-0">
        {user?.image ? (
          <AvatarImage
            src={`${HOST}/${user.image}`}
            alt="profile"
            className="object-cover w-full h-full bg-black"
          />
        ) : (
          <div
            className={`uppercase h-11 w-11 text-lg border-[0.1rem] flex items-center justify-center rounded-full ${getColor(
              user?.color
            )}`}
          >
            {user?.firstName
              ? user.firstName.split("").shift()
              : user?.email?.split("").shift()}
          </div>
        )}
      </Avatar>
    );
  };

  const renderUserMainText = (user) => {
    return user?.firstName
      ? `${user.firstName} ${user.lastName || ""}`.trim()
      : user?.email;
  };

  const renderSearchAction = (user) => {
    const isBusy = busyId === String(user._id);

    if (user.friendshipStatus === "friend") {
      return (
        <span className="block w-full sm:w-auto text-center text-xs text-green-400 bg-green-500/10 px-3 py-2 rounded-md">
          Уже в друзьях
        </span>
      );
    }

    if (user.friendshipStatus === "outgoing_request") {
      return (
        <span className="block w-full sm:w-auto text-center text-xs text-yellow-400 bg-yellow-500/10 px-3 py-2 rounded-md">
          Заявка отправлена
        </span>
      );
    }

    if (user.friendshipStatus === "incoming_request") {
      return (
        <span className="block w-full sm:w-auto text-center text-xs text-blue-400 bg-blue-500/10 px-3 py-2 rounded-md">
          Входящая заявка
        </span>
      );
    }

    return (
      <Button
        size="sm"
        className="w-full sm:w-auto bg-green-700 hover:bg-green-900"
        disabled={isBusy}
        onClick={() => sendFriendRequest(user._id)}
      >
        Добавить
      </Button>
    );
  };

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <FaUserPlus
              className="text-neutral-400 font-light text-opacity-90 text-start hover:text-neutral-100 cursor-pointer transition-all duration-200"
              onClick={() => setOpen(true)}
            />
          </TooltipTrigger>
          <TooltipContent className="bg-[#1c1b1e] border-none mb-2 p-3 text-white">
            Друзья
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#181920] border-none text-white w-[95vw] sm:w-[600px] max-w-[95vw] h-[92vh] sm:h-[650px] flex flex-col">
          <DialogHeader>
            <DialogTitle>Друзья</DialogTitle>
            <DialogDescription className="text-white/50">
              Здесь можно искать пользователей, отправлять заявки и начинать диалоги с друзьями.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-2 bg-[#232531] p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab(TABS.FRIENDS)}
              className={`flex-1 rounded-lg py-2 text-sm transition-all ${
                activeTab === TABS.FRIENDS
                  ? "bg-green-700 text-white"
                  : "text-white/65 hover:bg-white/5"
              }`}
            >
              Друзья
            </button>

            <button
              type="button"
              onClick={() => setActiveTab(TABS.REQUESTS)}
              className={`flex-1 rounded-lg py-2 text-sm transition-all ${
                activeTab === TABS.REQUESTS
                  ? "bg-green-700 text-white"
                  : "text-white/65 hover:bg-white/5"
              }`}
            >
              Заявки
              {!!incomingRequests.length && (
                <span className="ml-2 text-xs bg-white/15 px-2 py-1 rounded-full">
                  {incomingRequests.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab(TABS.SEARCH)}
              className={`flex-1 rounded-lg py-2 text-sm transition-all ${
                activeTab === TABS.SEARCH
                  ? "bg-green-700 text-white"
                  : "text-white/65 hover:bg-white/5"
              }`}
            >
              Поиск
            </button>
          </div>

          {activeTab === TABS.FRIENDS && (
            <div className="flex-1 min-h-0 rounded-xl bg-[#232531] p-4">
              <div className="text-sm text-white/60 mb-3">Список друзей</div>

              <ScrollArea className="h-[470px] pr-3">
                <div className="flex flex-col gap-3">
                  {!isLoadingFriends && friends.length === 0 && (
                    <div className="text-white/50 text-sm text-center py-10">
                      Пока нет друзей
                    </div>
                  )}

                  {friends.map((friend) => {
                    const isBusy = busyId === String(friend._id);

                    return (
                      <div
                        key={friend._id}
                        className="bg-[#1b1c24] rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                      >
                        <button
                          type="button"
                          className="flex items-center gap-3 min-w-0 w-full text-left"
                          onClick={() => openUserProfile(friend, friend)}
                        >
                          {renderAvatar(friend)}
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm sm:text-base">
                              {renderUserMainText(friend)}
                            </div>
                          </div>
                        </button>

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto shrink-0">
                          <Button
                            size="sm"
                            className="w-full sm:w-auto bg-green-700 hover:bg-green-900"
                            onClick={() => openChatWithUser(friend)}
                          >
                            Написать
                          </Button>

                          <Button
                            size="sm"
                            variant="destructive"
                            className="w-full sm:w-auto bg-red-700 hover:bg-red-900"
                            disabled={isBusy}
                            onClick={() => removeFriend(friend._id)}
                          >
                            Удалить
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          )}

          {activeTab === TABS.REQUESTS && (
            <div className="flex-1 min-h-0 rounded-xl bg-[#232531] p-4">
              <div className="text-sm text-white/60 mb-3">Входящие заявки</div>

              <ScrollArea className="h-[215px] pr-3">
                <div className="flex flex-col gap-3">
                  {!isLoadingRequests && incomingRequests.length === 0 && (
                    <div className="text-white/50 text-sm text-center py-6">
                      Входящих заявок нет
                    </div>
                  )}

                  {incomingRequests.map((item) => {
                    const requester = item.requester;
                    const isBusy = busyId === String(item._id);

                    return (
                      <div
                        key={item._id}
                        className="bg-[#1b1c24] rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                      >
                        <button
                          type="button"
                          className="flex items-center gap-3 min-w-0 w-full text-left"
                          onClick={() => openUserProfile(requester, requester)}
                        >
                          {renderAvatar(requester)}
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm sm:text-base">
                              {renderUserMainText(requester)}
                            </div>
                          </div>
                        </button>

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto shrink-0">
                          <Button
                            size="sm"
                            className="w-full sm:w-auto bg-green-700 hover:bg-green-900"
                            disabled={isBusy}
                            onClick={() => acceptFriendRequest(item._id)}
                          >
                            Принять
                          </Button>

                          <Button
                            size="sm"
                            variant="destructive"
                            className="w-full sm:w-auto bg-red-700 hover:bg-red-900"
                            disabled={isBusy}
                            onClick={() => rejectFriendRequest(item._id)}
                          >
                            Отклонить
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>

              <div className="text-sm text-white/60 mb-3 mt-5">Исходящие заявки</div>

              <ScrollArea className="h-[170px] pr-3">
                <div className="flex flex-col gap-3">
                  {!isLoadingRequests && outgoingRequests.length === 0 && (
                    <div className="text-white/50 text-sm text-center py-6">
                      Исходящих заявок нет
                    </div>
                  )}

                  {outgoingRequests.map((item) => {
                    const recipient = item.recipient;
                    const isBusy = busyId === String(item._id);

                    return (
                      <div
                        key={item._id}
                        className="bg-[#1b1c24] rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                      >
                        <button
                          type="button"
                          className="flex items-center gap-3 min-w-0 w-full text-left"
                          onClick={() => openUserProfile(recipient, recipient)}
                        >
                          {renderAvatar(recipient)}
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm sm:text-base">
                              {renderUserMainText(recipient)}
                            </div>
                          </div>
                        </button>

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto shrink-0">
                          <div className="w-full sm:w-auto text-center text-xs text-yellow-400 bg-yellow-500/10 px-3 py-2 rounded-md">
                            Ожидает ответа
                          </div>

                          <Button
                            size="sm"
                            variant="destructive"
                            className="w-full sm:w-auto bg-red-700 hover:bg-red-900"
                            disabled={isBusy}
                            onClick={() => cancelOutgoingFriendRequest(item._id)}
                          >
                            Отменить
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          )}

          {activeTab === TABS.SEARCH && (
            <div className="flex-1 min-h-0 rounded-xl bg-[#232531] p-4">
              <div className="mb-3">
                <Input
                  placeholder="Найти пользователя"
                  className="rounded-lg p-6 bg-[#1b1c24] border-none"
                  value={searchTerm}
                  onChange={(e) => searchUsers(e.target.value)}
                />
              </div>

              <ScrollArea className="h-[460px] pr-3">
                <div className="flex flex-col gap-3">
                  {!searchTerm.trim() && (
                    <div className="text-white/50 text-sm text-center py-10">
                      Введите имя, фамилию
                    </div>
                  )}

                  {searchTerm.trim() &&
                    !isSearchingUsers &&
                    searchedUsers.length === 0 && (
                      <div className="text-white/50 text-sm text-center py-10">
                        Ничего не найдено
                      </div>
                    )}

                  {searchedUsers.map((user) => (
                    <div
                      key={user._id}
                      className="bg-[#1b1c24] rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                    >
                      <button
                        type="button"
                        className="flex items-center gap-3 min-w-0 w-full text-left"
                        onClick={() => openUserProfile(user, user)}
                      >
                        {renderAvatar(user)}
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm sm:text-base">
                            {renderUserMainText(user)}
                          </div>
                        </div>
                      </button>

                      <div className="w-full sm:w-auto shrink-0">
                        {renderSearchAction(user)}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <UserProfileDialog
        open={profileOpen}
        onOpenChange={setProfileOpen}
        user={profileUser}
        onMessage={openChatWithUser}
      />
    </>
  );
};

export default FriendsManager;
