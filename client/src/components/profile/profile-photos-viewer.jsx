/* eslint-disable no-irregular-whitespace */
import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { HOST } from "@/utils/constants";
import ProfilePhotoStrip from "./profile-photo-strip";
import { FaChevronLeft, FaChevronRight, FaStar, FaTrash, FaXmark } from "react-icons/fa6";

const ProfilePhotosViewer = ({
  open,
  onOpenChange,
  photos = [],
  initialIndex = 0,
  editable = false,
  loading = false,
  onSetAvatar,
  onDeletePhoto,
}) => {
  const safeInitialIndex =
    initialIndex >= 0 && initialIndex < photos.length ? initialIndex : 0;

  const [currentIndex, setCurrentIndex] = useState(safeInitialIndex);

  useEffect(() => {
    if (open) {
      setCurrentIndex(safeInitialIndex);
    }
  }, [open, safeInitialIndex]);

  useEffect(() => {
    if (!photos.length) {
      setCurrentIndex(0);
      return;
    }

    if (currentIndex > photos.length - 1) {
      setCurrentIndex(photos.length - 1);
    }
  }, [photos, currentIndex]);

  const currentPhoto = useMemo(() => {
    if (!photos.length) return null;
    return photos[currentIndex] || photos[0];
  }, [photos, currentIndex]);

  const showPrev = () => {
    if (photos.length <= 1) return;
    setCurrentIndex((prev) => (prev === 0 ? photos.length - 1 : prev - 1));
  };

  const showNext = () => {
    if (photos.length <= 1) return;
    setCurrentIndex((prev) => (prev === photos.length - 1 ? 0 : prev + 1));
  };

  const handleThumbnailClick = (_, index) => {
    setCurrentIndex(index);
  };

  const handleSetAvatarClick = async () => {
    if (!currentPhoto || !onSetAvatar) return;
    await onSetAvatar(currentPhoto._id);
  };

  const handleDeleteClick = async () => {
    if (!currentPhoto || !onDeletePhoto) return;
    await onDeletePhoto(currentPhoto._id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#181920] border-none text-white w-[95vw] max-w-5xl p-0 overflow-hidden">
        <div className="relative min-h-[70vh] flex flex-col">

          {!currentPhoto ? (
            <div className="flex-1 flex items-center justify-center text-white/40">
              Фотографий нет
            </div>
          ) : (
            <>
              <div className="relative flex-1 flex items-center justify-center bg-black/40 px-4 py-6">
                {photos.length > 1 && (
                  <Button
                    type="button"
                    size="icon"
                    onClick={showPrev}
                    className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-black/50 hover:bg-black/70"
                  >
                    <FaChevronLeft />
                  </Button>
                )}

                <div className="max-w-full w-full flex flex-col items-center gap-4">
                  <img
                    src={`${HOST}/${currentPhoto.path}`}
                    alt="profile"
                    className="max-h-[52vh] max-w-full object-contain rounded-2xl"
                  />

                  <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-white/70 px-3 text-center">
                    <span>
                      {currentIndex + 1} / {photos.length}
                    </span>

                    {currentPhoto.isAvatar && (
                      <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-500/15 text-yellow-300 border border-yellow-500/20">
                        <FaStar className="text-xs" />
                        Текущий аватар
                      </span>
                    )}
                  </div>

                  {editable && (
                    <div className="flex flex-wrap items-center justify-center gap-3 px-4">
                      <Button
                        type="button"
                        disabled={loading || currentPhoto.isAvatar}
                        onClick={handleSetAvatarClick}
                        className={
                          currentPhoto.isAvatar
                            ? "bg-emerald-700 hover:bg-emerald-700"
                            : "bg-[#3a3d4c] hover:bg-[#4b4f62]"
                        }
                      >
                        <FaStar className="mr-2" />
                        {currentPhoto.isAvatar ? "Это аватар" : "Сделать аватаром"}
                      </Button>

                      <Button
                        type="button"
                        disabled={loading}
                        variant="destructive"
                        className="bg-red-700 hover:bg-red-900"
                        onClick={handleDeleteClick}
                      >
                        <FaTrash className="mr-2" />
                        Удалить фото
                      </Button>
                    </div>
                  )}
                </div>

                {photos.length > 1 && (
                  <Button
                    type="button"
                    size="icon"
                    onClick={showNext}
                    className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-black/50 hover:bg-black/70"
                  >
                    <FaChevronRight />
                  </Button>
                )}
              </div>

              <div className="border-t border-white/10 px-4 py-4 bg-[#1d1f29]">
                <ProfilePhotoStrip
                  photos={photos}
                  activePhotoId={currentPhoto._id}
                  onPhotoClick={handleThumbnailClick}
                />
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProfilePhotosViewer;