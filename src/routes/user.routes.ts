import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import { getUserProfile, updateUser } from "../controllers/user.controller";
const router = Router();

//Get user profile and details
router.get("/me", authMiddleware, getUserProfile);
//Update user profile details
router.put("/update", authMiddleware, updateUser);

export default router;
