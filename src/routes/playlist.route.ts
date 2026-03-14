import { Router } from "express";
import { validate } from "../middlewares/validate.middleware";
import {
  authMiddleware,
  authMiddlewareNotStrict,
} from "../middlewares/auth.middleware";
import {
  addSongs,
  createPlaylist,
  getPlaylistSongs,
  getPlaylist,
} from "../controllers/playlist.controller";
import {
  createPlaylistSchema,
  modifyPlaylistSongSchema,
  getPlaylistSongsSchema,
} from "../schemas/playlist.schema";

const router = Router();

router.get(
  "/:playlistId",
  authMiddleware,
  validate(getPlaylistSongsSchema),
  getPlaylistSongs,
);
router
  .route("/")
  .get(authMiddleware, getPlaylist)
  .post(authMiddleware, validate(createPlaylistSchema), createPlaylist);

router.patch(
  "/:playlistId/add",
  authMiddleware,
  validate(modifyPlaylistSongSchema),
  addSongs,
);

export default router;
