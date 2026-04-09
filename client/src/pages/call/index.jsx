import "@livekit/components-styles";
import {
  GridLayout,
  ParticipantTile,
  RoomAudioRenderer,
  RoomContext,
  useTracks,
} from "@livekit/components-react";
import { useSocket } from "@/context/SocketContext";
import { apiClient } from "@/lib/api-client";
import { useAppStore } from "@/store";
import { LIVEKIT_TOKEN_ROUTE } from "@/utils/constants";
import { ArrowLeft, Mic, MicOff, MonitorUp, Phone, PhoneOff, Video, VideoOff } from "lucide-react";
import { Room, RoomEvent, Track } from "livekit-client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

const CallGrid = () => {
  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: true },
    { source: Track.Source.ScreenShare, withPlaceholder: false },
  ]);

  return (
    <>
      <RoomAudioRenderer />
      <div className="h-full w-full p-4 overflow-auto">
        <GridLayout tracks={tracks}>
          <ParticipantTile />
        </GridLayout>
      </div>
    </>
  );
};

const baseButtonClass =
  "h-14 w-14 rounded-full flex items-center justify-center transition-all duration-200";
const neutralButtonClass = `${baseButtonClass} bg-[#232531] text-white hover:bg-[#2d3040]`;
const activeButtonClass = `${baseButtonClass} bg-green-600 text-white hover:bg-green-700`;
const dangerButtonClass = `${baseButtonClass} bg-red-600 text-white hover:bg-red-700`;

const buildUserPayload = (userInfo) => ({
  _id: userInfo.id,
  firstName: userInfo.firstName,
  lastName: userInfo.lastName,
  email: userInfo.email,
  image: userInfo.image,
  color: userInfo.color,
});

