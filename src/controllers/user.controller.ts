import expressAsyncHandler from "express-async-handler";
import { Request, Response } from "express";
import { HttpStatus } from "../utils/HttpStatus";
import ApiResponse from "../utils/ApiResponse";
import ApiError from "../utils/ApiError";
import { getUserDetailsToSend } from "../services/auth.services";
import Song from "../models/song.model";
import Like from "../models/like.model";
import User from "../models/user.model";
import { uploadFile, deleteFile } from "../config/cloudinary";

const getUserProfile = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const user = getUserDetailsToSend(req.user);

    const [uploadedSongs, favouriteSongs] = await Promise.all([
      Song.countDocuments({ owner: req.user.id }),
      Like.countDocuments({ likedBy: req.user.id, song: { $exists: true } }),
    ]);

    res.status(HttpStatus.OK).json(
      new ApiResponse(HttpStatus.OK, "Successfully sent user data", {
        ...user,
        uploadedSongs,
        favouriteSongs,
      }),
    );
  },
);

const updateUser = expressAsyncHandler(async (req: Request, res: Response) => {
    const { displayName, username } = req.body;
    const avatarFile = req.file;

    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(HttpStatus.NotFound, "User not found");
    }

    // Username change: ensure uniqueness
    if (username && username !== user.username) {
      const existing = await User.findOne({ username });
      if (existing) {
        throw new ApiError(
          HttpStatus.Conflict,
          "Username is already taken",
        );
      }
      user.username = username;
    }

    // Display name change
    if (displayName) {
      user.displayName = displayName;
    }

    // Avatar upload
    if (avatarFile) {
      const uploadResult = await uploadFile({
        buffer: avatarFile.buffer,
        folder: "avatars",
        resource_type: "image",
      });

      if (!uploadResult || "error" in uploadResult) {
        throw new ApiError(
          HttpStatus.InternalServerError,
          "Failed to upload avatar",
        );
      }

      // Delete old avatar from Cloudinary if it was uploaded (not a default avatar)
      if (user.avatar && user.avatar.includes("cloudinary.com")) {
        try {
          const publicId = getPublicIdFromUrl(user.avatar);
          if (publicId) {
            await deleteFile({ publicId, resource_type: "image" });
          }
        } catch (err) {
          // Log but don't fail the update if old avatar deletion fails
          console.error("Failed to delete old avatar:", err);
        }
      }

      user.avatar = uploadResult.secure_url;
    }

    await user.save();

    const updatedUser = getUserDetailsToSend(user);
    const [uploadedSongs, favouriteSongs] = await Promise.all([
      Song.countDocuments({ owner: userId }),
      Like.countDocuments({ likedBy: userId, song: { $exists: true } }),
    ]);

    res.status(HttpStatus.OK).json(
      new ApiResponse(HttpStatus.OK, "Profile updated successfully", {
        ...updatedUser,
        uploadedSongs,
        favouriteSongs,
      }),
    );
  });

// Helper function to extract public_id from Cloudinary URL
function getPublicIdFromUrl(url: string): string | null {
  const match = url.match(/\/v\d+\/(.+?)\./);
  return match ? match[1] : null;
}

  export { getUserProfile, updateUser };
