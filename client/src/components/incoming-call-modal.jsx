import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { useSocket } from "@/context/SocketContext";
import { getColor } from "@/lib/utils";
import { useAppStore } from "@/store";
import { HOST } from "@/utils/constants";
import { Phone, PhoneOff, Video } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const getDisplayName = (user) => {
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();

  if (fullName) {
    return fullName;
  }

  return user?.email || "Пользователь";
};

const getImageSrc = (image) => {
  if (!image) {
    return null;
  }

  if (image.startsWith("http://") || image.startsWith("https://")) {
    return image;
  }

  return `${HOST}/${image}`;
};

const buildUserPayload = (userInfo) => ({
  _id: userInfo.id,
  firstName: userInfo.firstName,
  lastName: userInfo.lastName,
  email: userInfo.email,
  image: userInfo.image,
  color: userInfo.color,
});

const IncomingCallModal = () => {
  const socket = useSocket();
  const navigate = useNavigate();

  const { incomingCall, clearIncomingCall, userInfo } = useAppStore();

  if (!incomingCall) {
    return null;
  }

  const caller = incomingCall.fromUser;
  const callerName = getDisplayName(caller);
  const isVideo = incomingCall.mode === "video";
  const imageSrc = getImageSrc(caller?.image);

  const acceptCall = () => {
    if (!socket || !userInfo?.id) {
      return;
    }

    if (incomingCall.chatType === "channel") {
      toast.info("Групповые WebRTC-звонки пока не включены.");
      clearIncomingCall();
      return;
    }

    socket.emit("accept-call", {
      callId: incomingCall.callId,
      mode: incomingCall.mode,
      chatType: incomingCall.chatType,
      toUserId: incomingCall.fromUser._id,
      fromUser: buildUserPayload(userInfo),
      channelId: incomingCall.channelId,
    });

    const nextUrl = `/call/${incomingCall.callId}?mode=${incomingCall.mode}&peerId=${incomingCall.fromUser._id}&initiator=false`;

    clearIncomingCall();
    navigate(nextUrl);
  };

  const rejectCall = () => {
    if (socket && userInfo?.id) {
      socket.emit("reject-call", {
        callId: incomingCall.callId,
        mode: incomingCall.mode,
        chatType: incomingCall.chatType,
        toUserId: incomingCall.fromUser._id,
        fromUser: buildUserPayload(userInfo),
        channelId: incomingCall.channelId,
      });
    }

    clearIncomingCall();
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-md flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-3xl border border-[#2f303b] bg-[#181920] p-8 text-white shadow-2xl">
        <div className="flex flex-col items-center text-center">
          <div className="mb-5">
            <Avatar className="h-24 w-24 rounded-full overflow-hidden">
              {imageSrc ? (
                <AvatarImage
                  src={imageSrc}
                  alt="caller"
                  className="object-cover w-full h-full bg-black"
                />
              ) : (
                <div
                  className={`uppercase h-24 w-24 text-3xl border-[0.1rem] flex items-center justify-center rounded-full ${getColor(
                    caller?.color
                  )}`}
                >
                  {callerName.charAt(0)}
                </div>
              )}
            </Avatar>
          </div>

          <p className="text-sm uppercase tracking-[0.25em] text-neutral-400 mb-2">
            Входящий звонок
          </p>

          <h2 className="text-2xl font-semibold mb-2">{callerName}</h2>

          {incomingCall.chatType === "channel" && incomingCall.channel?.name ? (
            <p className="text-neutral-400 mb-3">
              приглашает в группу <span className="text-white">{incomingCall.channel.name}</span>
            </p>
          ) : (
            <p className="text-neutral-400 mb-3">хочет начать разговор</p>
          )}

          <div className="flex items-center gap-2 rounded-full bg-[#232531] px-4 py-2 text-sm text-neutral-300">
            {isVideo ? <Video className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
            {isVideo ? "Видеозвонок" : "Голосовой звонок"}
          </div>

          <div className="mt-8 flex items-center gap-5">
            <button
              type="button"
              onClick={rejectCall}
              className="h-14 w-14 rounded-full bg-red-600 flex items-center justify-center hover:bg-red-700 transition-all duration-200"
              title="Отклонить"
            >
              <PhoneOff className="h-6 w-6" />
            </button>

            <button
              type="button"
              onClick={acceptCall}
              className="h-14 w-14 rounded-full bg-green-600 flex items-center justify-center hover:bg-green-700 transition-all duration-200"
              title="Принять"
            >
              {isVideo ? <Video className="h-6 w-6" /> : <Phone className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IncomingCallModal;