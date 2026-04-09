import { useEffect, useRef } from "react";
import { Phone, Video } from "lucide-react";

const attachStream = (element, stream) => {
  if (!element) {
    return;
  }

  if (element.srcObject !== stream) {
    element.srcObject = stream || null;
  }
};

const VideoCard = ({
  title,
  stream,
  muted = false,
  isVideoEnabled = true,
  placeholderText,
}) => {
  const videoRef = useRef(null);

  useEffect(() => {
    attachStream(videoRef.current, stream);
  }, [stream]);

  const hasVideoTrack = Boolean(
    stream?.getVideoTracks?.().some((track) => track.readyState === "live")
  );

  return (
    <div className="rounded-2xl overflow-hidden border border-[#2f303b] bg-black min-h-[260px] relative">
      <div className="px-3 py-2 bg-[#181920] text-sm text-white border-b border-[#2f303b]">
        {title}
      </div>

      <div className="relative h-[320px] bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted}
          className={`h-full w-full object-cover ${
            hasVideoTrack && isVideoEnabled ? "block" : "hidden"
          }`}
        />

        {(!hasVideoTrack || !isVideoEnabled) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-neutral-400 gap-3">
            {isVideoEnabled ? (
              <Video className="h-10 w-10" />
            ) : (
              <Phone className="h-10 w-10" />
            )}
            <p className="text-sm">{placeholderText}</p>
          </div>
        )}
      </div>
    </div>
  );
};

const CallVideos = ({
  localStream,
  remoteStream,
  isCameraEnabled,
  mode = "audio",
}) => {
  return (
    <div className="h-full w-full p-4 grid grid-cols-1 md:grid-cols-2 gap-4 overflow-auto">
      <VideoCard
        title="Вы"
        stream={localStream}
        muted={true}
        isVideoEnabled={mode === "video" ? isCameraEnabled : false}
        placeholderText={mode === "video" ? "Камера выключена" : "Голосовой режим"}
      />

      <VideoCard
        title="Собеседник"
        stream={remoteStream}
        muted={false}
        isVideoEnabled={true}
        placeholderText="Ожидание видео собеседника"
      />
    </div>
  );
};

export default CallVideos;