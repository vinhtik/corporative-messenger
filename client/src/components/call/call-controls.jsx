import { ArrowLeft, Phone, Video } from "lucide-react";
import { useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { useSocket } from "@/context/SocketContext";
import { usePeerCall } from "@/hooks/use-peer-call";

import CallVideos from "@/components/call/call-videos.jsx";
import CallControls from "@/components/call/call-controls.jsx";

const CallPage = () => {
  const { callId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const socket = useSocket();

  const mode = searchParams.get("mode") === "video" ? "video" : "audio";
  const peerId = searchParams.get("peerId");
  const isInitiator = searchParams.get("initiator") === "true";

  const {
    isLoading,
    errorText,
    callState,
    connectionState,
    iceConnectionState,
    localStream,
    remoteStream,
    isMicEnabled,
    isCameraEnabled,
    isScreenSharing,
    toggleMicrophone,
    toggleCamera,
    toggleScreenShare,
    endCall,
  } = usePeerCall({
    socket,
    callId,
    peerId,
    isInitiator,
    mode,
  });

  const title = useMemo(() => {
    switch (callState) {
      case "ringing":
        return "Исходящий звонок";
      case "connecting":
        return "Соединение...";
      case "connected":
        return "Звонок активен";
      case "ended":
        return "Звонок завершён";
      default:
        return mode === "video" ? "Видеозвонок" : "Голосовой звонок";
    }
  }, [callState, mode]);

  const HeaderIcon = mode === "video" ? Video : Phone;

  if (!peerId) {
    return (
      <div className="h-screen w-full bg-[#1c1d25] text-white flex items-center justify-center px-6">
        <div className="w-full max-w-xl rounded-2xl border border-[#2f303b] bg-[#181920] p-8 text-center">
          <p className="text-2xl font-semibold mb-3">Не хватает данных звонка</p>
          <p className="text-neutral-400 mb-6">
            Не передан идентификатор собеседника.
          </p>

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

  if (isLoading) {
    return (
      <div className="h-screen w-full bg-[#1c1d25] text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-2xl font-semibold mb-3">Подготовка звонка...</p>
          <p className="text-sm text-neutral-400">
            Открываются микрофон, камера и peer connection.
          </p>
        </div>
      </div>
    );
  }

  if (errorText && callState === "ended") {
    return (
      <div className="h-screen w-full bg-[#1c1d25] text-white flex items-center justify-center px-6">
        <div className="w-full max-w-xl rounded-2xl border border-[#2f303b] bg-[#181920] p-8 text-center">
          <p className="text-2xl font-semibold mb-3">Звонок завершён</p>
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
    <div className="h-screen w-full flex flex-col bg-[#1c1d25] text-white">
      <div className="h-[72px] shrink-0 border-b border-[#2f303b] px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-full bg-[#ffffff18] flex items-center justify-center">
            <HeaderIcon className="h-5 w-5" />
          </div>

          <div>
            <p className="text-lg font-semibold">{title}</p>
            <p className="text-sm text-neutral-400">
              state: {callState} · connection: {connectionState} · ice: {iceConnectionState}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            endCall();
            navigate("/chat");
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-[#2f303b] px-4 py-2 text-sm text-neutral-300 hover:bg-[#2a2c37] transition-all duration-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад
        </button>
      </div>

      <div className="flex-1 min-h-0">
        <CallVideos
          localStream={localStream}
          remoteStream={remoteStream}
          isCameraEnabled={isCameraEnabled}
          mode={mode}
        />
      </div>

      <div className="shrink-0 border-t border-[#2f303b] bg-[#181920]">
        <CallControls
          isMicEnabled={isMicEnabled}
          isCameraEnabled={isCameraEnabled}
          isScreenSharing={isScreenSharing}
          onToggleMicrophone={toggleMicrophone}
          onToggleCamera={toggleCamera}
          onToggleScreenShare={toggleScreenShare}
          onEndCall={() => {
            endCall();
            navigate("/chat");
          }}
          mode={mode}
        />
      </div>
    </div>
  );
};

export default CallPage;