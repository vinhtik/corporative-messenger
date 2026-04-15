import { HOST } from "@/utils/constants";
import { FaStar } from "react-icons/fa6";

const ProfilePhotoStrip = ({
  photos = [],
  activePhotoId = null,
  onPhotoClick = () => {},
  className = "",
  mode = "strip",
  thumbClassName = "",
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

  if (mode === "grid") {
    return (
      <div className={`w-full min-w-0 max-w-full ${className}`}>
        <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
          {photos.map((photo, index) => {
            const isActive = String(activePhotoId) === String(photo._id);

            return (
              <button
                key={photo._id || photo.path || index}
                type="button"
                onClick={() => onPhotoClick(photo, index)}
                className={`relative w-full aspect-square rounded-xl overflow-hidden border transition-all duration-200 ${
                  isActive
                    ? "border-primary ring-2 ring-primary/30"
                    : "border-border hover:border-primary/40"
                } ${thumbClassName}`}
              >
                <img
                  src={`${HOST}/${photo.path}`}
                  alt="profile"
                  className="w-full h-full object-cover"
                />

                {photo.isAvatar && (
                  <div className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full bg-black/70 text-yellow-300 flex items-center justify-center">
                    <FaStar className="text-[10px]" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full min-w-0 max-w-full ${className}`}>
      <div className="w-full min-w-0 max-w-full overflow-x-auto overflow-y-hidden">
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
                } ${thumbClassName}`}
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
