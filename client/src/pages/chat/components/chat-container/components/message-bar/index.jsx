import { useSocket } from "@/context/SocketContext";
import { apiClient } from "@/lib/api-client";
import {
  releaseManagedOwner,
  requestManagedUserMedia,
  warmupManagedMedia,
} from "@/lib/media-device-manager";
import { useAppStore } from "@/store";
import { UPLOAD_FILE_ROUTE } from "@/utils/constants";
import EmojiPicker from "emoji-picker-react";
import { useEffect, useRef, useState } from "react";
import { GrAttachment } from "react-icons/gr";
import {
  IoCheckmark,
  IoLockClosed,
  IoMic,
  IoSend,
  IoStopCircle,
  IoTrash,
  IoVideocam,
} from "react-icons/io5";
import { RiEmojiStickerLine } from "react-icons/ri";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

const MAX_VIDEO_NOTE_SECONDS = 60;
const RECORDER_MEDIA_OWNER = "message-recorder";
const LOCK_THRESHOLD_PX = 70;

const formatDuration = (totalSeconds = 0) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
    2,
    "0"
  )}`;
};

const pickSupportedMimeType = (candidates = []) => {
  if (typeof MediaRecorder === "undefined") return "";
  if (typeof MediaRecorder.isTypeSupported !== "function") {
    return candidates[0] || "";
  }

  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
};

const getExtensionFromMimeType = (mimeType = "") => {
  const cleanMimeType = mimeType.split(";")[0].trim().toLowerCase();

  if (cleanMimeType.includes("audio/ogg")) return "ogg";
  if (cleanMimeType.includes("audio/mpeg")) return "mp3";
  if (cleanMimeType.includes("audio/mp4")) return "m4a";
  if (cleanMimeType.includes("audio/wav")) return "wav";
  if (cleanMimeType.includes("video/mp4")) return "mp4";
  if (cleanMimeType.includes("video/quicktime")) return "mov";

  return "webm";
};

const getConstraintsForMode = (mode, facingMode = "user") => {
  if (mode === "video-note") {
    return {
      audio: true,
      video: {
        facingMode: { ideal: facingMode },
        width: { ideal: 720 },
        height: { ideal: 720 },
        aspectRatio: 1,
      },
    };
  }

  return {
    audio: true,
    video: false,
  };
};

const MessageBar = () => {
  const emojiRef = useRef(null);
  const fileInputRef = useRef(null);
  const videoPreviewRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const recordingSecondsRef = useRef(0);
  const discardOnStopRef = useRef(false);
  const autoSendOnStopRef = useRef(false);
  const recordedPreviewUrlRef = useRef("");
  const holdToRecordRef = useRef(false);
  const activePointerIdRef = useRef(null);
  const pointerStartYRef = useRef(0);

  const socket = useSocket();

  const {
    selectedChatType,
    selectedChatData,
    userInfo,
    setIsUploading,
    setFileUploadProgress,
  } = useAppStore();

  const [message, setMessage] = useState("");
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

  const [preferredRecordingMode, setPreferredRecordingMode] = useState("audio");
  const [videoFacingMode, setVideoFacingMode] = useState("user");
  const [grantedMedia, setGrantedMedia] = useState({
    audio: false,
    video: false,
  });

  const [recordingMode, setRecordingMode] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isLockedRecording, setIsLockedRecording] = useState(false);
  const [isSwitchingCamera, setIsSwitchingCamera] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [lockGuideProgress, setLockGuideProgress] = useState(0);

  const [recordedBlob, setRecordedBlob] = useState(null);
  const [recordedPreviewUrl, setRecordedPreviewUrl] = useState("");
  const [recordedMimeType, setRecordedMimeType] = useState("");
  const [recordedDuration, setRecordedDuration] = useState(0);
  const [isSendingRecordedMedia, setIsSendingRecordedMedia] = useState(false);

  const isMobile =
    typeof window !== "undefined" ? window.innerWidth < 640 : false;

  const isMediaDraftActive = isRecording || Boolean(recordedBlob);
  const hasTypedMessage = Boolean(message.trim());
  const showLockGuide =
    !hasTypedMessage && isRecording && !recordedBlob && !isSendingRecordedMedia;

  useEffect(() => {
    function handleClickOutside(event) {
      if (emojiRef.current && !emojiRef.current.contains(event.target)) {
        setEmojiPickerOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = null;
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      stopRecordingTimer();

      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        mediaRecorderRef.current.stop();
      }

      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = null;
      }

      mediaStreamRef.current = null;
      revokeRecordedPreviewUrl();
      releaseManagedOwner(RECORDER_MEDIA_OWNER);
    };
  }, []);

  const attachPreviewStream = async (stream) => {
    if (!videoPreviewRef.current || !stream) return;

    try {
      videoPreviewRef.current.srcObject = stream;
      await videoPreviewRef.current.play();
    } catch (error) {
      console.log("preview play error", error);
    }
  };

  const revokeRecordedPreviewUrl = () => {
    if (recordedPreviewUrlRef.current) {
      URL.revokeObjectURL(recordedPreviewUrlRef.current);
      recordedPreviewUrlRef.current = "";
    }
  };

  const stopRecordingTimer = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const resetRecordingClock = () => {
    recordingSecondsRef.current = 0;
    setRecordingSeconds(0);
  };

  const resetGestureState = () => {
    holdToRecordRef.current = false;
    activePointerIdRef.current = null;
    pointerStartYRef.current = 0;
    setLockGuideProgress(0);
  };

  const clearRecordedDraft = () => {
    revokeRecordedPreviewUrl();
    setRecordedBlob(null);
    setRecordedPreviewUrl("");
    setRecordedMimeType("");
    setRecordedDuration(0);
    setIsSendingRecordedMedia(false);
  };

  const discardRecordedMedia = () => {
    clearRecordedDraft();
    setRecordingMode(null);
    setIsRecording(false);
    setIsLockedRecording(false);
    setIsSwitchingCamera(false);
    autoSendOnStopRef.current = false;
    discardOnStopRef.current = false;
    resetRecordingClock();
    resetGestureState();
  };

  const hasPermissionForMode = (mode) => {
    if (mode === "video-note") {
      return grantedMedia.audio && grantedMedia.video;
    }

    return grantedMedia.audio;
  };

  const requestMediaPermission = async (mode, facingMode = videoFacingMode) => {
    await warmupManagedMedia({
      constraints: getConstraintsForMode(mode, facingMode),
    });

    setGrantedMedia((prev) => ({
      audio: true,
      video: prev.video || mode === "video-note",
    }));
  };

  const handleAddEmoji = (emoji) => {
    setMessage((prev) => prev + emoji.emoji);
  };

  const togglePreferredRecordingMode = async () => {
    if (isMediaDraftActive || isSendingRecordedMedia) return;

    const nextMode =
      preferredRecordingMode === "audio" ? "video-note" : "audio";

    setPreferredRecordingMode(nextMode);

    try {
      if (!hasPermissionForMode(nextMode)) {
        await requestMediaPermission(nextMode);
      }
    } catch (error) {
      console.log({ error });
    }
  };

  const switchCameraDuringRecording = async () => {
    if (
      !isRecording ||
      recordingMode !== "video-note" ||
      !mediaStreamRef.current ||
      isSwitchingCamera
    ) {
      return;
    }

    try {
      setIsSwitchingCamera(true);

      const nextFacingMode =
        videoFacingMode === "user" ? "environment" : "user";

      const replacementStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: nextFacingMode },
          width: { ideal: 720 },
          height: { ideal: 720 },
          aspectRatio: 1,
        },
      });

      const nextVideoTrack = replacementStream.getVideoTracks()[0];
      if (!nextVideoTrack) {
        throw new Error("New camera track was not created");
      }

      const currentStream = mediaStreamRef.current;
      const oldVideoTracks = currentStream.getVideoTracks();

      oldVideoTracks.forEach((track) => {
        try {
          currentStream.removeTrack(track);
        } catch (error) {
          console.log("remove old track error", error);
        }

        try {
          track.stop();
        } catch (error) {
          console.log("stop old track error", error);
        }
      });

      currentStream.addTrack(nextVideoTrack);
      await attachPreviewStream(currentStream);
      setVideoFacingMode(nextFacingMode);
    } catch (error) {
      console.log({ error });
      toast.error("Не удалось переключить камеру во время записи");
    } finally {
      setIsSwitchingCamera(false);
    }
  };

  const emitSocketMessage = ({
    messageType,
    content,
    fileUrl,
    mimeType,
    duration,
  }) => {
    if (!socket || !selectedChatData?._id || !userInfo?.id) {
      return;
    }

    const payload = {
      sender: userInfo.id,
      content,
      messageType,
      fileUrl,
      mimeType,
      duration,
    };

    if (selectedChatType === "contact") {
      socket.emit("sendMessage", {
        ...payload,
        recipient: selectedChatData._id,
      });
    } else if (selectedChatType === "channel") {
      socket.emit("send-channel-message", {
        ...payload,
        channelId: selectedChatData._id,
      });
    }
  };

  const uploadSelectedFile = async (file) => {
    try {
      const formData = new FormData();
      formData.append("file", file);

      setIsUploading(true);
      setFileUploadProgress(0);

      const response = await apiClient.post(UPLOAD_FILE_ROUTE, formData, {
        withCredentials: true,
        onUploadProgress: (data) => {
          if (!data.total) return;
          setFileUploadProgress(Math.round((100 * data.loaded) / data.total));
        },
      });

      return response.data;
    } catch (error) {
      console.log({ error });
      throw error;
    } finally {
      setIsUploading(false);
      setFileUploadProgress(0);
    }
  };

  const uploadAndEmitRecordedMedia = async ({
    blob,
    mode,
    mimeType,
    duration,
  }) => {
    setIsSendingRecordedMedia(true);

    try {
      const extension = getExtensionFromMimeType(mimeType);

      const fileName =
        mode === "audio"
          ? `voice-message-${Date.now()}.${extension}`
          : `video-note-${Date.now()}.${extension}`;

      const file = new File([blob], fileName, { type: mimeType });
      const response = await uploadSelectedFile(file);

      emitSocketMessage({
        messageType: mode,
        content: undefined,
        fileUrl: response.filePath,
        mimeType: response.mimeType,
        duration,
      });

      return true;
    } catch (error) {
      console.log({ error });
      toast.error("Не удалось отправить медиа");
      return false;
    } finally {
      setIsSendingRecordedMedia(false);
    }
  };

  const handleSendMessage = () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || isMediaDraftActive) return;

    emitSocketMessage({
      messageType: "text",
      content: trimmedMessage,
      fileUrl: undefined,
      mimeType: undefined,
      duration: undefined,
    });

    setMessage("");
  };

  const handleKeyDown = (e) => {
    if (isMediaDraftActive) return;

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleAttachmentClick = () => {
    if (isMediaDraftActive || isSendingRecordedMedia) return;
    fileInputRef.current?.click();
  };

  const handleAttachmentChange = async (event) => {
    try {
      const file = event.target.files?.[0];
      if (!file) return;

      const response = await uploadSelectedFile(file);

      emitSocketMessage({
        messageType: "file",
        content: undefined,
        fileUrl: response.filePath,
        mimeType: response.mimeType,
        duration: undefined,
      });

      event.target.value = "";
    } catch (error) {
      console.log({ error });
      toast.error("Не удалось отправить файл");
    }
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;

    if (!recorder || recorder.state === "inactive") {
      return;
    }

    recorder.stop();
    setIsRecording(false);
  };

  const cancelActiveRecording = () => {
    discardOnStopRef.current = true;
    autoSendOnStopRef.current = false;
    stopRecording();
  };

  const stopLockedRecordingToPreview = () => {
    autoSendOnStopRef.current = false;
    discardOnStopRef.current = false;
    stopRecording();
  };

  const sendLockedRecording = () => {
    autoSendOnStopRef.current = true;
    discardOnStopRef.current = false;
    stopRecording();
  };

  const startRecording = async (mode) => {
    try {
      if (isRecording || isSendingRecordedMedia) return;
      if (!selectedChatData?._id) return;

      if (!navigator.mediaDevices?.getUserMedia) {
        toast.error("Браузер не поддерживает запись медиа");
        return;
      }

      if (recordedBlob) {
        discardRecordedMedia();
      }

      const isVideoMode = mode === "video-note";
      const constraints = getConstraintsForMode(mode, videoFacingMode);

      const mimeCandidates = isVideoMode
        ? [
            "video/webm;codecs=vp9,opus",
            "video/webm;codecs=vp8,opus",
            "video/webm",
            "video/mp4",
          ]
        : [
            "audio/webm;codecs=opus",
            "audio/webm",
            "audio/ogg;codecs=opus",
            "audio/mp4",
          ];

      const selectedMimeType = pickSupportedMimeType(mimeCandidates);
      const fallbackMimeType = isVideoMode ? "video/webm" : "audio/webm";

      recordedChunksRef.current = [];
      discardOnStopRef.current = false;
      autoSendOnStopRef.current = false;
      clearRecordedDraft();
      setRecordingMode(mode);
      setIsRecording(true);
      setIsLockedRecording(false);
      setIsSwitchingCamera(false);
      resetRecordingClock();
      setLockGuideProgress(0);

      const stream = await requestManagedUserMedia({
        owner: RECORDER_MEDIA_OWNER,
        constraints,
        releaseDelayMs: 600,
      });

      mediaStreamRef.current = stream;

      if (mode === "video-note") {
        await attachPreviewStream(stream);
      }

      const recorder = selectedMimeType
        ? new MediaRecorder(stream, { mimeType: selectedMimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const duration = recordingSecondsRef.current;
        const finalMimeType =
          recorder.mimeType || selectedMimeType || fallbackMimeType;
        const shouldDiscard = discardOnStopRef.current;
        const shouldAutoSend = autoSendOnStopRef.current;

        stopRecordingTimer();

        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = null;
        }

        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
        discardOnStopRef.current = false;
        autoSendOnStopRef.current = false;
        setIsLockedRecording(false);
        setIsSwitchingCamera(false);
        resetGestureState();

        releaseManagedOwner(RECORDER_MEDIA_OWNER);

        if (shouldDiscard) {
          recordedChunksRef.current = [];
          setRecordingMode(null);
          resetRecordingClock();
          setIsRecording(false);
          return;
        }

        if (!recordedChunksRef.current.length) {
          recordedChunksRef.current = [];
          setRecordingMode(null);
          resetRecordingClock();
          setIsRecording(false);
          toast.error("Не удалось записать сообщение");
          return;
        }

        const blob = new Blob(recordedChunksRef.current, {
          type: finalMimeType,
        });

        recordedChunksRef.current = [];

        if (!blob.size) {
          setRecordingMode(null);
          resetRecordingClock();
          setIsRecording(false);
          toast.error("Не удалось записать сообщение");
          return;
        }

        if (shouldAutoSend) {
          void (async () => {
            const success = await uploadAndEmitRecordedMedia({
              blob,
              mode,
              mimeType: finalMimeType,
              duration,
            });

            if (success) {
              clearRecordedDraft();
              setRecordingMode(null);
              resetRecordingClock();
              setIsRecording(false);
            }
          })();

          return;
        }

        revokeRecordedPreviewUrl();
        const nextPreviewUrl = URL.createObjectURL(blob);
        recordedPreviewUrlRef.current = nextPreviewUrl;

        setRecordedBlob(blob);
        setRecordedPreviewUrl(nextPreviewUrl);
        setRecordedMimeType(finalMimeType);
        setRecordedDuration(duration);
        setRecordingSeconds(duration);
        setIsRecording(false);
      };

      recorder.start(250);

      recordingTimerRef.current = setInterval(() => {
        recordingSecondsRef.current += 1;
        setRecordingSeconds(recordingSecondsRef.current);

        if (
          mode === "video-note" &&
          recordingSecondsRef.current >= MAX_VIDEO_NOTE_SECONDS
        ) {
          autoSendOnStopRef.current = false;
          stopRecording();
        }
      }, 1000);
    } catch (error) {
      console.log({ error });
      stopRecordingTimer();

      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = null;
      }

      mediaStreamRef.current = null;
      mediaRecorderRef.current = null;
      setIsRecording(false);
      setRecordingMode(null);
      setIsLockedRecording(false);
      setIsSwitchingCamera(false);
      resetRecordingClock();
      resetGestureState();
      releaseManagedOwner(RECORDER_MEDIA_OWNER);
      toast.error("Не удалось получить доступ к микрофону или камере");
    }
  };

  const sendRecordedMedia = async () => {
    try {
      if (!recordedBlob || !recordingMode) return;

      const success = await uploadAndEmitRecordedMedia({
        blob: recordedBlob,
        mode: recordingMode,
        mimeType:
          recordedMimeType ||
          recordedBlob.type ||
          (recordingMode === "audio" ? "audio/webm" : "video/webm"),
        duration: recordedDuration || recordingSeconds || 0,
      });

      if (success) {
        discardRecordedMedia();
      }
    } catch (error) {
      console.log({ error });
      toast.error("Не удалось отправить медиа");
    }
  };

  const handleRecordPointerDown = async (event) => {
    if (hasTypedMessage || isMediaDraftActive || isSendingRecordedMedia) {
      return;
    }

    if (!selectedChatData?._id) return;

    if (typeof event.button === "number" && event.button !== 0) {
      return;
    }

    event.preventDefault();

    if (!hasPermissionForMode(preferredRecordingMode)) {
      try {
        await requestMediaPermission(preferredRecordingMode);

        toast.success(
          preferredRecordingMode === "audio"
            ? "Доступ к микрофону получен. Теперь зажми кнопку ещё раз."
            : "Доступ к камере и микрофону получен. Теперь зажми кнопку ещё раз."
        );
      } catch (error) {
        console.log({ error });
        toast.error("Без доступа к микрофону или камере запись не запустится");
      }

      return;
    }

    holdToRecordRef.current = true;
    activePointerIdRef.current = event.pointerId;
    pointerStartYRef.current = event.clientY;
    setLockGuideProgress(0);

    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch (error) {
      // ignore
    }

    await startRecording(preferredRecordingMode);

    if (!holdToRecordRef.current && mediaRecorderRef.current && !isLockedRecording) {
      stopRecording();
    }
  };

  const handleRecordPointerMove = (event) => {
    if (!isRecording || isLockedRecording) return;
    if (!holdToRecordRef.current) return;
    if (activePointerIdRef.current !== event.pointerId) return;

    const deltaY = pointerStartYRef.current - event.clientY;
    const progress = Math.max(0, Math.min(deltaY / LOCK_THRESHOLD_PX, 1));
    setLockGuideProgress(progress);

    if (deltaY >= LOCK_THRESHOLD_PX) {
      setIsLockedRecording(true);
      setLockGuideProgress(1);
      holdToRecordRef.current = false;

      try {
        event.currentTarget.releasePointerCapture?.(event.pointerId);
      } catch (error) {
        // ignore
      }
    }
  };

  const handleRecordPointerUp = (event) => {
    if (activePointerIdRef.current !== event.pointerId) return;

    try {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    } catch (error) {
      // ignore
    }

    activePointerIdRef.current = null;

    if (isLockedRecording) {
      holdToRecordRef.current = false;
      return;
    }

    if (!holdToRecordRef.current) return;

    holdToRecordRef.current = false;

    if (isRecording) {
      stopRecording();
    }
  };

  const handleRecordPointerCancel = (event) => {
    if (
      activePointerIdRef.current !== null &&
      activePointerIdRef.current !== event.pointerId
    ) {
      return;
    }

    try {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    } catch (error) {
      // ignore
    }

    activePointerIdRef.current = null;

    if (isLockedRecording) {
      holdToRecordRef.current = false;
      return;
    }

    holdToRecordRef.current = false;

    if (isRecording) {
      stopRecording();
    }
  };

  const renderModeIcon = (className = "text-2xl") => {
    return preferredRecordingMode === "audio" ? (
      <IoMic className={className} />
    ) : (
      <IoVideocam className={className} />
    );
  };

  const renderRecordingHeader = () => {
    if (recordingMode === "video-note") {
      return "Идет запись видеосообщения";
    }

    return "Идет запись голосового сообщения";
  };

  const renderVideoRecordingPanel = () => {
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="h-56 w-56 md:h-72 md:w-72 rounded-full overflow-hidden bg-black shadow-lg border border-white/10">
          <video
            ref={videoPreviewRef}
            autoPlay
            muted
            playsInline
            className="h-full w-full object-cover"
          />
        </div>

        <div className="text-center">
          <div className="text-sm font-medium text-white">
            {renderRecordingHeader()}
          </div>

          {!isLockedRecording ? (
            <div className="mt-1 flex items-center justify-center gap-2 text-xs text-white/60">
              <IoLockClosed className="text-sm" />
              <span>Потяни вверх до замка · {formatDuration(recordingSeconds)}</span>
            </div>
          ) : (
            <div className="mt-1 flex items-center justify-center gap-2 text-xs text-green-400">
              <IoLockClosed className="text-sm" />
              <span>Запись закреплена · {formatDuration(recordingSeconds)}</span>
            </div>
          )}

          <div className="mt-2 text-[11px] text-white/45">
            Камера: {videoFacingMode === "user" ? "фронтальная" : "задняя"}
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <button
            type="button"
            className="rounded-xl bg-white/5 p-3 text-white/70 transition-all hover:bg-white/10 hover:text-white disabled:opacity-50"
            onClick={switchCameraDuringRecording}
            disabled={isSwitchingCamera}
            title="Сменить камеру"
          >
            <RefreshCw
              className={`h-5 w-5 ${isSwitchingCamera ? "animate-spin" : ""}`}
            />
          </button>

          <button
            type="button"
            className="rounded-xl bg-white/5 p-3 text-white/70 transition-all hover:bg-white/10 hover:text-white"
            onClick={cancelActiveRecording}
            title="Удалить запись"
          >
            <IoTrash className="text-xl" />
          </button>

          <button
            type="button"
            className="rounded-xl bg-red-500/15 p-3 text-red-400 transition-all hover:bg-red-500/25"
            onClick={stopLockedRecordingToPreview}
            title="Остановить запись"
          >
            <IoStopCircle className="text-xl" />
          </button>

          {isLockedRecording && (
            <button
              type="button"
              className="rounded-xl bg-[#1fce4a] p-3 text-white transition-all hover:bg-[#1bda54ac] disabled:opacity-50"
              onClick={sendLockedRecording}
              disabled={isSendingRecordedMedia}
              title="Остановить и отправить"
            >
              <IoSend className="text-xl" />
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderAudioRecordingPanel = () => {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-400 shrink-0">
            <IoMic className="text-xl" />
          </div>

          <div className="min-w-0">
            <div className="text-sm font-medium text-white">
              {renderRecordingHeader()}
            </div>

            {!isLockedRecording ? (
              <div className="flex items-center gap-2 text-xs text-white/60">
                <IoLockClosed className="text-sm" />
                <span>
                  Потяни вверх до замка · {formatDuration(recordingSeconds)}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-green-400">
                <IoLockClosed className="text-sm" />
                <span>
                  Запись закреплена · {formatDuration(recordingSeconds)}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-xl bg-white/5 p-3 text-white/70 transition-all hover:bg-white/10 hover:text-white"
            onClick={cancelActiveRecording}
            title="Удалить запись"
          >
            <IoTrash className="text-xl" />
          </button>

          <button
            type="button"
            className="rounded-xl bg-red-500/15 p-3 text-red-400 transition-all hover:bg-red-500/25"
            onClick={stopLockedRecordingToPreview}
            title="Остановить запись"
          >
            <IoStopCircle className="text-xl" />
          </button>

          {isLockedRecording && (
            <button
              type="button"
              className="rounded-xl bg-[#1fce4a] p-3 text-white transition-all hover:bg-[#1bda54ac] disabled:opacity-50"
              onClick={sendLockedRecording}
              disabled={isSendingRecordedMedia}
              title="Остановить и отправить"
            >
              <IoSend className="text-xl" />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="shrink-0 min-h-16 md:min-h-20 bg-[#1c1d25] pb-[env(safe-area-inset-bottom)] px-2 md:px-8 md:mb-6">
      {(isRecording || recordedBlob) && (
        <div className="mb-3 rounded-2xl border border-white/10 bg-[#2a2b33] p-3 md:p-4">
          {isRecording ? (
            recordingMode === "video-note" ? (
              renderVideoRecordingPanel()
            ) : (
              renderAudioRecordingPanel()
            )
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {recordingMode === "audio" ? (
                  <audio
                    controls
                    preload="metadata"
                    src={recordedPreviewUrl}
                    className="max-w-full w-[260px]"
                  />
                ) : (
                  <div className="h-56 w-56 md:h-66 md:w-6 rounded-full overflow-hidden bg-black shrink-0">
                    <video
                      src={recordedPreviewUrl}
                      controls
                      playsInline
                      preload="metadata"
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}

                <div className="min-w-0">
                  <div className="text-sm font-medium text-white">
                    {recordingMode === "audio"
                      ? "Голосовое сообщение"
                      : "Видеосообщение"}
                  </div>
                  <div className="text-xs text-white/60">
                    {formatDuration(recordedDuration)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-xl bg-white/5 p-3 text-white/70 transition-all hover:bg-white/10 hover:text-white"
                  onClick={discardRecordedMedia}
                  disabled={isSendingRecordedMedia}
                  title="Удалить запись"
                >
                  <IoTrash className="text-xl" />
                </button>

                <button
                  type="button"
                  className="rounded-xl bg-[#1fce4a] p-3 text-white transition-all hover:bg-[#1bda54ac] disabled:opacity-50"
                  onClick={sendRecordedMedia}
                  disabled={isSendingRecordedMedia}
                  title="Отправить запись"
                >
                  <IoCheckmark className="text-xl" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-center gap-2 md:gap-4">
        <div className="flex-1 flex bg-[#2a2b33] px-2 rounded-xl items-center pr-3 md:pr-5">
          <textarea
            className="flex-1 md:p-5 p-2 bg-transparent rounded-xl focus:border-none focus:outline-none resize-none overflow-hidden disabled:opacity-60"
            placeholder={
              isMediaDraftActive
                ? "Сначала отправь или удали записанное сообщение"
                : "Введите сообщение"
            }
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={isMediaDraftActive}
          />

          <button
            className="text-neutral-500 focus:border-none focus:outline-none focus:text-white duration-200 transition-all disabled:opacity-50"
            onClick={handleAttachmentClick}
            type="button"
            disabled={isMediaDraftActive || isSendingRecordedMedia}
            title="Прикрепить файл"
          >
            <GrAttachment className="text-2xl" />
          </button>

          <input
            type="file"
            className="hidden"
            ref={fileInputRef}
            onChange={handleAttachmentChange}
          />

          <button
            className="text-neutral-500 focus:border-none focus:outline-none focus:text-white duration-200 transition-all ml-2 disabled:opacity-50"
            onClick={togglePreferredRecordingMode}
            type="button"
            disabled={isMediaDraftActive || isSendingRecordedMedia}
            title={
              preferredRecordingMode === "audio"
                ? "Сейчас выбран режим голосового сообщения. Нажми, чтобы переключить на видеосообщение"
                : "Сейчас выбран режим видеосообщения. Нажми, чтобы переключить на голосовое сообщение"
            }
          >
            {renderModeIcon("text-2xl")}
          </button>

          <div className="relative flex">
            <button
              className="text-neutral-500 focus:border-none focus:outline-none focus:text-white duration-200 transition-all ml-2 disabled:opacity-50"
              onClick={() => setEmojiPickerOpen((prev) => !prev)}
              type="button"
              disabled={isMediaDraftActive}
            >
              <RiEmojiStickerLine className="text-2xl" />
            </button>

            {emojiPickerOpen && !isMediaDraftActive && (
              <div className="absolute bottom-16 right-0 z-50" ref={emojiRef}>
                <EmojiPicker
                  theme="dark"
                  open={emojiPickerOpen}
                  onEmojiClick={handleAddEmoji}
                  autoFocusSearch={false}
                  width={isMobile ? 250 : 350}
                  height={isMobile ? 350 : 450}
                />
              </div>
            )}
          </div>
        </div>

        {hasTypedMessage ? (
          <button
            className="bg-[#1fce4a] rounded-xl flex items-center justify-center md:p-5 p-3 focus:border-none hover:bg-[#1bda54ac] focus:bg-[#1bda54ac] focus:outline-none focus:text-white duration-200 transition-all disabled:opacity-50"
            onClick={handleSendMessage}
            type="button"
            disabled={!message.trim() || isMediaDraftActive}
            title="Отправить сообщение"
          >
            <IoSend className="text-2xl" />
          </button>
        ) : (
          <div className="relative flex items-end justify-center w-[56px] md:w-[72px]">
            {showLockGuide && (
              <div
                className="pointer-events-none absolute bottom-[72px] md:bottom-[82px] inset-x-0 flex flex-col items-center"
                style={{
                  transform: `translateY(-${Math.round(
                    lockGuideProgress * 16
                  )}px)`,
                }}
              >
                <div
                  className={`h-12 w-12 rounded-full border flex items-center justify-center backdrop-blur-sm transition-all duration-150 ${
                    isLockedRecording
                      ? "border-green-400 bg-green-500/20 text-green-400"
                      : lockGuideProgress > 0.15
                      ? "border-white/50 bg-white/10 text-white"
                      : "border-white/20 bg-[#2a2b33]/90 text-white/60"
                  }`}
                >
                  <IoLockClosed className="text-xl" />
                </div>
              </div>
            )}

            <button
              className={`bg-[#1fce4a] rounded-xl flex items-center justify-center md:p-5 p-3 focus:border-none hover:bg-[#1bda54ac] focus:bg-[#1bda54ac] focus:outline-none focus:text-white duration-200 transition-all disabled:opacity-50 active:scale-95 touch-none ${
                isLockedRecording ? "ring-2 ring-green-400/60" : ""
              }`}
              type="button"
              onPointerDown={handleRecordPointerDown}
              onPointerMove={handleRecordPointerMove}
              onPointerUp={handleRecordPointerUp}
              onPointerCancel={handleRecordPointerCancel}
              onContextMenu={(e) => e.preventDefault()}
              disabled={isMediaDraftActive || isSendingRecordedMedia}
              title={
                preferredRecordingMode === "audio"
                  ? "Зажми для записи голосового сообщения"
                  : "Зажми для записи видеосообщения"
              }
            >
              {isLockedRecording ? (
                <IoLockClosed className="text-2xl" />
              ) : (
                renderModeIcon("text-2xl")
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageBar;
