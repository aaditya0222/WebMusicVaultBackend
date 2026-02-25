import { Router } from "express";
import { toggleSongLike } from "../controllers/like.controller";
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

export default router;
