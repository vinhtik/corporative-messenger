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
        className={`h-24 rounded-xl border border-dashed border-white/15 flex items-center justify-center text-white/35 text-sm ${className}`}
      >
        Фотографий нет
      </div>
    );
  }

  return (
    <div className={`flex gap-3 overflow-x-auto pb-2 scrollbar-hidden ${className}`}>
      {photos.map((photo, index) => {
        const isActive = String(activePhotoId) === String(photo._id);

        return (
          <button
            key={photo._id || photo.path || index}
            type="button"
            onClick={() => onPhotoClick(photo, index)}
            className={`relative min-w-[96px] w-[96px] h-[96px] rounded-2xl overflow-hidden border transition-all duration-200 ${
              isActive
                ? "border-green-500 ring-2 ring-green-500/30"
                : "border-white/10 hover:border-white/30"
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
  );
};

export default ProfilePhotoStrip;
