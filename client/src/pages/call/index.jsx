import "@livekit/components-styles";
import {
  ParticipantTile,
  RoomAudioRenderer,
  RoomContext,
  useIsSpeaking,
  useTracks,
} from "@livekit/components-react";
import { useSocket } from "@/context/SocketContext";
import { apiClient } from "@/lib/api-client";
import {
  registerManagedExternalOwner,
  releaseManagedOwner,
} from "@/lib/media-device-manager";
import { useAppStore } from "@/store";
import { LIVEKIT_TOKEN_ROUTE } from "@/utils/constants";
import {
  ArrowLeft,
  Maximize2,
  Mic,
  MicOff,
  MonitorUp,
  Phone,
  PhoneOff,
  UserPlus,
  Video,
  VideoOff,
} from "lucide-react";
import { Room, RoomEvent, Track } from "livekit-client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

const baseButtonClass =
  "h-14 w-14 rounded-full flex items-center justify-center transition-all duration-200";
const neutralButtonClass = `${baseButtonClass} bg-[#232531] text-white hover:bg-[#2d3040]`;
const activeButtonClass = `${baseButtonClass} bg-green-600 text-white hover:bg-green-700`;
const dangerButtonClass = `${baseButtonClass} bg-red-600 text-white hover:bg-red-700`;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const buildUserPayload = (userInfo) => ({
  _id: userInfo.id,
  firstName: userInfo.firstName,
  lastName: userInfo.lastName,
  email: userInfo.email,
  image: userInfo.image,
  color: userInfo.color,
});

const parseMetadata = (participant) => {
  try {
    return JSON.parse(participant?.metadata || "{}");
  } catch {
    return {};
  }
};

