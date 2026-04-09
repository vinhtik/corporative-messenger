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

const getParticipantName = (user, fallback) => {
  if (!user) {
    return fallback;
  }

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();

  if (fullName) {
    return fullName;
  }

  return user.email || fallback;
};

const VideoCard = ({
  title,
  stream,
  muted = false,
  forcePlaceholder = false,
  placeholderText,
  mirror = false,
}) => {
  const videoRef = useRef(null);

  useEffect(() => {
    attachStream(videoRef.current, stream);
  }, [stream]);

  const hasVideoTrack = Boolean(
    stream?.getVideoTracks?.().some(
      (track) => track.readyState === "live" && track.enabled
    )
  );

  const showPlaceholder = forcePlaceholder || !hasVideoTrack;

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
          className={`h-full w-full object-cover ${mirror ? "scale-x-[-1]" : ""} ${
            showPlaceholder ? "hidden" : "block"
          }`}
        />

        {showPlaceholder && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-neutral-400 gap-3">
            {placeholderText?.toLowerCase().includes("аудио") ? (
              <Phone className="h-10 w-10" />
            ) : (
              <Video className="h-10 w-10" />
            )}
            <p className="text-sm text-center px-4">{placeholderText}</p>
          </div>
        )}
      </div>
    </div>
  );
};

const CallVideos = ({
  localStream,
  remoteParticipants = [],
  isCameraEnabled,
  isScreenSharing,
  mode = "audio",
}) => {
  const gridClass =
    remoteParticipants.length >= 2
      ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
      : "grid-cols-1 md:grid-cols-2";

  return (
    <div className={`h-full w-full p-4 grid ${gridClass} gap-4 overflow-auto`}>
      <VideoCard
        title="Вы"
        stream={localStream}
        muted={true}
        mirror={true}
        forcePlaceholder={mode === "audio" ? true : !(isCameraEnabled || isScreenSharing)}
        placeholderText={
          mode === "audio"
            ? "Голосовой режим"
            : isScreenSharing
            ? "Демонстрация экрана"
            : "Камера выключена"
        }
      />

      {remoteParticipants.map((participant) => (
        <VideoCard
          key={participant.peerID}
          title={getParticipantName(participant.user, "Участник")}
          stream={participant.stream}
          muted={false}
          forcePlaceholder={false}
          placeholderText="Ожидание видео участника"
        />
      ))}

      {!remoteParticipants.length && (
        <VideoCard
          title="Собеседник"
          stream={null}
          muted={false}
          forcePlaceholder={true}
          placeholderText="Ожидание подключения участника"
        />
      )}
    </div>
  );
};

export default CallVideos;