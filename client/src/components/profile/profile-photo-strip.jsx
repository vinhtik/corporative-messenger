import { HOST } from "@/utils/constants";
import { FaStar } from "react-icons/fa6";

const ProfilePhotoStrip = ({
  photos = [],
  activePhotoId = null,
  onPhotoClick = () => {},
  className = "",
}) => {
  if (!photos.length) {
    return (
      <div
        className={`h-24 rounded-xl border border-dashed border-border flex items-center justify-center text-muted-foreground text-sm ${className}`}
      >
        Фотографий нет
      </div>
    );
  }

  return (
    <div className={`w-full min-w-0 ${className}`}>
      <div className="w-full min-w-0 overflow-x-auto overflow-y-hidden scrollbar-hidden touch-pan-x">
        <div className="inline-flex gap-3 pr-2">
          {photos.map((photo, index) => {
            const isActive = String(activePhotoId) === String(photo._id);

            return (
              <button
                key={photo._id || photo.path || index}
                type="button"
                onClick={() => onPhotoClick(photo, index)}
                className={`relative flex-none w-[96px] h-[96px] rounded-2xl overflow-hidden border transition-all duration-200 ${
                  isActive
                    ? "border-primary ring-2 ring-primary/30"
                    : "border-border hover:border-primary/40"
                }`}
              >
                <img
                  src={`${HOST}/${photo.path}`}
                  alt="profile"
                  className="w-full h-full object-cover"
                />

                {photo.isAvatar && (
                  <div className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/70 text-yellow-300 flex items-center justify-center">
                    <FaStar className="text-xs" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ProfilePhotoStrip;
