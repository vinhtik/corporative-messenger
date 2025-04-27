import { Router } from "express";
import { searchContacts } from "../conrollers/ContactsController.js";
import { verifyToken } from "../middlewares/AuthMiddleware.js";

const contactsRoutes = Router();

contactsRoutes.post("/search", verifyToken, searchContacts)

export default contactsRoutes;