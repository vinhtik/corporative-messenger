import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { apiClient } from "@/lib/api-client";
import { useAppStore } from "@/store";
import {
  CONTACT_PROFILE_ROUTE,
  GET_CHANNEL_ROUTE,
} from "@/utils/constants";
import { PUSH_OPEN_CHAT_EVENT } from "@/lib/push-notifications";

const normalizePushPayload = (payload = {}) => ({
  type: payload?.type || "",
  chatType: payload?.chatType || "contact",
  senderId: payload?.senderId || "",
  recipientId: payload?.recipientId || "",
  channelId: payload?.channelId || "",
});

const PushActionRouterBridge = () => {
  const navigate = useNavigate();

  useEffect(() => {
    let isHandling = false;

    const openFromPayload = async (rawPayload) => {
      if (isHandling) return;

      const payload = normalizePushPayload(rawPayload);
      if (payload.type && payload.type !== "message") return;

      const {
        userInfo,
        setSelectedChatType,
        setSelectedChatData,
        setSelectedChatMessages,
      } = useAppStore.getState();

      try {
        isHandling = true;

        if (payload.chatType === "channel" && payload.channelId) {
          const response = await apiClient.get(
            `${GET_CHANNEL_ROUTE}/${payload.channelId}`,
            { withCredentials: true }
          );

          const channel = response.data?.channel;
          if (!channel?._id) {
            throw new Error("Channel data not found");
          }

          setSelectedChatType("channel");
          setSelectedChatData(channel);
          setSelectedChatMessages([]);
          navigate("/chat");

          return;
        }

        const currentUserId = String(userInfo?.id || "");
        const contactId =
          String(payload.senderId) === currentUserId
            ? payload.recipientId
            : payload.senderId;

        if (!contactId) {
          throw new Error("Contact id is missing in push payload");
        }

        const response = await apiClient.get(
          `${CONTACT_PROFILE_ROUTE}/${contactId}`,
          { withCredentials: true }
        );

        const contact = response.data?.user;
        if (!contact?._id) {
          throw new Error("Contact data not found");
        }

        setSelectedChatType("contact");
        setSelectedChatData(contact);
        setSelectedChatMessages([]);
        navigate("/chat");
      } catch (error) {
        console.log("open chat from push error", error);
        toast.error("Не удалось открыть чат из уведомления");
      } finally {
        isHandling = false;
        if (typeof window !== "undefined") {
          window.__pendingPushOpenChat = null;
        }
      }
    };

    const handlePushOpenChat = (event) => {
      openFromPayload(event.detail);
    };

    window.addEventListener(PUSH_OPEN_CHAT_EVENT, handlePushOpenChat);

    if (typeof window !== "undefined" && window.__pendingPushOpenChat) {
      openFromPayload(window.__pendingPushOpenChat);
    }

    return () => {
      window.removeEventListener(PUSH_OPEN_CHAT_EVENT, handlePushOpenChat);
    };
  }, [navigate]);

  return null;
};

export default PushActionRouterBridge;

