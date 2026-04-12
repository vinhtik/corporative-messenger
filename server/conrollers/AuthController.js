import User from "../models/UserModel.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { renameSync, unlinkSync, existsSync } from "fs";

const maxAge = 3 * 24 * 60 * 60 * 1000;

const createToken = (email, userId) => {
  return jwt.sign({ email, userId }, process.env.JWT_KEY, { expiresIn: maxAge });
};

const buildUserResponse = (user) => ({
  id: user.id,
  email: user.email,
  profileSetup: user.profileSetup,
  firstName: user.firstName,
  lastName: user.lastName,
  image: user.image,
  profilePhotos: user.profilePhotos || [],
  color: user.color,
});

const safelyDeleteFile = (filePath) => {
  try {
    if (filePath && existsSync(filePath)) {
      unlinkSync(filePath);
    }
  } catch (error) {
    console.log("File delete error:", error.message);
  }
};

export const signup = async (request, response) => {
  try {
    const { email, password } = request.body;
    const normalizedEmail = email.trim().toLowerCase();

    if (!email || !password) {
      return response.status(400).send("Email and Password is required.");
    }

    const user = await User.create({ email: normalizedEmail, password });

    response.cookie("jwt", createToken(email, user.id), {
      maxAge,
      secure: false,
      sameSite: "Lax",
    });

    return response.status(201).json({
      user: buildUserResponse(user),
    });
  } catch (err) {
    console.log({ err });
    return response.status(500).send("Internal Server Error");
  }
};

export const login = async (request, response) => {
  try {
    const { email, password } = request.body;
    const normalizedEmail = email.trim().toLowerCase();

    if (!email || !password) {
      return response.status(400).send("Email and Password is required.");
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return response.status(404).send("User is not found");
    }

    const auth = await bcrypt.compare(password, user.password);
    if (!auth) {
      return response.status(400).send("Email of Password is incorrect.");
    }

    response.cookie("jwt", createToken(email, user.id), {
      maxAge,
      secure: false,
      sameSite: "Lax",
    });

    return response.status(200).json({
      user: buildUserResponse(user),
    });
  } catch (err) {
    console.log({ err });
    return response.status(500).send("Internal Server Error");
  }
};

export const getUserInfo = async (request, response) => {
  try {
    const userData = await User.findById(request.userId);

    if (!userData) {
      return response.status(404).send("User is not found");
    }

    return response.status(200).json(buildUserResponse(userData));
  } catch (err) {
    console.log({ err });
    return response.status(500).send("Internal Server Error");
  }
};

export const updateProfile = async (request, response) => {
  try {
    const { userId } = request;
    const { firstName, lastName, color } = request.body;

    if (!firstName || !lastName) {
      return response.status(400).send("Firstname, lastname and color is required");
    }

    const userData = await User.findByIdAndUpdate(
      userId,
      {
        firstName,
        lastName,
        color,
        profileSetup: true,
      },
      { new: true, runValidators: true }
    );

    return response.status(200).json(buildUserResponse(userData));
  } catch (err) {
    console.log({ err });
    return response.status(500).send("Internal Server Error");
  }
};

export const addProfileImage = async (request, response) => {
  try {
    if (!request.file) {
      return response.status(400).send("File is required");
    }

    const date = Date.now();
    const fileName = "uploads/profiles/" + date + request.file.originalname;
    renameSync(request.file.path, fileName);

    const user = await User.findById(request.userId);
    if (!user) {
      safelyDeleteFile(fileName);
      return response.status(404).send("User not found");
    }

    if (user.image && user.image !== fileName) {
      safelyDeleteFile(user.image);
    }

    user.image = fileName;

    if (!Array.isArray(user.profilePhotos)) {
      user.profilePhotos = [];
    }

    user.profilePhotos.forEach((photo) => {
      photo.isAvatar = false;
    });

    user.profilePhotos.unshift({
      path: fileName,
      isAvatar: true,
      uploadedAt: new Date(),
    });

    await user.save();

    return response.status(200).json({
      image: user.image,
      profilePhotos: user.profilePhotos,
    });
  } catch (err) {
    console.log({ err });
    return response.status(500).send("Internal Server Error");
  }
};

