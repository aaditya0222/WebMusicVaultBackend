import { Router } from "express";
const router = Router();
import { upload } from "../middlewares/multer.middleware";

import {
  uploadSongs,
  getSongById,
  deleteSongById,
  getRandomSong,
  updateAllFieldsOfSong,
  getSongsOrSearchSongs,
  getAllSongOfArtist,
  increamentPlayCount,
} from "../controllers/song.controller";
import {
  idParamSchema,
  updateSongSchema,
  uploadSongSchema,
} from "../schemas/song.schema";
import { validate } from "../middlewares/validate.middleware";
import {
  authMiddleware,
  authMiddlewareNotStrict,
} from "../middlewares/auth.middleware";

//Upload song
router.post(
  "/",
  authMiddleware,
  upload.array("songs", 3),
  validate(uploadSongSchema),
  uploadSongs,
);
//Get songs for main page and for searching songs
router.get("/", authMiddlewareNotStrict, getSongsOrSearchSongs);
//Get random songs for shuffle play
router.get("/random", getRandomSong);
//Get all songs of a particular artist
router.get("/artist/:artist", getAllSongOfArtist);
//Get song by id
router.get("/:id", validate(idParamSchema), getSongById);
//Delete song by id
router.delete("/:id", authMiddleware, validate(idParamSchema), deleteSongById);
//Update song by id
router.patch(
  "/:id",
  authMiddleware,
  validate(updateSongSchema),
  updateAllFieldsOfSong,
);
router.patch("/:id/incrplaycount", increamentPlayCount);

// Note: Use a PATCH /songs/:id route to allow partial updates to a song’s details like title, artist, genre, and tags. Only the owner of the song can perform these edits; all other users should be restricted. Validate inputs and merge updates without overwriting the entire document.

//route for updating song detail below goes there
export default router;
