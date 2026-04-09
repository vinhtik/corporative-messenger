import { useAppStore } from "@/store";
import { HOST } from "@/utils/constants";
import { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";
import { toast } from "sonner";

const SocketContext = createContext(null);

export const useSocket = () => {
  return useContext(SocketContext);
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

      if (
        selectedChatData &&
        selectedChatType !== undefined &&
        (selectedChatData._id === message.sender._id ||
          selectedChatData._id === message.recipient._id)
      ) {
        addMessage(message);
      }

      addContactsInDMContacts(message);
    };

    const handleRecieveChannelMessage = (message) => {
      const {
        selectedChatData,
        selectedChatType,
        addMessage,
        addChannelInChannelList,
      } = useAppStore.getState();

      if (
        selectedChatData &&
        selectedChatType !== undefined &&
        selectedChatData._id === message.channelId
      ) {
        addMessage(message);
      }

      addChannelInChannelList(message);
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

      if (callData?.reason === "rejected") {
        toast.info("Звонок был отклонён.");
        return;
      }

      toast.info("Звонок завершён.");
    };

    socketInstance.on("recieveMessage", handleRecieveMessage);
    socketInstance.on("recieve-channel-message", handleRecieveChannelMessage);
    socketInstance.on("incoming-call", handleIncomingCall);
    socketInstance.on("call-accepted", handleCallAccepted);
    socketInstance.on("call-rejected", handleCallRejected);
    socketInstance.on("call-ended", handleCallEnded);

    return () => {
      socketInstance.off("recieveMessage", handleRecieveMessage);
      socketInstance.off("recieve-channel-message", handleRecieveChannelMessage);
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