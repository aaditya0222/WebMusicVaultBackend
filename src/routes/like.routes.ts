import { Router } from "express";
import { toggleSongLike, getLikedSongs } from "../controllers/like.controller";
import { validate } from "../middlewares/validate.middleware";
import { likeSongSchema, getLikedSongsSchema } from "../schemas/like.schema";
import { authMiddleware, authMiddlewareNotStrict } from "../middlewares/auth.middleware";
const router = Router();

router.post(
  "/:id/toggle",
  authMiddleware,
  validate(likeSongSchema),
  toggleSongLike,
);

router.get(
  "/:userId",
  authMiddlewareNotStrict,
  validate(getLikedSongsSchema),
  getLikedSongs,
);

export default router;
