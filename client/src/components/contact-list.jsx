import { useState } from "react";
import { useAppStore } from "@/store";
import { Avatar, AvatarImage } from "./ui/avatar.jsx";
import { HOST, CONTACT_PROFILE_ROUTE } from "@/utils/constants.js";
import { getColor } from "@/lib/utils.js";
import { apiClient } from "@/lib/api-client";
import UserProfileDialog from "@/components/profile/user-profile-dialog";
import { toast } from "sonner";

const ContactList = ({ contacts, isChannel = false }) => {
  const {
    selectedChatData,
    setSelectedChatData,
    setSelectedChatType,
    setSelectedChatMessages,
  } = useAppStore();

  const [profileOpen, setProfileOpen] = useState(false);
  const [profileUser, setProfileUser] = useState(null);

  const handleClick = (contact) => {
    if (isChannel) {
      setSelectedChatType("channel");
    } else {
      setSelectedChatType("contact");
    }

    setSelectedChatData(contact);

    if (selectedChatData && selectedChatData._id !== contact._id) {
      setSelectedChatMessages([]);
    }
  };

  const openContactProfile = async (contactId, fallbackContact = null) => {
    try {
      const response = await apiClient.get(`${CONTACT_PROFILE_ROUTE}/${contactId}`, {
        withCredentials: true,
      });

      if (response.data?.user) {
        setProfileUser(response.data.user);
        setProfileOpen(true);
        return;
      }

      if (fallbackContact) {
        setProfileUser(fallbackContact);
        setProfileOpen(true);
      }
    } catch (error) {
      console.log(error);

      if (fallbackContact) {
        setProfileUser(fallbackContact);
        setProfileOpen(true);
      } else {
        toast.error("Не удалось открыть профиль");
      }
    }
  };

  return (
    <>
      <div className="mt-5">
        {contacts.map((contact) => (
          <div
            key={contact._id}
            className={`pl-10 py-2 transition-all duration-200 cursor-pointer ${
              selectedChatData && selectedChatData._id === contact._id
                ? "bg-primary/80 hover:bg-primary"
                : "hover:bg-muted"
            }`}
            onClick={() => handleClick(contact)}
          >
            <div className="flex gap-5 items-center justify-start text-neutral-300">
              {!isChannel && (
                <button
                  type="button"
                  className="shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    openContactProfile(contact._id, contact);
                  }}
                >
                  <Avatar className="h-10 w-10 rounded-full overflow-hidden">
                    {contact.image ? (
                      <AvatarImage
                        src={`${HOST}/${contact.image}`}
                        alt="profile"
                        className="object-cover w-full h-full bg-black"
                      />
                    ) : (
                      <div
                        className={`
                          ${
                            selectedChatData && selectedChatData._id === contact._id
                              ? "bg-[ffffff22] border-white/70"
                              : getColor(contact.color)
                          }
                          uppercase h-10 w-10 text-lg border-[0.1rem] flex items-center justify-center rounded-full
                        `}
                      >
                        {contact.firstName
                          ? contact.firstName.split("").shift()
                          : contact.email.split("").shift()}
                      </div>
                    )}
                  </Avatar>
                </button>
              )}

              {isChannel && (
                <div className="bg-[#ffffff22] h-10 w-10 flex items-center justify-center rounded-full">
                  #
                </div>
              )}

              {isChannel ? (
                <span>{contact.name}</span>
              ) : (
                <span className="text-left truncate">
                  {contact.firstName
                    ? `${contact.firstName} ${contact.lastName || ""}`.trim()
                    : contact.email}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <UserProfileDialog
        open={profileOpen}
        onOpenChange={setProfileOpen}
        user={profileUser}
      />
    </>
  );
};

export default ContactList;
