import asyncHandler from "express-async-handler";
import { Request, Response } from "express";
import Song from "../models/song.model";
import Like from "../models/like.model";
import { HttpStatus } from "../utils/HttpStatus";
import ApiResponse from "../utils/ApiResponse";
import ApiError from "../utils/ApiError";
import { Types } from "mongoose";
import { env } from "../config/env";

const toggleSongLike = asyncHandler(async (req: Request, res: Response) => {
  const songId = req.params.id;
  const song = await Song.exists({ _id: songId });
  if (!song) {
    res.status(404).json({ message: "Song not found" });
    return;
  }
  const likeData = {
    song: songId,
    likedBy: req.user._id,
  };

  const deletedLike = await Like.findOneAndDelete(likeData);
  if (deletedLike) {
    res
      .status(200)
      .send(
        new ApiResponse(
          HttpStatus.OK,
          "Successfully removed song from favourites",
          false,
        ),
      );
    return;
  }

  await Like.create(likeData);

  res
    .status(200)
    .send(
      new ApiResponse(
        HttpStatus.OK,
        "Successfully added song to favourites",
        true,
      ),
    );
});

const getLikedSongs = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { limit, cursor } = req.query;
  const currentUserId = new Types.ObjectId(req.user.id);
  const ownerId = new Types.ObjectId(env.OWNER_MONGOOSE_ID);
  const targetUserId = new Types.ObjectId(userId);
  const parsedLimit = Number(limit) || 10;

  // Only allow fetching own likes or owner's likes (which are public)
  if (!targetUserId.equals(currentUserId) && !targetUserId.equals(ownerId)) {
    throw new ApiError(
      HttpStatus.Unauthorized,
      "Not authorized to view this user's liked songs",
    );
  }

  const likedSongs = await Like.aggregate([
    {
      $match: {
        likedBy: targetUserId,
        song: { $exists: true },
        ...(cursor
          ? { song: { $gt: new Types.ObjectId(cursor as string) } }
          : {}),
      },
    },
    { $limit: parsedLimit },
    {
      $lookup: {
        from: "songs",
        localField: "song",
        foreignField: "_id",
        as: "song",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [{ $project: { username: 1 } }],
            },
          },
          {
            $unwind: {
              path: "$owner",
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $lookup: {
              from: "likes",
              let: { songId: "$_id" },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ["$song", "$$songId"] },
                        { $eq: ["$likedBy", currentUserId] },
                      ],
                    },
                  },
                },
              ],
              as: "likedDocs",
            },
          },
          {
            $addFields: { isLiked: { $gt: [{ $size: "$likedDocs" }, 0] } },
          },
          {
            $project: {
              title: 1,
              duration: 1,
              artist: 1,
              fileUrl: 1,
              playbackUrl: 1,
              owner: 1,
              createdAt: 1,
              updatedAt: 1,
              playCount: 1,
              isLiked: 1,
            },
          },
        ],
      },
    },
    { $unwind: "$song" },
    { $replaceRoot: { newRoot: "$song" } },
  ]);

  const isOwnerFavourite = targetUserId.equals(ownerId);
  res.status(HttpStatus.OK).json(
    new ApiResponse(HttpStatus.OK, "Liked songs fetched successfully", {
      _id: userId,
      name: isOwnerFavourite ? "Owner's Favourite Songs" : "Favourite Songs",
      description: isOwnerFavourite
        ? "This playlist contains owner's favourite songs"
        : "This playlist contains your favourite songs",
      status: isOwnerFavourite ? "public" : "private",
      isDefault: true,
      songs: likedSongs,
    }),
  );
});

export { toggleSongLike, getLikedSongs };
