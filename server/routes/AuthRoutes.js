import { Router } from "express";
import { getUserInfo, login, signup, updateProfile, addProfileImage, removeProfileImage, logout, getMyProfilePhotos, addProfilePhoto, setAvatarPhoto, deleteProfilePhoto, savePushToken } from "../conrollers/AuthController.js";
import { verifyToken } from "../middlewares/AuthMiddleware.js";
import multer from "multer";

const authRoutes = Router();
const upload = multer({dest: "uploads/profiles/"})


authRoutes.post("/signup", signup);
authRoutes.post("/login", login);
authRoutes.get('/user-info', verifyToken, getUserInfo);
authRoutes.post("/update-profile", verifyToken, updateProfile);
authRoutes.post("/add-profile-image", verifyToken, upload.single("profile-image"), addProfileImage);
authRoutes.delete("/remove-profile-image", verifyToken, removeProfileImage);

authRoutes.get("/profile-photos", verifyToken, getMyProfilePhotos);
authRoutes.post("/profile-photos", verifyToken, upload.single("profile-photo"), addProfilePhoto);
authRoutes.patch("/profile-photos/:photoId/avatar", verifyToken, setAvatarPhoto);
authRoutes.delete("/profile-photos/:photoId", verifyToken, deleteProfilePhoto);
authRoutes.post("/logout", logout);
authRoutes.post("/push-token" , verifyToken, savePushToken)

export default authRoutes;