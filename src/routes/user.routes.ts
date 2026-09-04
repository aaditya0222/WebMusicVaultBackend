import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import { getUserProfile, updateUser } from "../controllers/user.controller";
import { updateUserSchema } from "../schemas/user.schema";
import { uploadAvatar } from "../middlewares/avatar.middleware";
const router = Router();

//Get user profile and details
router.get("/me", authMiddleware, getUserProfile);
//Update user profile details (displayName, username, avatar)
router.put(
  "/update",
  authMiddleware,
  uploadAvatar.single("avatar"),
  validate(updateUserSchema),
  updateUser,
);

export default router;
