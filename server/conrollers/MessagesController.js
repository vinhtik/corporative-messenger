import User from "../models/UserModel.js";
import Message from '../models/MessagesModel.js'
import {mkdirSync, renameSync} from 'fs'

export const getMessages = async (request, response, next) => {
    try{
        const user1 = request.userId;
        const user2 = request.body.id;

        if(!user1 || !user2) {
            return response.status(400).send("Both user ID's are required");
        }

        const messages = await Message.find({
            $or:[
                { sender: user1, recipient: user2 },
                { sender: user2, recipient: user1 }
            ],
        }).sort({ timestamp: 1 });

        return response.status(200).json({ messages });
    }catch (err){
        console.log({err});
        return response.status(500).send("Internal Server Error")
    }
};

export const uploadFile = async (request, response, next) => {
    try{
       if (!request.file) {
        return response.status(400).send("File is reqired");
       }
       const date = Date.now();
       let fileDir = `uploads/files/${date}`;
       const originalName = Buffer.from(request.file.originalname, 'latin1').toString('utf8');
       const fileName = `${fileDir}/${originalName}`;
       
       mkdirSync(fileDir, { recursive: true });
       
       renameSync(request.file.path, fileName);

        return response.status(200).json({ filePath: fileName });
    }catch (err){
        console.log({err});
        return response.status(500).send("Internal Server Error")
    }
};