import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import { HOST } from "@/utils/constants";
import { getColor } from "@/lib/utils";
import { useAppStore } from "@/store";
import ProfilePhotoStrip from "./profile-photo-strip";
import ProfilePhotosViewer from "./profile-photos-viewer";

const UserProfileDialog = ({
  open,
  onOpenChange,
  user = null,
  onMessage,
}) => {
  const {
    userInfo,
    selectedChatType,
    selectedChatData,
    setSelectedChatType,
    setSelectedChatData,
    setSelectedChatMessages,
  } = useAppStore();

  const photos = user?.profilePhotos || [];
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  useEffect(() => {
    if (!open) {
      setViewerOpen(false);
      setViewerIndex(0);
    }
  }, [open]);

  const fullName = useMemo(() => {
    if (!user) return "";
    if (user.firstName) {
      return `${user.firstName} ${user.lastName || ""}`.trim();
    }
    return user.email || "";
  }, [user]);

  const avatarPhoto = useMemo(() => {
    return photos.find((photo) => photo.isAvatar) || null;
  }, [photos]);

  const isOwnProfile = String(user?._id || "") === String(userInfo?.id || "");

  const handlePhotoClick = (_, index) => {
    setViewerIndex(index);
    setViewerOpen(true);
  };

  const handleOpenChange = (nextOpen) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setViewerOpen(false);
      setViewerIndex(0);
    }
  };

  const openChatDirectly = (targetUser) => {
    if (!targetUser?._id) return;

    const sameChat =
      selectedChatType === "contact" &&
      String(selectedChatData?._id || "") === String(targetUser._id);

    setSelectedChatType("contact");
    setSelectedChatData(targetUser);

    if (!sameChat) {
      setSelectedChatMessages([]);
    }

    onOpenChange(false);
  };

  const handleMessageClick = () => {
    if (!user || isOwnProfile) return;

    if (onMessage) {
      onMessage(user);
      onOpenChange(false);
      return;
    }

    openChatDirectly(user);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="bg-[#181920] border-none text-white w-[95vw] max-w-[520px] p-0 overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>
              {fullName ? `Профиль пользователя ${fullName}` : "Профиль пользователя"}
            </DialogTitle>
            <DialogDescription>
              Просмотр информации профиля пользователя, фотографий и переход к личному сообщению.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col">
            <div className="px-6 pt-8 pb-6 flex flex-col items-center gap-4 border-b border-white/10">
              <button
                type="button"
                className="cursor-default"
                onClick={() => {
                  if (photos.length) {
                    const avatarIndex = photos.findIndex((photo) => photo.isAvatar);
                    setViewerIndex(avatarIndex >= 0 ? avatarIndex : 0);
                    setViewerOpen(true);
                  }
                }}
              >
                <Avatar className="h-32 w-32 rounded-full overflow-hidden">
                  {avatarPhoto?.path ? (
                    <AvatarImage
                      src={`${HOST}/${avatarPhoto.path}`}
                      alt="profile"
                      className="object-cover w-full h-full bg-black"
                    />
                  ) : user?.image ? (
                    <AvatarImage
                      src={`${HOST}/${user.image}`}
                      alt="profile"
                      className="object-cover w-full h-full bg-black"
                    />
                  ) : (
                    <div
                      className={`uppercase h-32 w-32 text-4xl border-[0.1rem] flex items-center justify-center rounded-full ${getColor(
                        user?.color
                      )}`}
                    >
                      {user?.firstName
                        ? user.firstName.split("").shift()
                        : user?.email?.split("").shift()}
                    </div>
                  )}
                </Avatar>
              </button>

              <div className="flex flex-col items-center gap-1 text-center">
                <div className="text-2xl font-semibold break-words">{fullName}</div>
              </div>

              {!isOwnProfile && (
                <Button
                  type="button"
                  onClick={handleMessageClick}
                  className="relative overflow-hidden bg-green-700 hover:bg-green-900 transition-all duration-200 rounded-full px-5 py-5 min-h-[48px]"
                >
                  <span className="absolute inset-0 rounded-full animate-ping bg-green-400/20" />
                  <span className="relative flex items-center gap-2">
                    <MessageCircle className="h-5 w-5" />
                    Написать сообщение
                  </span>
                </Button>
              )}
            </div>

            <div className="px-6 py-5 flex flex-col gap-3">
              <div className="text-sm text-white/60">Фотографии профиля</div>

              <ProfilePhotoStrip
                photos={photos}
                activePhotoId={photos[viewerIndex]?._id || null}
                onPhotoClick={handlePhotoClick}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ProfilePhotosViewer
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        photos={photos}
        initialIndex={viewerIndex}
      />
    </>
  );
};

export default UserProfileDialog;

