import { Router } from "express";
const router = Router();
import { upload } from "../middlewares/multer.middleware";

import {
  uploadSong,
  getSongById,
  deleteSongById,
  getRandomSong,
  updateRequiredFieldsOfSong,
  getSongsOrSearchSongs,
  getAllSongOfArtist,
  increamentPlayCount,
  getPinnedSongs,
  setPinSong,
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
import { uploadLimiter } from "../services/song.services";

//Upload song
router.post(
  "/",
  uploadLimiter,
  authMiddleware,
  // upload.array("songs", 3),
  upload.fields([
    { name: "song", maxCount: 1 },
    { name: "coverImage", maxCount: 1 },
  ]),
  validate(uploadSongSchema),
  uploadSong,
);
//Get songs for main page and for searching songs
router.get("/", authMiddlewareNotStrict, getSongsOrSearchSongs);
//Get random songs for shuffle play
router.get("/random/:count", authMiddlewareNotStrict, getRandomSong);
//Get all songs of a particular artist
router.get("/artist/:artist", getAllSongOfArtist);
//Get pinned songs for the current user
router.get("/pinned", authMiddlewareNotStrict, getPinnedSongs);
router.put("/:id/pin", authMiddleware, setPinSong(true));
router.delete("/:id/pin", authMiddleware, setPinSong(false));
//Get song by id
router.get(
  "/:id",
  authMiddlewareNotStrict,
  validate(idParamSchema),
  getSongById,
);
//Delete song by id
router.delete("/:id", authMiddleware, validate(idParamSchema), deleteSongById);
//Update song by id
router.patch(
  "/:id",
  authMiddleware,
  upload.single("coverImage"),
  validate(updateSongSchema),
  updateRequiredFieldsOfSong,
);

router.patch("/:id/incrplaycount", increamentPlayCount);
export default router;