const getParticipantLabel = (participant) => {
  if (!participant) {
    return "Участник";
  }

  const metadata = parseMetadata(participant);
  const metadataFullName = [metadata.firstName, metadata.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  if (participant.name) return participant.name;
  if (metadataFullName) return metadataFullName;
  if (metadata.email) return metadata.email;

  return participant.identity || "Участник";
};

const getTrackKey = (trackRef) => {
  const participantId =
    trackRef?.participant?.identity ||
    trackRef?.participant?.sid ||
    "unknown-participant";

  const source =
    trackRef?.source || trackRef?.publication?.source || "unknown-source";

  const publicationId =
    trackRef?.publication?.trackSid ||
    trackRef?.publication?.sid ||
    "placeholder";

  return `${participantId}:${source}:${publicationId}`;
};

const isScreenShareTrack = (trackRef) =>
  trackRef?.source === Track.Source.ScreenShare;

const getMapValues = (value) => {
  if (!value || typeof value.values !== "function") return [];
  return Array.from(value.values());
};

const stopLocalTrack = (track) => {
  try {
    track?.stop?.();
  } catch (error) {
    console.log("track.stop error", error);
  }

  try {
    track?.mediaStreamTrack?.stop?.();
  } catch (error) {
    console.log("mediaStreamTrack.stop error", error);
  }
};

const getCameraPublications = (room) => {
  const videoPublications = getMapValues(room?.localParticipant?.videoTrackPublications);
  return videoPublications.filter(
    (publication) => publication?.source === Track.Source.Camera
  );
};

const getMicrophonePublications = (room) => {
  return getMapValues(room?.localParticipant?.audioTrackPublications);
};

const getScreenSharePublications = (room) => {
  const videoPublications = getMapValues(room?.localParticipant?.videoTrackPublications);
  return videoPublications.filter(
    (publication) => publication?.source === Track.Source.ScreenShare
  );
};

const forceReleaseCamera = async (room) => {
  const localParticipant = room?.localParticipant;
  if (!localParticipant) return;

  try {
    await localParticipant.setCameraEnabled(false);
  } catch (error) {
    console.log("setCameraEnabled(false) error", error);
  }

  const cameraPublications = getCameraPublications(room);

  for (const publication of cameraPublications) {
    const track = publication?.track;
    if (!track) continue;

    try {
      localParticipant.unpublishTrack?.(track, true);
    } catch (error) {
      console.log("unpublishTrack(camera) error", error);
    }

    stopLocalTrack(track);
  }

  await wait(600);
};

const forceReleaseMicrophone = async (room) => {
  const localParticipant = room?.localParticipant;
  if (!localParticipant) return;

  try {
    await localParticipant.setMicrophoneEnabled(false);
  } catch (error) {
    console.log("setMicrophoneEnabled(false) error", error);
  }

  const microphonePublications = getMicrophonePublications(room);

  for (const publication of microphonePublications) {
    const track = publication?.track;
    if (!track) continue;

    try {
      localParticipant.unpublishTrack?.(track, true);
    } catch (error) {
      console.log("unpublishTrack(microphone) error", error);
    }

    stopLocalTrack(track);
  }

  await wait(300);
};

const forceReleaseScreenShare = async (room) => {
  const localParticipant = room?.localParticipant;
  if (!localParticipant) return;

  try {
    await localParticipant.setScreenShareEnabled(false);
  } catch (error) {
    console.log("setScreenShareEnabled(false) error", error);
  }

  const screenSharePublications = getScreenSharePublications(room);

  for (const publication of screenSharePublications) {
    const track = publication?.track;
    if (!track) continue;

    try {
      localParticipant.unpublishTrack?.(track, true);
    } catch (error) {
      console.log("unpublishTrack(screenShare) error", error);
    }

    stopLocalTrack(track);
  }
};

const disconnectRoomSafely = async (room) => {
  if (!room) return;

  await Promise.allSettled([
    forceReleaseScreenShare(room),
    forceReleaseCamera(room),
    forceReleaseMicrophone(room),
  ]);

  try {
    room.disconnect();
  } catch (error) {
    console.log("room.disconnect error", error);
  }
};

const getReadableMediaError = (error, fallbackText) => {
  const name = error?.name || "";
  const message = error?.message || "";
  const merged = `${name} ${message}`.trim();

  if (!merged) {
    return fallbackText;
  }

  return `${fallbackText} (${merged})`;
};

const isCameraBusyError = (error) => {
  const text = `${error?.name || ""} ${error?.message || ""}`.toLowerCase();

  return (
    text.includes("failed to allocate videosource") ||
    text.includes("notreadable") ||
    text.includes("device in use") ||
    text.includes("could not start video source") ||
    text.includes("starting video failed")
  );
};

const CallTile = ({ trackRef, isFocused = false, onClick }) => {
  const participant = trackRef?.participant;
  const isSpeaking = useIsSpeaking(participant);
  const title = getParticipantLabel(participant);
  const isScreen = isScreenShareTrack(trackRef);
  const isLocal = Boolean(participant?.isLocal);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative overflow-hidden rounded-2xl text-left transition-all duration-200 ${
        isFocused
          ? "h-full w-full bg-black border-2 border-green-500/40"
          : isSpeaking
          ? "h-full w-full bg-black border-2 border-green-500 shadow-[0_0_0_1px_rgba(34,197,94,0.3)]"
          : "h-full w-full bg-black border border-[#2f303b] hover:border-green-500/40"
      }`}
      title="Нажми, чтобы увеличить"
    >
      <ParticipantTile trackRef={trackRef} className="h-full w-full" />

      <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-black/70 px-3 py-1 text-xs text-white backdrop-blur">
          {title}
        </span>

        {isLocal && (
          <span className="rounded-full bg-[#1f2937]/80 px-2 py-1 text-[10px] uppercase tracking-wide text-white">
            Вы
          </span>
        )}

        {isScreen && (
          <span className="rounded-full bg-blue-600/80 px-2 py-1 text-[10px] uppercase tracking-wide text-white">
            Экран
          </span>
        )}
      </div>

      <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/60 p-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        <Maximize2 className="h-4 w-4 text-white" />
      </div>
    </button>
  );
};

const CallStage = ({ focusedTrackKey, onFocusChange }) => {
  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: true },
    { source: Track.Source.ScreenShare, withPlaceholder: false },
  ]);

  useEffect(() => {
    if (!focusedTrackKey) {
      const screenTrack = tracks.find((trackRef) => isScreenShareTrack(trackRef));

      if (screenTrack) {
        onFocusChange(getTrackKey(screenTrack));
      }

      return;
    }

    const exists = tracks.some(
      (trackRef) => getTrackKey(trackRef) === focusedTrackKey
    );

    if (!exists) {
      const screenTrack = tracks.find((trackRef) => isScreenShareTrack(trackRef));
      onFocusChange(screenTrack ? getTrackKey(screenTrack) : null);
    }
  }, [focusedTrackKey, tracks, onFocusChange]);

  const focusedTrack = useMemo(
    () => tracks.find((trackRef) => getTrackKey(trackRef) === focusedTrackKey) || null,
    [tracks, focusedTrackKey]
  );

  const secondaryTracks = useMemo(() => {
    if (!focusedTrack) {
      return tracks;
    }

    const focusedKey = getTrackKey(focusedTrack);

    return tracks.filter((trackRef) => getTrackKey(trackRef) !== focusedKey);
  }, [tracks, focusedTrack]);

  if (!tracks.length) {
    return (
      <div className="h-full w-full flex items-center justify-center text-neutral-400">
        Ожидание участников...
      </div>
    );
  }

  if (focusedTrack) {
    return (
      <div className="h-full w-full p-4 flex gap-4 overflow-hidden">
        <div className="min-w-0 flex-1">
          <CallTile
            trackRef={focusedTrack}
            isFocused={true}
            onClick={() => onFocusChange(null)}
          />
        </div>

        <div className="w-[340px] max-w-[40%] shrink-0 overflow-auto pr-1">
          <div className="grid grid-cols-1 gap-4 auto-rows-[200px]">
            {secondaryTracks.map((trackRef) => {
              const key = getTrackKey(trackRef);

              return (
                <CallTile
                  key={key}
                  trackRef={trackRef}
                  onClick={() => onFocusChange(key)}
                />
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  const gridClass =
    tracks.length <= 1
      ? "grid-cols-1"
      : tracks.length === 2
      ? "grid-cols-1 md:grid-cols-2"
      : tracks.length <= 4
      ? "grid-cols-1 md:grid-cols-2"
      : tracks.length <= 9
      ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
      : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4";

  return (
    <div className="h-full w-full p-4 overflow-auto">
      <div className={`grid ${gridClass} gap-4 auto-rows-[240px]`}>
        {tracks.map((trackRef) => {
          const key = getTrackKey(trackRef);

          return (
            <CallTile
              key={key}
              trackRef={trackRef}
              onClick={() => onFocusChange(key)}
            />
          );
        })}
      </div>
    </div>
  );
};

const CallPage = () => {
  const { callId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const socket = useSocket();
  const { userInfo } = useAppStore();

  const chatType = searchParams.get("chatType") === "channel" ? "channel" : "contact";
  const peerId = searchParams.get("peerId");
  const channelId = searchParams.get("channelId");
  const CALL_MEDIA_OWNER = `call:${callId}`;

  const room = useMemo(
    () =>
      new Room({
        adaptiveStream: true,
        dynacast: true,
      }),
    []
  );

  const isConnectedRef = useRef(false);
  const hadRemoteParticipantRef = useRef(false);
  const autoEndTimerRef = useRef(null);
  const isCleaningUpRef = useRef(false);

  const [focusedTrackKey, setFocusedTrackKey] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [participantsCount, setParticipantsCount] = useState(1);

  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const clearAutoEndTimer = useCallback(() => {
    if (autoEndTimerRef.current) {
      clearTimeout(autoEndTimerRef.current);
      autoEndTimerRef.current = null;
    }
  }, []);

  const syncLocalMediaState = useCallback(() => {
    setIsMicEnabled(Boolean(room.localParticipant?.isMicrophoneEnabled));
    setIsCameraEnabled(Boolean(room.localParticipant?.isCameraEnabled));
    setIsScreenSharing(Boolean(room.localParticipant?.isScreenShareEnabled));
  }, [room]);

  const syncCallOwnerRegistration = useCallback(async () => {
    const hasActiveMedia =
      Boolean(room.localParticipant?.isMicrophoneEnabled) ||
      Boolean(room.localParticipant?.isCameraEnabled) ||
      Boolean(room.localParticipant?.isScreenShareEnabled);

    if (!hasActiveMedia) {
      await releaseManagedOwner(CALL_MEDIA_OWNER);
      return;
    }

    await registerManagedExternalOwner({
      owner: CALL_MEDIA_OWNER,
      release: async () => {
        await Promise.allSettled([
          forceReleaseScreenShare(room),
          forceReleaseCamera(room),
          forceReleaseMicrophone(room),
        ]);
      },
    });
  }, [room, CALL_MEDIA_OWNER]);

  const cleanupRoom = useCallback(async () => {
    if (isCleaningUpRef.current) return;
    isCleaningUpRef.current = true;

    clearAutoEndTimer();

    try {
      await disconnectRoomSafely(room);
    } finally {
      await releaseManagedOwner(CALL_MEDIA_OWNER);
      isConnectedRef.current = false;
      hadRemoteParticipantRef.current = false;
      setIsConnected(false);
      setIsMicEnabled(false);
      setIsCameraEnabled(false);
      setIsScreenSharing(false);
      setParticipantsCount(0);
      setFocusedTrackKey(null);
    }
  }, [room, clearAutoEndTimer, CALL_MEDIA_OWNER]);

  const performLeave = useCallback(
    async (notifyServer = true) => {
      if (notifyServer) {
        socket?.emit("end-call", {
          callId,
          toUserId: peerId || null,
          channelId: channelId || null,
          chatType,
        });
      }

      socket?.emit("leave-call-room", { callId });

      await cleanupRoom();
      navigate("/chat");
    },
    [socket, callId, peerId, channelId, chatType, cleanupRoom, navigate]
  );

  useEffect(() => {
    if (!socket || !callId) {
      return;
    }

    const handleCallEnded = (payload) => {
      if (payload?.callId !== callId) {
        return;
      }

      performLeave(false);
    };

    socket.on("call-ended", handleCallEnded);

    return () => {
      socket.off("call-ended", handleCallEnded);
    };
  }, [socket, callId, performLeave]);

  useEffect(() => {
    if (!callId) {
      setErrorText("Не передан идентификатор звонка.");
      setIsLoading(false);
      return;
    }

    isCleaningUpRef.current = false;
    let cancelled = false;

    const syncRemoteParticipantState = (connectedValue = isConnectedRef.current) => {
      const remoteCount = room.remoteParticipants.size;

      setParticipantsCount(remoteCount + (connectedValue ? 1 : 0));

      if (remoteCount > 0) {
        hadRemoteParticipantRef.current = true;
        clearAutoEndTimer();
        return;
      }

      if (connectedValue && hadRemoteParticipantRef.current && !autoEndTimerRef.current) {
        toast.info("В комнате больше никого нет. Звонок завершится через 10 секунд.");

        autoEndTimerRef.current = setTimeout(() => {
          performLeave(true);
        }, 10000);
      }
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

        if (cancelled) {
          await disconnectRoomSafely(room);
          return;
        }

        socket?.emit("join-call-room", {
          callId,
          user: buildUserPayload(userInfo),
        });

        isConnectedRef.current = true;
        setIsConnected(true);
        syncLocalMediaState();
        syncRemoteParticipantState(true);
        setIsLoading(false);
      } catch (error) {
        console.log("connectToRoom error", error);
        setErrorText(
          getReadableMediaError(error, "Не удалось подключиться к звонку.")
        );
        setIsLoading(false);
      }
    };

    const handleConnected = () => {
      isConnectedRef.current = true;
      setIsConnected(true);
      syncLocalMediaState();
      syncRemoteParticipantState(true);
    };

    const handleDisconnected = () => {
      isConnectedRef.current = false;
      setIsConnected(false);
      syncLocalMediaState();
      syncRemoteParticipantState(false);
    };

    const handleParticipantConnected = () => {
      syncRemoteParticipantState(true);
    };

    const handleParticipantDisconnected = () => {
      syncRemoteParticipantState(true);
    };

    const handleMediaDevicesError = (error) => {
      console.log("LiveKit media device error", error);

      const cameraError = room.localParticipant?.lastCameraError || error;

      if (isCameraBusyError(cameraError)) {
        toast.error(
          "Камера занята или не успела освободиться. Закрой другие вкладки и приложения с камерой."
        );
      } else {
        toast.error(
          getReadableMediaError(error, "Ошибка доступа к камере или микрофону.")
        );
      }

      syncLocalMediaState();
    };

    room.on(RoomEvent.Connected, handleConnected);
    room.on(RoomEvent.Disconnected, handleDisconnected);
    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
    room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
    room.on(RoomEvent.MediaDevicesError, handleMediaDevicesError);

    connectToRoom();

    return () => {
      cancelled = true;
      clearAutoEndTimer();
      socket?.emit("leave-call-room", { callId });

      room.off(RoomEvent.Connected, handleConnected);
      room.off(RoomEvent.Disconnected, handleDisconnected);
      room.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
      room.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
      room.off(RoomEvent.MediaDevicesError, handleMediaDevicesError);

      cleanupRoom();
    };
  }, [
    callId,
    room,
    userInfo,
    chatType,
    socket,
    clearAutoEndTimer,
    performLeave,
    cleanupRoom,
    syncLocalMediaState,
  ]);

  const toggleMicrophone = async () => {
    const nextValue = !room.localParticipant.isMicrophoneEnabled;

    try {
      if (!nextValue) {
        await forceReleaseMicrophone(room);
        syncLocalMediaState();
        await syncCallOwnerRegistration();
        return;
      }

      await registerManagedExternalOwner({
        owner: CALL_MEDIA_OWNER,
        release: async () => {
          await Promise.allSettled([
            forceReleaseScreenShare(room),
            forceReleaseCamera(room),
            forceReleaseMicrophone(room),
          ]);
        },
      });

      await room.localParticipant.setMicrophoneEnabled(true);
      syncLocalMediaState();
      await syncCallOwnerRegistration();
    } catch (error) {
      console.log("toggleMicrophone error", error);
      toast.error(
        getReadableMediaError(
          room.localParticipant?.lastMicrophoneError || error,
          "Не удалось включить микрофон."
        )
      );
      syncLocalMediaState();
      await syncCallOwnerRegistration();
    }
  };

  const toggleCamera = async () => {
    const nextValue = !room.localParticipant.isCameraEnabled;

    try {
      if (!nextValue) {
        await forceReleaseCamera(room);
        syncLocalMediaState();
        await syncCallOwnerRegistration();
        return;
      }

      await registerManagedExternalOwner({
        owner: CALL_MEDIA_OWNER,
        release: async () => {
          await Promise.allSettled([
            forceReleaseScreenShare(room),
            forceReleaseCamera(room),
            forceReleaseMicrophone(room),
          ]);
        },
      });

      await room.localParticipant.setCameraEnabled(true);
      syncLocalMediaState();
      await syncCallOwnerRegistration();
    } catch (error) {
      console.log("toggleCamera error", error);

      const actualError = room.localParticipant?.lastCameraError || error;

      if (isCameraBusyError(actualError)) {
        try {
          await forceReleaseCamera(room);
          await wait(800);
          await room.localParticipant.setCameraEnabled(true);
          syncLocalMediaState();
          await syncCallOwnerRegistration();
          toast.success("Камера была перезапущена.");
          return;
        } catch (retryError) {
          console.log("toggleCamera retry error", retryError);
          toast.error(
            "Камера занята или не успела освободиться. Закрой другие вкладки и приложения с камерой и попробуй ещё раз."
          );
          syncLocalMediaState();
          await syncCallOwnerRegistration();
          return;
        }
      }

      toast.error(
        getReadableMediaError(actualError, "Не удалось включить камеру.")
      );
      syncLocalMediaState();
      await syncCallOwnerRegistration();
    }
  };

  const toggleScreenShare = async () => {
    try {
      const nextValue = !room.localParticipant.isScreenShareEnabled;

      if (!nextValue) {
        await forceReleaseScreenShare(room);
        syncLocalMediaState();
        await syncCallOwnerRegistration();
        return;
      }

      await registerManagedExternalOwner({
        owner: CALL_MEDIA_OWNER,
        release: async () => {
          await Promise.allSettled([
            forceReleaseScreenShare(room),
            forceReleaseCamera(room),
            forceReleaseMicrophone(room),
          ]);
        },
      });

      await room.localParticipant.setScreenShareEnabled(true);
      syncLocalMediaState();
      await syncCallOwnerRegistration();
    } catch (error) {
      console.log("toggleScreenShare error", error);
      toast.error(
        getReadableMediaError(
          error,
          "Не удалось включить демонстрацию экрана."
        )
      );
      syncLocalMediaState();
      await syncCallOwnerRegistration();
    }
  };

  const reinviteParticipants = () => {
    if (!socket || !channelId || !userInfo?.id) {
      return;
    }

    socket.emit("invite-channel-to-call", {
      callId,
      channelId,
      mode: "video",
      fromUser: buildUserPayload(userInfo),
    });

    toast.success("Оставшимся участникам отправлено приглашение.");
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
        <div className="h-[72px] shrink-0 border-b border-[#2f303b] px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-11 w-11 rounded-full bg-[#ffffff18] flex items-center justify-center shrink-0">
              <Phone className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <p className="text-lg font-semibold truncate">{title}</p>
              <p className="text-sm text-neutral-400 truncate">
                участников: {participantsCount} · {isConnected ? "connected" : "connecting"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {chatType === "channel" && (
              <button
                type="button"
                onClick={reinviteParticipants}
                className="inline-flex items-center gap-2 rounded-xl border border-[#2f303b] px-4 py-2 text-sm text-neutral-300 hover:bg-[#2a2c37] transition-all duration-200"
                title="Позвать тех, кто ещё не в звонке"
              >
                <UserPlus className="h-4 w-4" />
                Позвать
              </button>
            )}

            <button
              type="button"
              onClick={() => performLeave(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-[#2f303b] px-4 py-2 text-sm text-neutral-300 hover:bg-[#2a2c37] transition-all duration-200"
            >
              <ArrowLeft className="h-4 w-4" />
              Назад
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0">
          <RoomAudioRenderer />
          <CallStage
            focusedTrackKey={focusedTrackKey}
            onFocusChange={setFocusedTrackKey}
          />
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
            onClick={() => performLeave(true)}
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
