import { v2 as cloudinary } from "cloudinary";
import { UploadApiResponse } from "cloudinary";
import { env } from "../config/env";

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true,
});

export const uploadSong = async (
  buffer: Buffer,
): Promise<UploadApiResponse> => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { resource_type: "video", folder: "songs" },
      (error, result) => {
        if (error) {
          console.error("Upload failed:", error);
          return reject(error);
        }
        resolve(result!);
      },
    );

    stream.end(buffer);
  });
};

export const deleteSong = async (publicId: string) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.destroy(
      publicId,
      {
        resource_type: "video",
      },
      (err, result) => {
        if (err) {
          reject(new Error(`Cloudinary Delete failed: ${err.message}`));
        } else {
          resolve(result);
        }
      },
    );
  });
};

export const getSongPlaybackUrl = async (publicId: string) => {
  try {
    const playbackUrl = await cloudinary.api.resource(publicId, {
      resource_type: "video",
    });
    return playbackUrl;
  } catch (error) {
    console.log(error);
  }
};
export const allSongs = async () => {
  //will write it later
};
export default cloudinary;
