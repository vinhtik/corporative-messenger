import bcrypt from "bcryptjs";
import mongoose from "mongoose";

const profilePhotoSchema = new mongoose.Schema(
  {
    path: {
      type: String,
      required: true,
    },
    isAvatar: {
      type: Boolean,
      default: false,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, "Почта обязательна."],
    unique: true,
    trim: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: [true, "Пароль обязателен"],
    maxLength: 67,
  },
  firstName: {
    type: String,
    required: false,
    maxLength: 67,
  },
  lastName: {
    type: String,
    required: false,
    maxLength: 67,
  },

  image: {
    type: String,
    required: false,
  },

  profilePhotos: {
    type: [profilePhotoSchema],
    default: [],
  },

  color: {
    type: Number,
    required: false,
  },
  profileSetup: {
    type: Boolean,
    default: false,
  },
    pushTokens: {
        type: [String],
        default: [],
    },
});

userSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();
    const salt = await bcrypt.genSalt();
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

const User = mongoose.model("Users", userSchema);

export default User;