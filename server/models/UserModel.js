import bcrypt from "bcryptjs";
import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    email:{
        type: String,
        required: [true, "Почта обязательна."],
        unique: true,
    },
    password:{
        type: String,
        required: [true, "Пароль обязателен"],
        maxLength: 67
    },
    firstName:{
        type: String,
        required: false,
        maxLength: 67
    },
    lastName:{
        type: String,
        required: false,
        maxLength: 67
    },
    image:{
        type: String,
        required: false,
    },
    color:{
        type: Number,
        required: false,
    },
    profileSetup:{
        type: Boolean,
        default: false,
    },
});

userSchema.pre("save", async function(next) {
    const salt = await bcrypt.genSalt();
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

const User = mongoose.model("Users", userSchema);

export default User;