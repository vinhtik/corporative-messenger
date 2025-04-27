import { useAppStore } from "@/store";
import moment from "moment";
import { useEffect, useRef } from "react";

const MessageContainer = () => {
  const scrollRef = useRef();
  const { selectedChatType, selectedChatData, userInfo, selectedChatMessages } = useAppStore();

  useEffect(() => {
    if(scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [selectedChatMessages]);
  
  const renderMessages = () => {
    let lastDate = null;
    return selectedChatMessages.map((message, index) => {
      const messageDate = moment(message.timestamp).format("DD-MM-YYYY");
      const showDate = messageDate !== lastDate;
      lastDate = messageDate;
      return (
        <div key={message._id}>
          {showDate && (
            <div className="text-center text-gray-500 my-2">
            {moment(message.timestamp).format("LL")}
            </div>
          )}
          {
            selectedChatType === "contact" && renderDMMessages(message)
          }
        </div>
      )
    });
  }

  const renderDMMessages = (message) => (
    <div className={`${message.sender === selectedChatData._id 
      ? "text-right"
      : "text-left"
    }`}>
      {message.messageType === "text" && (
        <div className={`${message.sender !== selectedChatData._id 
          ? "bg-[#8417ff]/5 text-[#8417ff]/90 border-[#8417ff]/50 rounded-r-2xl"
          : "bg-[#8417ff]/5 text-white/80 border-white/20 rounded-l-2xl"
          } border inline-block p-2 my-1 max-w-[50%] break-words rounded-t-2xl`}
          >
          {message.content}
        </div>
      )}
      <div className="text-xs text-gray-600">
          {moment(message.timestamp).format("LT")}
      </div>
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto scrollbar-hidden p-4 px-8 md:w-[65vw] lg:w-[70vw] xl:w-[80vw] w-full">
        {renderMessages()}
        <div ref={scrollRef} />
    </div>
  )
}

export default MessageContainer