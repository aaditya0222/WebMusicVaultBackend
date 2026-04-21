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
  const currentUserId = req.user?.id ? new Types.ObjectId(req.user.id) : null;
  const ownerId = new Types.ObjectId(env.OWNER_MONGOOSE_ID);
  const targetUserId = new Types.ObjectId(userId);
  const parsedLimit = Number(limit) || 10;
  let hasMoreSongs = false;
  let nextCursor: string | undefined;
  // Only allow fetching own likes or owner's likes (which are public)
  if (
    (!currentUserId || !targetUserId.equals(currentUserId)) &&
    !targetUserId.equals(ownerId)
  ) {
    throw new ApiError(
      HttpStatus.Unauthorized,
      "Not authorized to view this user's liked songs",
    );
  }

  const songs = await Like.aggregate([
    {
      $match: {
        likedBy: targetUserId,
        song: { $exists: true },
        ...(cursor
          ? { createdAt: { $lt: new Date(cursor as string) } } // Sort by like date
          : {}),
      },
    },
    { $sort: { createdAt: -1 } }, // Newest likes first
    { $limit: parsedLimit + 1 },
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
              coverImageUrl: 1,
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
    {
      $addFields: {
        "song.likedAt": "$createdAt",
      },
    },
    { $replaceRoot: { newRoot: "$song" } },
  ]);
  if (songs.length > parsedLimit) {
    hasMoreSongs = true;
    songs.pop();
  }
  if (!hasMoreSongs || songs.length === 0) {
    nextCursor = undefined;
  } else {
    // Return the createdAt of the last like as the cursor
    nextCursor = songs[songs.length - 1].likedAt.toISOString();
  }
  const isOwnerFavourite = targetUserId.equals(ownerId);
  const data = {
    _id: userId,
    name: isOwnerFavourite ? "Owner's Favourite Songs" : "Favourite Songs",
    description: isOwnerFavourite
      ? "This playlist contains owner's favourite songs"
      : "This playlist contains your favourite songs",
    status: isOwnerFavourite ? "public" : "private",
    isDefault: true,
    songs,
    nextCursor,
    hasMoreSongs,
  };

  res
    .status(HttpStatus.OK)
    .json(
      new ApiResponse(HttpStatus.OK, "Liked songs fetched successfully", data),
    );
});

export { toggleSongLike, getLikedSongs };
