import { Router } from "express";
import { getAllContacs, getContactProfile, getContactsForDMList, searchContacts } from "../conrollers/ContactsController.js";
import { verifyToken } from "../middlewares/AuthMiddleware.js";

const contactsRoutes = Router();

contactsRoutes.post("/search", verifyToken, searchContacts);
contactsRoutes.get("/get-contacts-for-dm", verifyToken, getContactsForDMList)
contactsRoutes.get("/get-all-contacts", verifyToken, getAllContacs)
contactsRoutes.get("/profile/:userId", verifyToken, getContactProfile)
export default contactsRoutes;