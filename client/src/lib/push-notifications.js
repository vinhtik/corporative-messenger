import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { LocalNotifications } from "@capacitor/local-notifications";
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

  await LocalNotifications.createChannel({
    id: "messages",
    name: "Messages",
    description: "Уведомления о новых сообщениях",
    importance: 5,
    visibility: 1,
    sound: "default",
  });

  let pushPermStatus = await PushNotifications.checkPermissions();
  if (pushPermStatus.receive === "prompt") {
    pushPermStatus = await PushNotifications.requestPermissions();
  }

  if (pushPermStatus.receive !== "granted") {
    console.log("Push permission denied");
    return;
  }

  let localPermStatus = await LocalNotifications.checkPermissions();
  if (localPermStatus.display === "prompt") {
    localPermStatus = await LocalNotifications.requestPermissions();
  }

  await PushNotifications.removeAllListeners();

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

  await PushNotifications.addListener("pushNotificationReceived", async (notification) => {
    console.log("push received", notification);

    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: Date.now(),
            title: notification.title || "Новое сообщение",
            body: notification.body || "",
            channelId: "messages",
            extra: notification.data || {},
          },
        ],
      });
    } catch (error) {
      console.log("local notification schedule error", error);
    }
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

  await LocalNotifications.addListener("localNotificationActionPerformed", (event) => {
    const payload = event?.notification?.extra || {};

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

