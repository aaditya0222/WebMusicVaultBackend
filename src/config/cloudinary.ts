import { v2 as cloudinary } from "cloudinary";
import { UploadApiResponse } from "cloudinary";
import { env } from "../config/env";
import ApiError from "../utils/ApiError";
import { HttpStatus } from "../utils/HttpStatus";

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true,
});

type resource_type = "video" | "image";
type uploadParams = {
  buffer: Buffer;
  folder: "songs" | "avatars";
  resource_type: resource_type;
};
const uploadFile = async ({
  buffer,
  folder,
  resource_type,
}: uploadParams): Promise<UploadApiResponse> => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { resource_type, folder },
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
