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
  getPlaylists,
  removeSongs,
  updatePlaylist,
} from "../controllers/playlist.controller";
import {
  createPlaylistSchema,
  modifyPlaylistSongSchema,
  removePlaylistSongSchema,
  getPlaylistSongsSchema,
  updatePlaylistSchema,
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
  .get(authMiddlewareNotStrict, getPlaylists)
  .post(authMiddleware, validate(createPlaylistSchema), createPlaylist);

router.patch(
  "/:playlistId/add",
  authMiddleware,
  validate(modifyPlaylistSongSchema),
  addSongs,
);

router.patch(
  "/:playlistId/remove",
  authMiddleware,
  validate(removePlaylistSongSchema),
  removeSongs,
);

router.put(
  "/:playlistId",
  authMiddleware,
  validate(updatePlaylistSchema),
  updatePlaylist,
);

export default router;
