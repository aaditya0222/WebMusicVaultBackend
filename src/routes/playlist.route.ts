import { Router } from "express";
import { validate } from "../middlewares/validate.middleware";
import { authMiddleware } from "../middlewares/auth.middleware";
import {
  addSongs,
  createPlaylist,
  getPlaylistSongs,
} from "../controllers/playlist.controller";
import {
  createPlaylistSchema,
  modifyPlaylistSongSchema,
  getPlaylistSongsSchema,
} from "../schemas/playlist.schema";

const router = Router();

router
  .route("/")
  .get(authMiddleware, validate(getPlaylistSongsSchema), getPlaylistSongs)
  .post(authMiddleware, validate(createPlaylistSchema), createPlaylist);

router.patch(
  "/:playlistId/songs",
  authMiddleware,
  validate(modifyPlaylistSongSchema),
  addSongs,
);

export default router;
