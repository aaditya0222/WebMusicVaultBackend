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
