import { apiClient } from "@/lib/api-client";
import { useAppStore } from "@/store";
import {
  GET_ALL_MESSAGES_ROUTE,
  GET_CHANNEL_MESSAGES,
  GET_MESSAGE_FILE_ROUTE,
  HOST,
} from "@/utils/constants.js";
import moment from "moment";
import { useEffect, useRef, useState } from "react";
import { IoMdArrowRoundDown } from "react-icons/io";
import { IoCloseSharp } from "react-icons/io5";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getColor } from "@/lib/utils";
import { toast } from "sonner";

const MessageContainer = () => {
  const scrollRef = useRef();

  const {
    selectedChatType,
    selectedChatData,
    userInfo,
    selectedChatMessages,
    setSelectedChatMessages,
    fileDownloadProgress,
    setFileDownloadProgress,
    closeChat,
  } = useAppStore();

  const [showImage, setShowImage] = useState(false);
  const [imageMessageId, setImageMessageId] = useState(null);
  const [downloadingFile, setDownloadingFile] = useState(null);

  useEffect(() => {
    const getMessages = async () => {
      try {
        const response = await apiClient.post(
          GET_ALL_MESSAGES_ROUTE,
          { id: selectedChatData._id },
          { withCredentials: true }
        );

        if (response.data.messages) {
          setSelectedChatMessages(response.data.messages);
        }
      } catch (error) {
        console.log({ error });
      }
    };

    const getChannelMessages = async () => {
      try {
        const response = await apiClient.get(
          `${GET_CHANNEL_MESSAGES}/${selectedChatData._id}`,
          { withCredentials: true }
        );

        if (response.data.messages) {
          setSelectedChatMessages(response.data.messages);
        }
      } catch (error) {
        console.log({ error });

        if (error?.response?.status === 403 || error?.response?.status === 404) {
          toast.info("Эта группа больше недоступна.");
          closeChat();
        }
      }
    };

    if (selectedChatData?._id) {
      if (selectedChatType === "contact") {
        getMessages();
      } else if (selectedChatType === "channel") {
        getChannelMessages();
      }
    }
  }, [
    selectedChatData?._id,
    selectedChatType,
    setSelectedChatMessages,
    closeChat,
  ]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [selectedChatMessages]);

  const isImageMessage = (message) => {
    return typeof message?.mimeType === "string" && message.mimeType.startsWith("image/");
  };

  const isAudioMessage = (message) => {
    return (
      message?.messageType === "audio" ||
      (typeof message?.mimeType === "string" && message.mimeType.startsWith("audio/"))
    );
  };

  const isVideoNoteMessage = (message) => {
    return message?.messageType === "video-note";
  };

  const getProtectedFileUrl = (messageId, download = false) => {
    return `${HOST}/${GET_MESSAGE_FILE_ROUTE}/${messageId}${download ? "?download=1" : ""}`;
  };

  const getMessageFileLabel = (message) => {
    if (message?.messageType === "audio") {
      return "Голосовое сообщение";
    }

    if (message?.messageType === "video-note") {
      return "Видеосообщение";
    }

    if (isImageMessage(message)) {
      return "Изображение";
    }

    if (!message?.mimeType) {
      return "Файл";
    }

    const subtype = message.mimeType.split("/")[1] || "";
    return subtype ? `Файл .${subtype}` : "Файл";
  };

  const extractFileNameFromDisposition = (headerValue) => {
    if (!headerValue) return null;
    const match = headerValue.match(/filename="([^"]+)"/);
    return match?.[1] || null;
  };

  const downloadFile = async (message) => {
    try {
      setDownloadingFile(message._id);
      setFileDownloadProgress(0);

      const response = await apiClient.get(
        `${GET_MESSAGE_FILE_ROUTE}/${message._id}?download=1`,
        {
          withCredentials: true,
          responseType: "blob",
          onDownloadProgress: (progressEvent) => {
            const { loaded, total } = progressEvent;
            if (!total) return;
            const percentCompleted = Math.round((loaded * 100) / total);
            setFileDownloadProgress(percentCompleted);
          },
        }
      );

      const urlBlob = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = urlBlob;

      const fileName =
        extractFileNameFromDisposition(response.headers["content-disposition"]) ||
        `file-${message._id}`;

      link.setAttribute("download", fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(urlBlob);
    } catch (error) {
      console.log({ error });
      toast.error("Не удалось скачать файл");
    } finally {
      setDownloadingFile(null);
      setFileDownloadProgress(0);
    }
  };

  const renderDownloadButton = (message) => {
    return (
      <span
        className="bg-black/20 p-2 text-xl rounded-full hover:bg-black/50 cursor-pointer transition-all duration-200 shrink-0"
        onClick={() => downloadFile(message)}
      >
        {downloadingFile === message._id ? (
          <p className="text-xs animate-pulse">{fileDownloadProgress}%</p>
        ) : (
          <IoMdArrowRoundDown />
        )}
      </span>
    );
  };

  const renderMessageContent = (message) => {
    if (message.messageType === "text") {
      return <div className="whitespace-pre-wrap break-words">{message.content}</div>;
    }

    if (isImageMessage(message)) {
      return (
        <div className="flex flex-col gap-2">
          <div
            className="cursor-pointer"
            onClick={() => {
              setShowImage(true);
              setImageMessageId(message._id);
            }}
          >
            <img
              src={getProtectedFileUrl(message._id)}
              height={300}
              width={300}
              alt="Preview"
              className="w-auto h-auto max-h-[300px] object-contain rounded-xl"
            />
          </div>

          <div className="flex justify-end">{renderDownloadButton(message)}</div>
        </div>
      );
    }

    if (isAudioMessage(message)) {
      return (
        <div className="flex flex-col gap-3 min-w-[240px] max-w-[320px]">
          <audio
            controls
            preload="metadata"
            src={getProtectedFileUrl(message._id)}
            className="w-full"
          />

          <div className="flex items-center justify-between gap-3">
            <span className="text-xs opacity-70">
              {message.duration ? `${Math.round(message.duration)} сек` : "Голосовое сообщение"}
            </span>
            {renderDownloadButton(message)}
          </div>
        </div>
      );
    }

    if (isVideoNoteMessage(message)) {
      return (
        <div className="flex flex-col items-center gap-3">
          <div className="h-56 w-56 md:h-66 md:w-66 rounded-full overflow-hidden bg-black">
            <video
              src={getProtectedFileUrl(message._id)}
              controls
              playsInline
              preload="metadata"
              className="h-full w-full object-cover"
            />
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs opacity-70">
              {message.duration ? `${Math.round(message.duration)} сек` : "Видеосообщение"}
            </span>
            {renderDownloadButton(message)}
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center gap-4">
        <span className="pl-2">{getMessageFileLabel(message)}</span>
        {renderDownloadButton(message)}
      </div>
    );
  };

  const getBubbleClasses = (isOwnMessage) => {
    return `${
      isOwnMessage
        ? "bg-[#8417ff]/5 text-[#8417ff]/90 border-[#8417ff]/50 rounded-l-2xl"
        : "bg-[#8417ff]/5 text-white/80 border-white/20 rounded-r-2xl"
    } border w-fit p-2 my-1 max-w-[80%] md:max-w-[50%] break-words rounded-t-2xl text-left`;
  };

  const renderMessages = () => {
    let lastDate = null;

    return selectedChatMessages.map((message, index) => {
      const messageDate = moment(message.timestamp).format("DD-MM-YYYY");
      const showDate = messageDate !== lastDate;
      lastDate = messageDate;

      return (
        <div key={message._id || index}>
          {showDate && (
            <div className="text-center text-gray-500 my-2">
              {moment(message.timestamp).format("LL")}
            </div>
          )}

          {selectedChatType === "contact" && renderDMMessages(message)}
          {selectedChatType === "channel" && renderChannelMessages(message)}
        </div>
      );
    });
  };

  const renderDMMessages = (message) => {
    const isIncoming = message.sender === selectedChatData._id;
    const isOwnMessage = !isIncoming;

    return (
      <div className={`flex flex-col ${isIncoming ? "items-start" : "items-end"}`}>
        <div className={getBubbleClasses(isOwnMessage)}>
          {renderMessageContent(message)}
        </div>

        <div className="text-xs text-gray-600">
          {moment(message.timestamp).format("LT")}
        </div>
      </div>
    );
  };

  const renderChannelMessages = (message) => {
    const isOwnMessage = message.sender?._id === userInfo.id;

    return (
      <div className={`mt-5 flex flex-col ${!isOwnMessage ? "items-start" : "items-end"}`}>
        <div className={getBubbleClasses(isOwnMessage)}>
          {renderMessageContent(message)}
        </div>

        {!isOwnMessage ? (
          <div className="flex items-center justify-start gap-2">
            <Avatar className="h-8 w-8 rounded-full overflow-hidden">
              {message.sender?.image && (
                <AvatarImage
                  src={`${HOST}/${message.sender.image}`}
                  alt="profile"
                  className="object-cover w-full h-full bg-black"
                />
              )}
              <AvatarFallback
                className={`uppercase h-8 w-8 text-lg flex items-center justify-center rounded-full ${getColor(
                  message.sender?.color
                )}`}
              >
                {message.sender?.firstName
                  ? message.sender.firstName.split("").shift()
                  : message.sender?.email?.split("").shift()}
              </AvatarFallback>
            </Avatar>

            <span className="text-sm text-white/60">
              {`${message.sender?.firstName || ""} ${message.sender?.lastName || ""}`.trim()}
            </span>

            <span className="text-xs text-white/60">
              {moment(message.timestamp).format("LT")}
            </span>
          </div>
        ) : (
          <div className="text-xs text-white/60 mt-1">
            {moment(message.timestamp).format("LT")}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto scrollbar-hidden p-4 md:px-8 md:w-[65vw] lg:w-[70vw] xl:w-[80vw] w-full">
      {renderMessages()}
      <div ref={scrollRef} />

      {showImage && imageMessageId && (
        <div className="fixed z-[1000] top-0 left-0 h-[100vh] w-[100vw] flex items-center justify-center backdrop-blur-lg flex-col">
          <div>
            <img
              src={getProtectedFileUrl(imageMessageId)}
              className="max-h-[80vh] max-w-[95vw] object-contain bg-cover"
              alt="Preview"
            />
          </div>

          <div className="flex gap-5 fixed top-0 right-0 m-5">
            <button
              className="bg-black/20 p-3 text-2xl rounded-full hover:bg-black/50 cursor-pointer transition-all duration-200"
              onClick={() => {
                const message = selectedChatMessages.find(
                  (item) => item._id === imageMessageId
                );
                if (message) {
                  downloadFile(message);
                }
              }}
            >
              {downloadingFile === imageMessageId ? (
                <p className="text-xs animate-pulse">{fileDownloadProgress}%</p>
              ) : (
                <IoMdArrowRoundDown />
              )}
            </button>

            <button
              className="bg-black/20 p-3 text-2xl rounded-full hover:bg-black/50 cursor-pointer transition-all duration-200"
              onClick={() => {
                setShowImage(false);
                setImageMessageId(null);
              }}
            >
              <IoCloseSharp />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageContainer;

