import { Router } from "express";
import { verifyToken } from "../middlewares/AuthMiddleware.js";
import {
  searchUsersForFriendship,
  sendFriendRequest,
  getIncomingFriendRequests,
  getOutgoingFriendRequests,
  acceptFriendRequest,
  rejectFriendRequest,
  removeFriend,
  getFriendsList,
  getFriendsSelector,
  cancelOutgoingFriendRequest,
} from "../conrollers/FriendsController.js";

const friendsRoutes = Router();

friendsRoutes.post("/search-users", verifyToken, searchUsersForFriendship);
friendsRoutes.post("/request/:userId", verifyToken, sendFriendRequest);
friendsRoutes.get("/requests/incoming", verifyToken, getIncomingFriendRequests);
friendsRoutes.get("/requests/outgoing", verifyToken, getOutgoingFriendRequests);
friendsRoutes.patch("/request/:requestId/accept", verifyToken, acceptFriendRequest);
friendsRoutes.patch("/request/:requestId/reject", verifyToken, rejectFriendRequest);
friendsRoutes.delete("/:friendId", verifyToken, removeFriend);
friendsRoutes.get("/list", verifyToken, getFriendsList);
friendsRoutes.get("/selector", verifyToken, getFriendsSelector);
friendsRoutes.delete("/request/:requestId", verifyToken, cancelOutgoingFriendRequest)

export default friendsRoutes;
