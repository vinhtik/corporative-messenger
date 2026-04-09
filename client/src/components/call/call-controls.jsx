import {
  Mic,
  MicOff,
  MonitorUp,
  PhoneOff,
  Video,
  VideoOff,
} from "lucide-react";

const baseButtonClass =
  "h-14 w-14 rounded-full flex items-center justify-center transition-all duration-200";
const neutralButtonClass = `${baseButtonClass} bg-[#232531] text-white hover:bg-[#2d3040]`;
const activeButtonClass = `${baseButtonClass} bg-green-600 text-white hover:bg-green-700`;
const dangerButtonClass = `${baseButtonClass} bg-red-600 text-white hover:bg-red-700`;

const CallControls = ({
  isMicEnabled,
  isCameraEnabled,
  isScreenSharing,
  onToggleMicrophone,
  onToggleCamera,
  onToggleScreenShare,
  onEndCall,
  mode = "audio",
}) => {
  return (
    <div className="px-6 py-5 flex items-center justify-center gap-4">
      <button
        type="button"
        onClick={onToggleMicrophone}
        className={isMicEnabled ? activeButtonClass : neutralButtonClass}
        title={isMicEnabled ? "Выключить микрофон" : "Включить микрофон"}
      >
        {isMicEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
      </button>

      {mode === "video" && (
        <>
          <button
            type="button"
            onClick={onToggleCamera}
            className={isCameraEnabled ? activeButtonClass : neutralButtonClass}
            title={isCameraEnabled ? "Выключить камеру" : "Включить камеру"}
          >
            {isCameraEnabled ? (
              <Video className="h-5 w-5" />
            ) : (
              <VideoOff className="h-5 w-5" />
            )}
          </button>

          <button
            type="button"
            onClick={onToggleScreenShare}
            className={isScreenSharing ? activeButtonClass : neutralButtonClass}
            title={
              isScreenSharing
                ? "Остановить демонстрацию экрана"
                : "Начать демонстрацию экрана"
            }
          >
            <MonitorUp className="h-5 w-5" />
          </button>
        </>
      )}

      <button
        type="button"
        onClick={onEndCall}
        className={dangerButtonClass}
        title="Завершить звонок"
      >
        <PhoneOff className="h-5 w-5" />
      </button>
    </div>
  );
};

export default CallControls;