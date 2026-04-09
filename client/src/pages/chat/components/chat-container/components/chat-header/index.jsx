import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { useSocket } from "@/context/SocketContext";
import { getColor } from "@/lib/utils";
import { useAppStore } from "@/store";
import { HOST } from "@/utils/constants";
import { Phone, Video } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { RiCloseFill } from "react-icons/ri";

const createShortCallId = (prefix = "call") => {
  const randomPart =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

  return `${prefix}-${randomPart}`;
};

const buildDmCallId = () => {
  return createShortCallId("dm");
};

const buildUserPayload = (userInfo) => ({
  _id: userInfo.id,
  firstName: userInfo.firstName,
  lastName: userInfo.lastName,
  email: userInfo.email,
  image: userInfo.image,
  color: userInfo.color,
});

const ChatHeader = () => {
  const navigate = useNavigate();
  const socket = useSocket();

  const { closeChat, selectedChatData, selectedChatType, userInfo } = useAppStore();

  const startCall = (mode = "audio") => {
    if (!socket) {
      toast.error("Сокет ещё не подключился. Попробуй снова через секунду.");
      return;
    }

    if (!selectedChatData?._id || !selectedChatType || !userInfo?.id) {
      return;
    }

    if (selectedChatType === "channel") {
      toast.info("Групповые звонки будут следующим этапом. Сейчас работает только 1 на 1.");
      return;
    }

    const fromUser = buildUserPayload(userInfo);
    const callId = buildDmCallId();

    socket.emit("call-user", {
      callId,
      mode,
      fromUser,
      targetUserId: selectedChatData._id,
    });

    navigate(
      `/call/${callId}?mode=${mode}&peerId=${selectedChatData._id}&initiator=true`
    );
  };

  return (
    <div className="h-[10vh] border-b-2 border-[#2f303b] flex items-center justify-between px-20">
      <div className="flex gap-5 items-center w-full justify-between">
        <div className="flex gap-3 items-center justify-center">
          <div className="w-12 h-12 relative">
            {selectedChatType === "contact" ? (
              <Avatar className="h-12 w-12 rounded-full overflow-hidden">
                {selectedChatData.image ? (
                  <AvatarImage
                    src={`${HOST}/${selectedChatData.image}`}
                    alt="profile"
                    className="object-cover w-full h-full bg-black"
                  />
                ) : (
                  <div
                    className={`uppercase h-12 w-12 text-lg border-[0.1rem] flex items-center justify-center rounded-full ${getColor(
                      selectedChatData.color
                    )}`}
                  >
                    {selectedChatData.firstName
                      ? selectedChatData.firstName.split("").shift()
                      : selectedChatData.email.split("").shift()}
                  </div>
                )}
              </Avatar>
            ) : (
              <div className="bg-[#ffffff22] h-10 w-10 flex items-center justify-center rounded-full">
                #
              </div>
            )}
          </div>

          <div>
            {selectedChatType === "channel" && selectedChatData.name}
            {selectedChatType === "contact" &&
              (selectedChatData.firstName
                ? `${selectedChatData.firstName} ${selectedChatData.lastName || ""}`.trim()
                : selectedChatData.email)}
          </div>
        </div>

        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            className="text-neutral-400 hover:text-white duration-200 transition-all rounded-full p-2 hover:bg-[#2a2c37]"
            onClick={() => startCall("audio")}
            title="Голосовой звонок"
          >
            <Phone className="h-5 w-5" />
          </button>

          <button
            type="button"
            className="text-neutral-400 hover:text-white duration-200 transition-all rounded-full p-2 hover:bg-[#2a2c37]"
            onClick={() => startCall("video")}
            title="Видеозвонок"
          >
            <Video className="h-5 w-5" />
          </button>

          <button
            className="text-neutral-500 focus:border-none focus:outline-none focus:text-white duration-200 transition-all"
            onClick={closeChat}
          >
            <RiCloseFill className="text-3xl" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatHeader;