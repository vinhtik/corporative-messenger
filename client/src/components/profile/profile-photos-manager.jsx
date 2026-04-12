/* eslint-disable no-irregular-whitespace */
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { useAppStore } from "@/store";
import {
  ADD_PROFILE_PHOTO_ROUTE,
  GET_PROFILE_PHOTOS_ROUTE,
  HOST,
  SET_AVATAR_PHOTO_ROUTE,
} from "@/utils/constants";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getColor } from "@/lib/utils";
import { FaPlus } from "react-icons/fa6";
import ProfilePhotoStrip from "./profile-photo-strip";
import ProfilePhotosViewer from "./profile-photos-viewer";

const ProfilePhotosManager = () => {
  const { userInfo, setUserInfo } = useAppStore();

  const [photos, setPhotos] = useState(userInfo?.profilePhotos || []);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  const fileInputRef = useRef(null);

  const avatarPhoto = useMemo(() => {
    return photos.find((photo) => photo.isAvatar) || null;
  }, [photos]);

  useEffect(() => {
    setPhotos(userInfo?.profilePhotos || []);
  }, [userInfo]);

  useEffect(() => {
    const fetchPhotos = async () => {
      try {
        const response = await apiClient.get(GET_PROFILE_PHOTOS_ROUTE, {
          withCredentials: true,
        });

        const nextPhotos = response.data?.profilePhotos || [];
        const nextImage = response.data?.image || null;

        setPhotos(nextPhotos);

        if (userInfo) {
          setUserInfo({
            ...userInfo,
            image: nextImage,
            profilePhotos: nextPhotos,
          });
        }
      } catch (error) {
        console.log(error);
      }
    };

    fetchPhotos();
  }, []);

  const syncUserPhotos = (nextImage, nextPhotos) => {
    const safePhotos = nextPhotos || [];
    setPhotos(safePhotos);

    if (userInfo) {
      setUserInfo({
        ...userInfo,
        image: nextImage,
        profilePhotos: safePhotos,
      });
    }
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const handleAddPhoto = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);

      const formData = new FormData();
      formData.append("profile-photo", file);

      const response = await apiClient.post(ADD_PROFILE_PHOTO_ROUTE, formData, {
        withCredentials: true,
      });

      syncUserPhotos(response.data?.image || null, response.data?.profilePhotos || []);
      toast.success("Фотография добавлена");
    } catch (error) {
      console.log(error);
      toast.error(error?.response?.data || "Не удалось загрузить фотографию");
    } finally {
      setLoading(false);
      event.target.value = "";
    }
  };

  const handleSetAvatar = async (photoId) => {
    try {
      setLoading(true);

      const response = await apiClient.patch(
        `${SET_AVATAR_PHOTO_ROUTE}/${photoId}/avatar`,
        {},
        { withCredentials: true }
      );

      syncUserPhotos(response.data?.image || null, response.data?.profilePhotos || []);
      toast.success("Аватар обновлён");
    } catch (error) {
      console.log(error);
      toast.error(error?.response?.data || "Не удалось выбрать аватар");
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePhoto = async (photoId) => {
    try {
      setLoading(true);

      const response = await apiClient.delete(`${GET_PROFILE_PHOTOS_ROUTE}/${photoId}`, {
        withCredentials: true,
      });

      const nextPhotos = response.data?.profilePhotos || [];
      syncUserPhotos(response.data?.image || null, nextPhotos);

      if (viewerIndex >= nextPhotos.length) {
        setViewerIndex(Math.max(0, nextPhotos.length - 1));
      }

      if (!nextPhotos.length) {
        setViewerOpen(false);
      }

      toast.success("Фотография удалена");
    } catch (error) {
      console.log(error);
      toast.error(error?.response?.data || "Не удалось удалить фотографию");
    } finally {
      setLoading(false);
    }
  };

  const openViewerByIndex = (index) => {
    setViewerIndex(index);
    setViewerOpen(true);
  };

  const handleStripClick = (_, index) => {
    openViewerByIndex(index);
  };

  const openAvatarViewer = () => {
    if (!photos.length) return;

    const avatarIndex = photos.findIndex((photo) => photo.isAvatar);
    openViewerByIndex(avatarIndex >= 0 ? avatarIndex : 0);
  };

  return (
    <>
      <div className="w-full rounded-2xl bg-[#2c2e3b] p-5 flex flex-col gap-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-white text-lg font-medium">Фотографии профиля</h3>
            <p className="text-white/50 text-sm">
              Нажми на фото, чтобы открыть просмотр и выбрать аватар.
            </p>
          </div>

          <Button
            type="button"
            onClick={openFilePicker}
            disabled={loading}
            className="bg-green-700 hover:bg-green-900 transition-all duration-200"
          >
            <FaPlus className="mr-2" />
            Добавить фото
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".png,.jpg,.jpeg,.webp,.gif"
            className="hidden"
            onChange={handleAddPhoto}
          />
        </div>

        <div className="flex flex-col md:flex-row gap-5">
          <div className="flex justify-center md:justify-start">
            <button
              type="button"
              className="rounded-full"
              onClick={openAvatarViewer}
            >
              <Avatar className="h-40 w-40 rounded-full overflow-hidden">
                {avatarPhoto?.path ? (
                  <AvatarImage
                    src={`${HOST}/${avatarPhoto.path}`}
                    alt="avatar"
                    className="object-cover w-full h-full bg-black"
                  />
                ) : userInfo?.image ? (
                  <AvatarImage
                    src={`${HOST}/${userInfo.image}`}
                    alt="avatar"
                    className="object-cover w-full h-full bg-black"
                  />
                ) : (
                  <div
                    className={`uppercase h-40 w-40 text-5xl border-[0.1rem] flex items-center justify-center rounded-full ${getColor(
                      userInfo?.color
                    )}`}
                  >
                    {userInfo?.firstName
                      ? userInfo.firstName.split("").shift()
                      : userInfo?.email?.split("").shift()}
                  </div>
                )}
              </Avatar>
            </button>
          </div>

          <div className="flex-1 flex flex-col gap-4 min-w-0">
            <div className="text-white/70 text-sm">
              Основная фотография используется как аватар в чатах и профиле.
            </div>

            {photos.length === 0 ? (
              <div className="h-28 rounded-xl border border-dashed border-white/15 flex items-center justify-center text-white/40 text-sm">
                Пока что фотографий нет
              </div>
            ) : (
              <ProfilePhotoStrip
                photos={photos}
                activePhotoId={avatarPhoto?._id || null}
                onPhotoClick={handleStripClick}
              />
            )}
          </div>
        </div>
      </div>

      <ProfilePhotosViewer
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        photos={photos}
        initialIndex={viewerIndex}
        editable={true}
        loading={loading}
        onSetAvatar={handleSetAvatar}
        onDeletePhoto={handleDeletePhoto}
      />
    </>
  );
};

export default ProfilePhotosManager;