import { v2 as cloudinary } from "cloudinary";
import { UploadApiResponse } from "cloudinary";
import { env } from "../config/env";
import ApiError from "../utils/ApiError";
import { HttpStatus } from "../utils/HttpStatus";
import { SongI } from "../models/song.model";

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true,
});

type resource_type = "video" | "image";
type uploadParams = {
  buffer: Buffer;
  folder: "songs" | "avatars" | "coverImages";
  resource_type: resource_type;
};
const uploadFile = async ({
  buffer,
  folder,
  resource_type,
}: uploadParams): Promise<UploadApiResponse> => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type,
        folder,
        // Only songs are private (authenticated delivery, signed URLs).
        // Covers and avatars stay public ("upload") since they're rendered
        // via unsigned direct URLs.
        type: folder === "songs" ? "authenticated" : "upload",
      },
      (error, result) => {
        if (error) {
          console.error("Upload failed:", error);
          return reject(error);
        }
        if (!result) {
          return reject(
            new ApiError(
              HttpStatus.InternalServerError,
              "No result returned from Cloudinary",
            ),
          );
        }
        resolve(result);
      },
    );

    stream.end(buffer);
  });
};

const deleteFile = async ({
  publicId,
  resource_type,
}: {
  publicId: string;
  resource_type: resource_type;
}) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.destroy(
      publicId,
      {
        resource_type,
      },
      (error, result) => {
        if (error) {
          reject(new Error(`Cloudinary Delete failed: ${error.message}`));
        } else {
          resolve(result);
        }
      },
    );
  });
};

// Streaming URL generation.
//
// Tradeoff (intentional): we use cloudinary.url() with sign_url:true (direct
// res.cloudinary.com CDN delivery, instant playback start) instead of
// private_download_url() (api.cloudinary.com download endpoint + redirect,
// which caused a 5-10s playback delay).
//
// Note: signed CDN URLs do NOT enforce real expiry — they remain valid until
// the API secret is rotated. Access control comes from the asset being
// type: "authenticated" (unsigned URLs 401) + the signature itself. This is
// an accepted tradeoff for playback speed; end-of-life ends when secrets are
// rotated.
//
// `download` (attachment flag) is intentionally ignored here — it only
// applies to private_download_url() responses, not signed delivery URLs. It
// is kept as a no-op parameter for call-site compatibility.
const getSongUrl = (
  publicId: string,
  { download = false }: { download?: boolean } = {},
): string => {
  return cloudinary.url(publicId, {
    resource_type: "video",
    type: "authenticated",
    format: "mp3",
    sign_url: true,
    secure: true,
  });
};

const getSongsUrl = (songs: SongI[]): SongI[] => {
  for (const song of songs) {
    song.fileUrl = getSongUrl(song.publicId);
  }
  return songs;
};
export { uploadFile, deleteFile, getSongUrl, getSongsUrl };
export default cloudinary;
