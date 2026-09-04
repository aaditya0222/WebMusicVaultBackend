import multer from "multer";
import ApiError from "../utils/ApiError";
import { HttpStatus } from "../utils/HttpStatus";
import { env } from "../config/env";

const storage = multer.memoryStorage();

const fileFilter: multer.Options["fileFilter"] = (_req, file, cb): void => {
  const allowedMimetypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedMimetypes.includes(file.mimetype)) {
    return cb(
      new ApiError(
        HttpStatus.BadRequest,
        "Invalid file type. Only JPEG, PNG, and WebP images are allowed",
      ),
    );
  }
  cb(null, true);
};

export const uploadAvatar = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: env.MAX_COVER_IMAGE_FILE_SIZE,
  },
});
