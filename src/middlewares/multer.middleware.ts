import multer from "multer";
import ApiError from "../utils/ApiError";
import { HttpStatus } from "../utils/HttpStatus";
import { env } from "../config/env";
const storage = multer.memoryStorage();
const fileFilter: multer.Options["fileFilter"] = (_req, file, cb): void => {
  const allowedMimetypes = [
    "audio/mpeg",
    "image/jpeg",
    "image/png",
    "image/webp",
  ];
  if (!allowedMimetypes.includes(file.mimetype)) {
    return cb(new ApiError(HttpStatus.BadRequest, "Invalid file type"));
  }
  cb(null, true);
};
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: env.MAX_MUSIC_FILE_SIZE,
  },
});

// Standalone cover-image uploads (update route) get a dedicated image-only
// uploader capped at the cover size, mirroring the avatar middleware. The
// create route still uploads song + cover through `upload`, where the cover's
// smaller limit is enforced in song.services.ts (one multer per request body).
const coverFileFilter: multer.Options["fileFilter"] = (_req, file, cb): void => {
  const allowedMimetypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedMimetypes.includes(file.mimetype)) {
    return cb(
      new ApiError(HttpStatus.BadRequest, "Invalid file type"),
    );
  }
  cb(null, true);
};

export const uploadCoverImage = multer({
  storage,
  fileFilter: coverFileFilter,
  limits: {
    fileSize: env.MAX_COVER_IMAGE_FILE_SIZE,
  },
});
