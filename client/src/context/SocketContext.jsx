/* eslint-disable no-irregular-whitespace */
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getColor } from "@/lib/utils";
import { useAppStore } from "@/store";
import { HOST } from "@/utils/constants";
import { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";
import { toast } from "sonner";

const SocketContext = createContext(null);

export const useSocket = () => {
  return useContext(SocketContext);
};

const getDisplayName = (user) => {
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();
  return fullName || user?.email || "Пользователь";
};

const getImageSrc = (image) => {
  if (!image) return null;
  if (image.startsWith("http://") || image.startsWith("https://")) return image;
  return `${HOST}/${image}`;
};

const isImageFile = (filePath = "") => {
  return /\.(jpg|jpeg|png|gif|bmp|tiff|tif|webp|svg|ico|heic|heif)$/i.test(filePath);
};

const getMessagePreview = (message) => {
  if (message?.messageType === "file") {
    if (isImageFile(message?.fileUrl)) {
      return " Изображение";
    }
    return " Файл";
  }

  return message?.content || "Новое сообщение";
};

const showMessageToast = ({ sender, message, isChannel = false, channelName = "" }) => {
  const title = getDisplayName(sender);
  const imageSrc = getImageSrc(sender?.image);
  const preview = getMessagePreview(message);

  toast.custom(
    () => (
      <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-[#1f212b] px-4 py-3 text-white shadow-lg w-[320px] max-w-[calc(100vw-2rem)]">
        <Avatar className="h-10 w-10 rounded-full overflow-hidden shrink-0">
          {imageSrc ? (
            <AvatarImage
              src={imageSrc}
              alt={title}
              className="object-cover w-full h-full bg-black"
            />
          ) : (
          <AvatarFallback
             className={`uppercase h-10 w-10 text-sm flex items-center justify-center rounded-full ${getColor(
                sender?.color ?? 0
              )}`}
            >
            {title.charAt(0)}
            </AvatarFallback>
          )}
          </Avatar>

        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm truncate">
            {isChannel ? `${title} · ${channelName || "Группа"}` : title}
          </div>
          <div className="text-xs text-neutral-300 break-words line-clamp-2 mt-1">
            {preview}
          </div>
        </div>
      </div>
    ),
    {
      duration: 4000,
    }
  );
};

export const SocketProvider = ({ children }) => {
  const { userInfo } = useAppStore();
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!userInfo?.id) {
      return;
    }

    const socketInstance = io(HOST, {
      withCredentials: true,
      query: { userId: userInfo.id },
    });

    setSocket(socketInstance);

    socketInstance.on("connect", () => {
      console.log("Connected to socket server");
    });

    const handleRecieveMessage = (message) => {
      const {
        selectedChatData,
        selectedChatType,
        addMessage,
        addContactsInDMContacts,
      } = useAppStore.getState();

      const senderId = String(message?.sender?._id || "");
      const recipientId = String(message?.recipient?._id || "");
      const currentUserId = String(userInfo?.id || "");

      const isOwnMessage = senderId === currentUserId;
      const otherUserId = senderId === currentUserId ? recipientId : senderId;

      const isCurrentChatOpen =
        selectedChatType === "contact" &&
        String(selectedChatData?._id || "") === otherUserId;

      if (
        selectedChatData &&
        selectedChatType !== undefined &&
        (selectedChatData._id === message.sender._id ||
          selectedChatData._id === message.recipient._id)
      ) {
        addMessage(message);
      }

      addContactsInDMContacts(message);

      if (!isOwnMessage && !isCurrentChatOpen) {
        showMessageToast({
          sender: message.sender,
          message,
          isChannel: false,
        });
      }
    };

    const handleRecieveChannelMessage = (message) => {
      const {
        selectedChatData,
        selectedChatType,
        addMessage,
        addChannelInChannelList,
        channels,
      } = useAppStore.getState();

      const senderId = String(message?.sender?._id || "");
      const currentUserId = String(userInfo?.id || "");
      const isOwnMessage = senderId === currentUserId;

      const isCurrentChatOpen =
        selectedChatType === "channel" &&
        String(selectedChatData?._id || "") === String(message.channelId);

      if (
        selectedChatData &&
        selectedChatType !== undefined &&
        selectedChatData._id === message.channelId
      ) {
        addMessage(message);
      }

      addChannelInChannelList(message);

      if (!isOwnMessage && !isCurrentChatOpen) {
        const channel = (channels || []).find(
          (item) => String(item._id) === String(message.channelId)
        );

        showMessageToast({
          sender: message.sender,
          message,
          isChannel: true,
          channelName: channel?.name || "Группа",
        });
      }
    };

    const handleChannelUpdated = ({ channel }) => {
      const {
        selectedChatData,
        selectedChatType,
        setSelectedChatData,
        replaceChannelData,
      } = useAppStore.getState();

      if (!channel?._id) return;

      replaceChannelData(channel);

      if (
        selectedChatType === "channel" &&
        selectedChatData?._id === channel._id
      ) {
        setSelectedChatData(channel);
      }
    };

    const handleChannelDeleted = ({ channelId }) => {
      const {
        selectedChatData,
        selectedChatType,
        removeChannel,
        closeChat,
      } = useAppStore.getState();

      removeChannel(channelId);

      if (
        selectedChatType === "channel" &&
        selectedChatData?._id === channelId
      ) {
        closeChat();
        toast.info("Группа была удалена.");
      }
    };

    const handleChannelMemberRemoved = ({ channelId }) => {
      const {
        selectedChatData,
        selectedChatType,
        removeChannel,
        closeChat,
      } = useAppStore.getState();

      removeChannel(channelId);

      if (
        selectedChatType === "channel" &&
        selectedChatData?._id === channelId
      ) {
        closeChat();
        toast.info("Вы были удалены из этой группы.");
      }
    };

    const handleIncomingCall = (callData) => {
      const { setIncomingCall } = useAppStore.getState();
      setIncomingCall(callData);
    };

    const handleCallAccepted = (callData) => {
      const acceptedBy = callData?.fromUser;
      const acceptedByName = [acceptedBy?.firstName, acceptedBy?.lastName]
        .filter(Boolean)
        .join(" ")
        .trim();

      toast.success(
        acceptedByName
          ? `${acceptedByName} присоединился к звонку`
          : "Пользователь принял звонок"
      );
    };

    const handleCallRejected = (callData) => {
      const rejectedBy = callData?.fromUser;
      const rejectedByName = [rejectedBy?.firstName, rejectedBy?.lastName]
        .filter(Boolean)
        .join(" ")
        .trim();

      if (callData?.chatType === "channel") {
        toast.info(
          rejectedByName
            ? `${rejectedByName} не присоединился к звонку`
            : "Пользователь не присоединился к звонку"
        );
        return;
      }

      toast.info(
        rejectedByName
          ? `${rejectedByName} отклонил звонок`
          : "Пользователь отклонил звонок"
      );
    };

    const handleCallEnded = (callData) => {
      const { incomingCall, clearIncomingCall } = useAppStore.getState();

      if (incomingCall?.callId && incomingCall.callId === callData?.callId) {
        clearIncomingCall();
      }

      if (String(callData?.fromUserId || "") === String(userInfo?.id || "")) {
        return;
      }

      if (callData?.reason === "rejected") {
        toast.info("Звонок был отклонён.");
        return;
      }

      if (callData?.reason === "empty") {
        toast.info("В звонке больше никого не осталось.");
        return;
      }

      if (callData?.reason === "no-users-to-invite") {
        toast.info("Больше некого приглашать в звонок.");
        return;
      }

      toast.info("Звонок завершён.");
    };

    socketInstance.on("recieveMessage", handleRecieveMessage);
    socketInstance.on("recieve-channel-message", handleRecieveChannelMessage);
    socketInstance.on("channel-updated", handleChannelUpdated);
    socketInstance.on("channel-deleted", handleChannelDeleted);
    socketInstance.on("channel-member-removed", handleChannelMemberRemoved);
    socketInstance.on("incoming-call", handleIncomingCall);
    socketInstance.on("call-accepted", handleCallAccepted);
    socketInstance.on("call-rejected", handleCallRejected);
    socketInstance.on("call-ended", handleCallEnded);

    return () => {
      socketInstance.off("recieveMessage", handleRecieveMessage);
      socketInstance.off("recieve-channel-message", handleRecieveChannelMessage);
      socketInstance.off("channel-updated", handleChannelUpdated);
      socketInstance.off("channel-deleted", handleChannelDeleted);
      socketInstance.off("channel-member-removed", handleChannelMemberRemoved);
      socketInstance.off("incoming-call", handleIncomingCall);
      socketInstance.off("call-accepted", handleCallAccepted);
      socketInstance.off("call-rejected", handleCallRejected);
      socketInstance.off("call-ended", handleCallEnded);
      socketInstance.disconnect();
      setSocket(null);
    };
  }, [userInfo]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
};