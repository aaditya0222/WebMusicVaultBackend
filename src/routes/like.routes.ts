import { Router } from "express";
import { toggleSongLike, getLikedSongs } from "../controllers/like.controller";
import { validate } from "../middlewares/validate.middleware";
import { likeSongSchema } from "../schemas/like.schema";
import { authMiddleware } from "../middlewares/auth.middleware";
const router = Router();

router.post(
  "/:id/toggle",
  authMiddleware,
  validate(likeSongSchema),
  toggleSongLike,
);

router.get("/:userId", authMiddleware, getLikedSongs);

export default router;