export const removeProfileImage = async (request, response) => {
  try {
    const { userId } = request;
    const user = await User.findById(userId);

    if (!user) {
      return response.status(404).send("User not found");
    }

    if (user.image) {
      safelyDeleteFile(user.image);
    }

    if (Array.isArray(user.profilePhotos)) {
      user.profilePhotos = user.profilePhotos.filter(
        (photo) => photo.path !== user.image
      );
    }

    if (user.profilePhotos.length > 0) {
      user.profilePhotos.forEach((photo, index) => {
        photo.isAvatar = index === 0;
      });
      user.image = user.profilePhotos[0].path;
    } else {
      user.image = null;
    }

    await user.save();

    return response.status(200).json({
      image: user.image,
      profilePhotos: user.profilePhotos,
    });
  } catch (err) {
    console.log({ err });
    return response.status(500).send("Internal Server Error");
  }
};

export const getMyProfilePhotos = async (request, response) => {
  try {
    const user = await User.findById(request.userId).select("image profilePhotos");

    if (!user) {
      return response.status(404).send("User not found");
    }

    return response.status(200).json({
      image: user.image,
      profilePhotos: user.profilePhotos || [],
    });
  } catch (err) {
    console.log({ err });
    return response.status(500).send("Internal Server Error");
  }
};

export const addProfilePhoto = async (request, response) => {
  try {
    if (!request.file) {
      return response.status(400).send("File is required");
    }

    const user = await User.findById(request.userId);
    if (!user) {
      return response.status(404).send("User not found");
    }

    const date = Date.now();
    const fileName = "uploads/profiles/" + date + request.file.originalname;
    renameSync(request.file.path, fileName);

    if (!Array.isArray(user.profilePhotos)) {
      user.profilePhotos = [];
    }

    const isFirstPhoto = user.profilePhotos.length === 0;

    if (isFirstPhoto) {
      user.image = fileName;
    }

    user.profilePhotos.unshift({
      path: fileName,
      isAvatar: isFirstPhoto,
      uploadedAt: new Date(),
    });

    await user.save();

    return response.status(200).json({
      image: user.image,
      profilePhotos: user.profilePhotos,
    });
  } catch (err) {
    console.log({ err });
    return response.status(500).send("Internal Server Error");
  }
};

export const setAvatarPhoto = async (request, response) => {
  try {
    const { photoId } = request.params;
    const user = await User.findById(request.userId);

    if (!user) {
      return response.status(404).send("User not found");
    }

    if (!Array.isArray(user.profilePhotos) || user.profilePhotos.length === 0) {
      return response.status(400).send("User has no profile photos");
    }

    const selectedPhoto = user.profilePhotos.id(photoId);
    if (!selectedPhoto) {
      return response.status(404).send("Photo not found");
    }

    user.profilePhotos.forEach((photo) => {
      photo.isAvatar = String(photo._id) === String(photoId);
    });

    user.image = selectedPhoto.path;

    await user.save();

    return response.status(200).json({
      image: user.image,
      profilePhotos: user.profilePhotos,
    });
  } catch (err) {
    console.log({ err });
    return response.status(500).send("Internal Server Error");
  }
};

export const deleteProfilePhoto = async (request, response) => {
  try {
    const { photoId } = request.params;
    const user = await User.findById(request.userId);

    if (!user) {
      return response.status(404).send("User not found");
    }

    if (!Array.isArray(user.profilePhotos) || user.profilePhotos.length === 0) {
      return response.status(400).send("User has no profile photos");
    }

    const photoToDelete = user.profilePhotos.id(photoId);
    if (!photoToDelete) {
      return response.status(404).send("Photo not found");
    }

    const wasAvatar = photoToDelete.isAvatar;
    const deletedPath = photoToDelete.path;

    safelyDeleteFile(deletedPath);

    photoToDelete.deleteOne();

    if (user.profilePhotos.length === 0) {
      user.image = null;
    } else if (wasAvatar) {
      user.profilePhotos.forEach((photo, index) => {
        photo.isAvatar = index === 0;
      });
      user.image = user.profilePhotos[0].path;
    } else {
      const currentAvatar = user.profilePhotos.find((photo) => photo.isAvatar);
      user.image = currentAvatar ? currentAvatar.path : user.profilePhotos[0].path;

      if (!currentAvatar) {
        user.profilePhotos[0].isAvatar = true;
      }
    }

    await user.save();

    return response.status(200).json({
      image: user.image,
      profilePhotos: user.profilePhotos,
    });
  } catch (err) {
    console.log({ err });
    return response.status(500).send("Internal Server Error");
  }
};

export const logout = async (request, response) => {
  try {
    response.cookie("jwt", "", { maxAge: 1, secure: false, sameSite: "Lax" });
    return response.status(200).send("Logout successfull");
  } catch (err) {
    console.log({ err });
    return response.status(500).send("Internal Server Error");
  }
};