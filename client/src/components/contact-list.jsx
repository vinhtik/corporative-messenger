import { useAppStore } from "@/store"
import { Avatar, AvatarImage } from "./ui/avatar.jsx";
import { HOST } from "@/utils/constants.js";
import { getColor } from "@/lib/utils.js";

const ContactList = ({ contacts, isChannel = false }) => {

    const {
        selectedChatData,
        setSelectedChatData,
        setSelectedChatType,
        setSelectedChatMessages
    } = useAppStore();

    const handleClick = (contact) => {
        if(isChannel) setSelectedChatType("channel");
            else setSelectedChatType("contact");
        setSelectedChatData(contact);
        if(selectedChatData && selectedChatData._id !== contact._id){
            setSelectedChatMessages([]);
        }
    };

  return (
    <div className="mt-5 ">{
        contacts.map((contact) => (
        <div key={contact._id} className={`pl-10 py-2 transition-all duration-200 cursor-pointer ${selectedChatData && (selectedChatData._id === contact._id)
            ? "bg-[#2fed527d] hover:bg-[#2fed52b5]"
        : "hover:bg-[#f1f1f111]"
        }`}
        onClick={() => handleClick(contact)}
        >
            <div className="flex gap-5 items-center justify-start text-neutral-300">
                {
                    !isChannel && (
                    <Avatar className="h-10 w-10 rounded-full overflow-hidden">
                    {
                        contact.image ? (<AvatarImage src={`${HOST}/${contact.image}`} alt="profile" 
                        className="object-cover w-full h-full bg-black" />
                    ) : ( 
                        <div className={`
                        ${selectedChatData && selectedChatData._id === contact._id 
                        ? "bg-[ffffff22] border-white/70"
                        : getColor(contact.color)
                        }
                        uppercase h-10 w-10 text-lg border-[0.1rem] flex items-center justify-center rounded-full `}>
                        {contact.firstName ? contact.firstName.split("").shift() : contact.email.split("").shift() }
                        </div>
                        )}
                    </Avatar>
                )}
                {
                    isChannel && ( <div className="bg-[#ffffff22] h-10 w-10 flex items-center justify-center rounded-full ">#</div> )}
                        {
                            isChannel
                            ? (<span>{contact.name}</span>) 
                            : (<span>{contact.firstName 
                                ? `${contact.firstName} ${contact.lastName}`
                                : contact.email}
                                </span>
                        )
                }
            </div>    
        </div>
    ))}
    </div>
  )
}

export default ContactList