const CallPage = () => {
  const { callId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const socket = useSocket();
  const { userInfo } = useAppStore();

  const chatType = searchParams.get("chatType") === "channel" ? "channel" : "contact";
  const peerId = searchParams.get("peerId");
  const channelId = searchParams.get("channelId");

  const room = useMemo(
    () =>
      new Room({
        adaptiveStream: true,
        dynacast: true,
      }),
    []
  );

  const isConnectedRef = useRef(false);

  const [isLoading, setIsLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [participantsCount, setParticipantsCount] = useState(1);

  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  useEffect(() => {
    if (!socket || !callId) {
      return;
    }

    const handleCallEnded = (payload) => {
      if (payload?.callId !== callId) {
        return;
      }

      room.disconnect();
      navigate("/chat");
    };

    socket.on("call-ended", handleCallEnded);

    return () => {
      socket.off("call-ended", handleCallEnded);
    };
  }, [socket, callId, room, navigate]);

  useEffect(() => {
    if (!callId) {
      setErrorText("Не передан идентификатор звонка.");
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const updateParticipantsCount = (connectedValue = isConnectedRef.current) => {
      setParticipantsCount(room.remoteParticipants.size + (connectedValue ? 1 : 0));
    };

    const connectToRoom = async () => {
      try {
        setIsLoading(true);
        setErrorText("");

        const fullName = [userInfo?.firstName, userInfo?.lastName]
          .filter(Boolean)
          .join(" ")
          .trim();

        const response = await apiClient.post(
          LIVEKIT_TOKEN_ROUTE,
          {
            roomName: callId,
            name: fullName || userInfo?.email || `user-${userInfo?.id}`,
            metadata: {
              id: userInfo?.id,
              firstName: userInfo?.firstName || "",
              lastName: userInfo?.lastName || "",
              email: userInfo?.email || "",
              image: userInfo?.image || "",
              color: userInfo?.color ?? null,
              chatType,
            },
          },
          {
            withCredentials: true,
          }
        );

        const token = response.data?.token;
        const url = response.data?.url;

        if (!token || !url) {
          throw new Error("LiveKit token or url is missing");
        }

        await room.connect(url, token, {
          autoSubscribe: true,
        });

        await room.localParticipant.setMicrophoneEnabled(true);
        await room.localParticipant.setCameraEnabled(true);

        if (cancelled) {
          room.disconnect();
          return;
        }

        socket?.emit("join-call-room", {
          callId,
          user: buildUserPayload(userInfo),
        });

        isConnectedRef.current = true;
        setIsConnected(true);
        setIsMicEnabled(true);
        setIsCameraEnabled(true);
        setIsLoading(false);
        updateParticipantsCount(true);
      } catch (err) {
        console.log(err);
        setErrorText("Не удалось подключиться к звонку.");
        setIsLoading(false);
      }
    };

    const handleConnected = () => {
      isConnectedRef.current = true;
      setIsConnected(true);
      updateParticipantsCount(true);
    };

    const handleDisconnected = () => {
      isConnectedRef.current = false;
      setIsConnected(false);
      updateParticipantsCount(false);
    };

    const handleParticipantConnected = () => {
      updateParticipantsCount(true);
    };

    const handleParticipantDisconnected = () => {
      updateParticipantsCount(true);
    };

    room.on(RoomEvent.Connected, handleConnected);
    room.on(RoomEvent.Disconnected, handleDisconnected);
    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
    room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);

    connectToRoom();

    return () => {
      cancelled = true;

      socket?.emit("leave-call-room", { callId });

      room.off(RoomEvent.Connected, handleConnected);
      room.off(RoomEvent.Disconnected, handleDisconnected);
      room.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
      room.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);

      room.disconnect();
    };
  }, [callId, room, userInfo, chatType, socket]);

  const toggleMicrophone = async () => {
    try {
      const nextValue = !isMicEnabled;
      await room.localParticipant.setMicrophoneEnabled(nextValue);
      setIsMicEnabled(nextValue);
    } catch (err) {
      console.log(err);
    }
  };

  const toggleCamera = async () => {
    try {
      const nextValue = !isCameraEnabled;
      await room.localParticipant.setCameraEnabled(nextValue);
      setIsCameraEnabled(nextValue);
    } catch (err) {
      console.log(err);
    }
  };

  const toggleScreenShare = async () => {
    try {
      const nextValue = !isScreenSharing;
      await room.localParticipant.setScreenShareEnabled(nextValue);
      setIsScreenSharing(nextValue);
    } catch (err) {
      console.log(err);
    }
  };

  const endCall = () => {
    socket?.emit("end-call", {
      callId,
      toUserId: peerId || null,
      channelId: channelId || null,
      chatType,
    });

    room.disconnect();
    navigate("/chat");
  };

  const title = isConnected
    ? chatType === "channel"
      ? "Групповой звонок активен"
      : "Звонок активен"
    : chatType === "channel"
    ? "Групповой звонок"
    : "Звонок";

  if (isLoading) {
    return (
      <div className="h-screen w-full bg-[#1c1d25] text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-2xl font-semibold mb-3">Подключение к звонку...</p>
          <p className="text-sm text-neutral-400">
            Поднимается комната и публикуются медиа-треки.
          </p>
        </div>
      </div>
    );
  }

  if (errorText) {
    return (
      <div className="h-screen w-full bg-[#1c1d25] text-white flex items-center justify-center px-6">
        <div className="w-full max-w-xl rounded-2xl border border-[#2f303b] bg-[#181920] p-8 text-center">
          <p className="text-2xl font-semibold mb-3">Не удалось открыть звонок</p>
          <p className="text-neutral-400 mb-6">{errorText}</p>

          <button
            type="button"
            onClick={() => navigate("/chat")}
            className="inline-flex items-center gap-2 rounded-xl bg-green-700 px-5 py-3 text-white hover:bg-green-800 transition-all duration-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Вернуться в чат
          </button>
        </div>
      </div>
    );
  }

  return (
    <RoomContext.Provider value={room}>
      <div className="h-screen w-full flex flex-col bg-[#1c1d25] text-white">
        <div className="h-[72px] shrink-0 border-b border-[#2f303b] px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-full bg-[#ffffff18] flex items-center justify-center">
              <Phone className="h-5 w-5" />
            </div>

            <div>
              <p className="text-lg font-semibold">{title}</p>
              <p className="text-sm text-neutral-400">
                участников: {participantsCount} · {isConnected ? "connected" : "connecting"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={endCall}
            className="inline-flex items-center gap-2 rounded-xl border border-[#2f303b] px-4 py-2 text-sm text-neutral-300 hover:bg-[#2a2c37] transition-all duration-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Назад
          </button>
        </div>

        <div className="flex-1 min-h-0">
          <CallGrid />
        </div>

        <div className="shrink-0 border-t border-[#2f303b] bg-[#181920] px-6 py-5 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={toggleMicrophone}
            className={isMicEnabled ? activeButtonClass : neutralButtonClass}
            title={isMicEnabled ? "Выключить микрофон" : "Включить микрофон"}
          >
            {isMicEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </button>

          <button
            type="button"
            onClick={toggleCamera}
            className={isCameraEnabled ? activeButtonClass : neutralButtonClass}
            title={isCameraEnabled ? "Выключить камеру" : "Включить камеру"}
          >
            {isCameraEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </button>

          <button
            type="button"
            onClick={toggleScreenShare}
            className={isScreenSharing ? activeButtonClass : neutralButtonClass}
            title={
              isScreenSharing
                ? "Остановить демонстрацию экрана"
                : "Начать демонстрацию экрана"
            }
          >
            <MonitorUp className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={endCall}
            className={dangerButtonClass}
            title="Завершить звонок"
          >
            <PhoneOff className="h-5 w-5" />
          </button>
        </div>
      </div>
    </RoomContext.Provider>
  );
};

export default CallPage;