/* eslint-disable no-irregular-whitespace */
import { useAppStore } from "@/store";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IoArrowBack } from "react-icons/io5";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { UPDATE_PROFILE_ROUTE } from "@/utils/constants";
import { colors } from "@/lib/utils";
import ProfilePhotosManager from "@/components/profile/profile-photos-manager";
import ThemeSettings from "@/components/theme/theme-settings";

const Profile = () => {
  const navigate = useNavigate();
  const { userInfo, setUserInfo } = useAppStore();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [selectedColor, setSelectedColor] = useState(0);

  useEffect(() => {
    if (userInfo?.profileSetup) {
      setFirstName(userInfo.firstName || "");
      setLastName(userInfo.lastName || "");
      setSelectedColor(userInfo.color ?? 0);
    }
  }, [userInfo]);

  const validateProfile = () => {
    if (!firstName) {
      toast.error("Имя обязательна");
      return false;
    }
    if (!lastName) {
      toast.error("Фамилия обязательна");
      return false;
    }
    return true;
  };

  const saveChanges = async () => {
    if (validateProfile()) {
      try {
        const response = await apiClient.post(
          UPDATE_PROFILE_ROUTE,
          {
            firstName,
            lastName,
            color: selectedColor,
          },
          { withCredentials: true }
        );

        if (response.status === 200 && response.data) {
          setUserInfo({ ...response.data });
          toast.success("Профиль обновлён");
          navigate("/chat");
        }
      } catch (error) {
        console.log(error);
      }
    }
  };

  const handleNavigate = () => {
    if (userInfo?.profileSetup) {
      navigate("/chat");
    } else {
      toast.error("Настройте профиль");
    }
  };

  return (
    <div className="bg-background text-foreground min-h-[100vh] flex items-center justify-center flex-col gap-8 py-10">
      <div className="flex flex-col gap-8 md:w-[80vw] max-w-5xl">
        <div onClick={handleNavigate}>
          <IoArrowBack className="ml-5 md:ml-0 text-4xl lg:text-6xl text-foreground/90 cursor-pointer" />
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            <div className="flex min-w-32 flex-col gap-5 items-center justify-center md:items-start">
              <div className="w-full">
                <Input
                  placeholder="Email"
                  type="email"
                  disabled
                  value={userInfo?.email || ""}
                  className="rounded-lg p-6 bg-background/60 border-border"
                />
              </div>

              <div className="w-full">
                <Input
                  placeholder="First Name"
                  maxLength={67}
                  type="text"
                  onChange={(e) => setFirstName(e.target.value)}
                  value={firstName}
                  className="rounded-lg p-6 bg-background/60 border-border"
                />
              </div>

              <div className="w-full">
                <Input
                  placeholder="Last Name"
                  type="text"
                  maxLength={67}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="rounded-lg p-6 bg-background/60 border-border"
                />
              </div>

              <div className="w-full flex gap-5 flex-wrap">
                {colors.map((color, index) => (
                  <div
                    className={`${color} h-8 w-8 rounded-full cursor-pointer transition-all duration-200 ${
                      selectedColor === index
                        ? "outline-primary outline-[0.15rem]"
                        : ""
                    }`}
                    key={index}
                    onClick={() => setSelectedColor(index)}
                  />
                ))}
              </div>
            </div>

            <ProfilePhotosManager />
          </div>
        </div>

        <div className="w-full">
          <Button className="h-16 w-full text-base" onClick={saveChanges}>
            Сохранить
          </Button>
        </div>

        <ThemeSettings />
      </div>
    </div>
  );
};

export default Profile;
