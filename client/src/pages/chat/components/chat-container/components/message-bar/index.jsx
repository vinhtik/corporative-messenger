import { useSocket } from "@/context/SocketContext";
import { apiClient } from "@/lib/api-client";
import { useAppStore } from "@/store";
import { UPLOAD_FILE_ROUTE } from "@/utils/constants";
import EmojiPicker from "emoji-picker-react";
import { useEffect, useRef, useState } from "react";
import { GrAttachment } from "react-icons/gr";
import { IoSend } from "react-icons/io5";
import { RiEmojiStickerLine } from "react-icons/ri";

const MessageBar = () => {
  const emojiRef = useRef(null);
  const fileInputRef = useRef(null);
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
  const isMobile = window.innerWidth < 640;

  useEffect(() => {
    function handleClickOutside(event) {
      if (emojiRef.current && !emojiRef.current.contains(event.target)) {
        setEmojiPickerOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleAddEmoji = (emoji) => {
    setMessage((prev) => prev + emoji.emoji);
  };

  const handleSendMessage = async () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage) return;

    if (selectedChatType === "contact") {
      socket.emit("sendMessage", {
        sender: userInfo.id,
        content: trimmedMessage,
        recipient: selectedChatData._id,
        messageType: "text",
        fileUrl: undefined,
        mimeType: undefined,
      });
    } else if (selectedChatType === "channel") {
      socket.emit("send-channel-message", {
        sender: userInfo.id,
        content: trimmedMessage,
        messageType: "text",
        fileUrl: undefined,
        mimeType: undefined,
        channelId: selectedChatData._id,
      });
    }

    setMessage("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleAttachmentClick = () => {
    fileInputRef.current?.click();
  };

  const handleAttachmentChange = async (event) => {
    try {
      const file = event.target.files[0];
      if (!file) return;

      const formData = new FormData();
      formData.append("file", file);

      setIsUploading(true);

      const response = await apiClient.post(UPLOAD_FILE_ROUTE, formData, {
        withCredentials: true,
        onUploadProgress: (data) => {
          if (!data.total) return;
          setFileUploadProgress(Math.round((100 * data.loaded) / data.total));
        },
      });

      if (response.status === 200 && response.data) {
        setIsUploading(false);

        const payload = {
          sender: userInfo.id,
          content: undefined,
          messageType: "file",
          fileUrl: response.data.filePath,
          mimeType: response.data.mimeType,
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
      }

      event.target.value = "";
    } catch (error) {
      setIsUploading(false);
      console.log({ error });
    }
  };

  return (
    <div className="h-[10vh] shrink-0 min-h-16 md:min-h-20 bg-[#1c1d25] pb-[env(safe-area-inset-bottom)] flex justify-center items-center md:px-8 px-2 md:mb-6 gap-2 md:gap-6">
      <div className="flex-1 flex bg-[#2a2b33] px-2 rounded-xl items-center pr-5">
        <textarea
          className="flex-1 md:p-5 p-2 bg-transparent rounded-xl focus:border-none focus:outline-none resize-none overflow-hidden"
          placeholder="Введите сообщение"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
        />

        <button
          className="text-neutral-500 focus:border-none focus:outline-none focus:text-white duration-200 transition-all"
          onClick={handleAttachmentClick}
          type="button"
        >
          <GrAttachment className="text-2xl" />
        </button>

        <input
          type="file"
          className="hidden"
          ref={fileInputRef}
          onChange={handleAttachmentChange}
        />

        <div className="relative flex">
          <button
            className="text-neutral-500 focus:border-none focus:outline-none focus:text-white duration-200 transition-all ml-1"
            onClick={() => setEmojiPickerOpen((prev) => !prev)}
            type="button"
          >
            <RiEmojiStickerLine className="text-2xl" />
          </button>

          {emojiPickerOpen && (
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

      <button
        className="bg-[#1fce4a] rounded-xl flex items-center justify-center md:p-5 p-2 focus:border-none hover:bg-[#1bda54ac] focus:bg-[#1bda54ac] focus:outline-none focus:text-white duration-200 transition-all"
        onClick={handleSendMessage}
        type="button"
      >
        <IoSend className="text-2xl" />
      </button>
    </div>
  );
};

export default MessageBar;
