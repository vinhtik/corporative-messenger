import ChatHeader from "./components/chat-header";
import MessageBar from "./components/message-bar";
import MessageContainer from "./components/message-container";

const ChatContainer = () => {
  return (
    <div className="fixed inset-0 h-dvh w-screen min-h-0 bg-background text-foreground flex flex-col md:static md:h-auto md:w-auto md:flex-1">
      <ChatHeader />
      <MessageContainer />
      <MessageBar />
    </div>
  )
}

export default ChatContainer;