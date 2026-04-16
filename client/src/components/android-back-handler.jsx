import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { useAppStore } from "@/store";

const AndroidBackHandler = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (Capacitor.getPlatform() !== "android") {
      return;
    }

    let listenerHandle = null;

    const setupListener = async () => {
      listenerHandle = await CapacitorApp.addListener(
        "backButton",
        ({ canGoBack }) => {
          const {
            selectedChatType,
            profileViewerOpen,
            closeProfileViewer,
            closeChat,
          } = useAppStore.getState();

          // Сначала закрываем просмотр профиля, если он открыт
          if (profileViewerOpen) {
            closeProfileViewer();
            return;
          }

          // Если мы на /chat и открыт конкретный чат — закрываем его
          if (location.pathname === "/chat" && selectedChatType !== undefined) {
            closeChat();
            return;
          }

          // Со звонка или профиля возвращаем в чат
          if (
            location.pathname === "/profile" ||
            location.pathname.startsWith("/call/")
          ) {
            navigate("/chat", { replace: true });
            return;
          }

          // Обычный шаг назад по истории
          if (canGoBack) {
            navigate(-1);
            return;
          }

          // Если идти некуда — сворачиваем приложение
          CapacitorApp.minimizeApp();
        }
      );
    };

    setupListener();

    return () => {
      listenerHandle?.remove?.();
    };
  }, [location.pathname, navigate]);

  return null;
};

export default AndroidBackHandler;

