import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { apiClient } from "@/lib/api-client";

export const PUSH_OPEN_CHAT_EVENT = "push:open-chat";

export const initPushNotifications = async () => {
  if (Capacitor.getPlatform() !== "android") {
    return;
  }

  await PushNotifications.createChannel({
    id: "messages",
    name: "Messages",
    description: "Уведомления о новых сообщениях",
    importance: 5,
    visibility: 1,
    sound: "default",
  });

  let permStatus = await PushNotifications.checkPermissions();

  if (permStatus.receive === "prompt") {
    permStatus = await PushNotifications.requestPermissions();
  }

  if (permStatus.receive !== "granted") {
    console.log("Push permission denied");
    return;
  }

  await PushNotifications.addListener("registration", async (token) => {
    console.log("Push token:", token.value);

    try {
      await apiClient.post(
        "api/auth/push-token",
        { token: token.value },
        { withCredentials: true }
      );
    } catch (error) {
      console.log("save push token error", error);
    }
  });

  await PushNotifications.addListener("registrationError", (error) => {
    console.log("push registration error", error);
  });

  await PushNotifications.addListener("pushNotificationReceived", (notification) => {
    console.log("push received", notification);
  });

  await PushNotifications.addListener("pushNotificationActionPerformed", (event) => {
    const payload = event?.notification?.data || {};

    console.log("push action", event);

    if (typeof window === "undefined") {
      return;
    }

    window.__pendingPushOpenChat = payload;
    window.dispatchEvent(
      new CustomEvent(PUSH_OPEN_CHAT_EVENT, {
        detail: payload,
      })
    );
  });

  await PushNotifications.register();
};

