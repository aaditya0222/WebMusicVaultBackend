import Playlist from "../models/playlist.model";
import asyncHandler from "express-async-handler";
import { Request, Response } from "express";
import ApiError from "../utils/ApiError";
import ApiResponse from "../utils/ApiResponse";
import { PipelineStage, Types } from "mongoose";
import { HttpStatus } from "../utils/HttpStatus";
import Song from "../models/song.model";
import { createPlaylistSchemaType } from "../schemas/playlist.schema";
import { env } from "../config/env";
import { getSongsUrl } from "../config/cloudinary";

const createPlaylist = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { name, status, description } = req.body as createPlaylistSchemaType;
    // Enforce per-user playlist limit
    const playlistCount = await Playlist.countDocuments({ owner: req.user.id });
    if (playlistCount >= 10) {
      throw new ApiError(
        HttpStatus.BadRequest,
        "You can create up to 10 playlists. Delete one to add another.",
      );
    }
    const existingPlaylist = await Playlist.findOne({
      name,
      owner: req.user.id,
    });
    if (existingPlaylist) {
      throw new ApiError(
        HttpStatus.Conflict,
        `Playlist with name '${name}' is already exist`,
      );
    }
    const playlist = await Playlist.create({
      name,
      status,
      description,
      owner: req.user.id,
    });
    const playlistData = playlist.toObject();
    res
      .status(HttpStatus.Created)
      .json(
        new ApiResponse(HttpStatus.OK, "Playlist created successfully", {
          ...playlistData,
          songs: playlistData.songs.length,
        }),
      );
  },
);
const getPlaylists = asyncHandler(async (req, res) => {
  const userId = req.user?.id ? new Types.ObjectId(req.user.id) : null;
  const ownerId = new Types.ObjectId(env.OWNER_MONGOOSE_ID);

  const userLikePipeline: PipelineStage[] = userId
    ? [
        {
          $unionWith: {
            coll: "likes",
            pipeline: [
              { $match: { likedBy: userId } },
              { $group: { _id: "$likedBy", songs: { $count: {} } } },
              {
                $addFields: {
                  name: "Favourite Songs",
                  description: "This playlist contains your favourite songs",
                  status: "private",
                  isDefault: true,
                  owner: userId,
                },
              },
              {
                $lookup: {
                  from: "users",
                  localField: "owner",
                  foreignField: "_id",
                  as: "owner",
                  pipeline: [{ $project: { username: 1 } }],
                },
              },
              { $unwind: { path: "$owner", preserveNullAndEmptyArrays: true } },
            ],
          },
        },
      ]
    : [];

  const ownerLIkePipeline: PipelineStage = {
    $unionWith: {
      coll: "likes",
      pipeline: [
        { $match: { likedBy: ownerId } },
        { $group: { _id: "$likedBy", songs: { $count: {} } } },
        {
          $addFields: {
            name: "Owner's Favourite Songs",
            description: "This playlist contains owner's favourite songs",
            status: "public",
            isDefault: true,
            owner: ownerId,
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "owner",
            foreignField: "_id",
            as: "owner",
            pipeline: [{ $project: { username: 1 } }],
          },
        },
        { $unwind: { path: "$owner", preserveNullAndEmptyArrays: true } },
      ],
    },
  };

  const playlists = await Playlist.aggregate([
    {
      $match: { owner: userId || { $exists: false } }, // Match nothing personal if guest
    },
    {
      $addFields: { songs: { $size: "$songs" } },
    },
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
      $unwind: { path: "$owner", preserveNullAndEmptyArrays: true },
    },
    ...userLikePipeline,
    ownerLIkePipeline,
    {
      $group: {
        _id: null,
        defaultPlaylists: {
          $push: {
            $cond: [{ $eq: ["$isDefault", true] }, "$$ROOT", "$$REMOVE"],
          },
        },
        personalPlaylists: {
          $push: {
            $cond: [{ $eq: ["$isDefault", false] }, "$$ROOT", "$$REMOVE"],
          },
        },
      },
    },
    { $project: { _id: 0 } },
  ]);

  const result = playlists[0] || {
    defaultPlaylists: [],
    personalPlaylists: [],
  };

  // Remove duplicate owner playlist if the current user is the owner
  if (userId && userId.equals(ownerId) && result.defaultPlaylists.length > 0) {
    result.defaultPlaylists.pop();
  }

  res
    .status(HttpStatus.OK)
    .json(
      new ApiResponse(HttpStatus.OK, "Playlists fetched successfully", result),
    );
});

const addSongs = asyncHandler(async (req, res) => {
  const { songIds } = req.body;
  const { playlistId } = req.params;
  const playlist = await Playlist.findById(playlistId);
  if (!playlist) {
    throw new ApiError(HttpStatus.NotFound, "Invalid Playlist");
  }
  if (!playlist.owner.equals(req.user._id)) {
    throw new ApiError(
      HttpStatus.Unauthorized,
      "This playlist doesn't belongs to current user",
    );
  }
  type skippedSongT = {
    title?: string;
    id: Types.ObjectId;
    message: string;
  };
  const skippedSongs: skippedSongT[] = [];

  for (const songId of songIds) {
    const song = await Song.findById(songId);
    if (!song) {
      skippedSongs.push({
        id: songId,
        message: "Invalid song",
      });
      continue;
    }
    if (playlist.songs.includes(song._id)) {
      skippedSongs.push({
        title: song.title,
        id: song._id,
        message: `'${song.title}' is already present in the playlist`,
      });
      continue;
    }
    // Enforce per-playlist song limit
    if (playlist.songs.length >= 50) {
      skippedSongs.push({
        title: song.title,
        id: song._id,
        message: "A playlist can hold up to 50 songs",
      });
      continue;
    }
    playlist.songs.push(songId);
  }
  await playlist.save();
  res.status(HttpStatus.OK).json(
    new ApiResponse(HttpStatus.OK, "Successfully added song to the playlist", {
      playlist,
      skipped: skippedSongs,
    }),
  );
});
const removeSongs = asyncHandler(async (req, res) => {
  const { songIds } = req.body;
  const { playlistId } = req.params;
  const playlist = await Playlist.findById(playlistId);
  if (!playlist) {
    throw new ApiError(HttpStatus.NotFound, "Invalid Playlist");
  }
  if (!playlist.owner.equals(req.user._id)) {
    throw new ApiError(
      HttpStatus.Unauthorized,
      "This playlist doesn't belongs to current user",
    );
  }

  let removed = 0;
  for (const songId of songIds) {
    const index = playlist.songs.findIndex((song) => song.equals(songId));
    if (index === -1) continue;
    playlist.songs.splice(index, 1);
    removed++;
  }

  if (removed > 0) {
    await playlist.save();
  }

  res.status(HttpStatus.OK).json(
    new ApiResponse(
      HttpStatus.OK,
      "Successfully removed song from the playlist",
      { playlist, removed },
    ),
  );
});
const updatePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  const { name, description, status } = req.body;

  const playlist = await Playlist.findById(playlistId);
  if (!playlist) {
    throw new ApiError(HttpStatus.NotFound, "Invalid Playlist");
  }
  if (!playlist.owner.equals(req.user._id)) {
    throw new ApiError(
      HttpStatus.Unauthorized,
      "This playlist doesn't belongs to current user",
    );
  }
  if (playlist.isDefault) {
    throw new ApiError(
      HttpStatus.BadRequest,
      "Default playlists cannot be edited",
    );
  }

  if (name && name !== playlist.name) {
    const duplicate = await Playlist.findOne({
      owner: req.user._id,
      name,
      _id: { $ne: playlistId },
    });
    if (duplicate) {
      throw new ApiError(
        HttpStatus.Conflict,
        `Playlist with name '${name}' is already exist`,
      );
    }
    playlist.name = name;
  }

  if (description !== undefined) {
    playlist.description = description;
  }
  if (status !== undefined) {
    playlist.status = status;
  }

  await playlist.save();
  const playlistData = playlist.toObject();
  res.status(HttpStatus.OK).json(
    new ApiResponse(HttpStatus.OK, "Playlist updated successfully", {
      ...playlistData,
      songs: playlistData.songs.length,
    }),
  );
});
const getPlaylistSongs = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  const { limit, cursor } = req.query;

  const parsedLimit = Number(limit) || 10;
  const userId = new Types.ObjectId(req.user.id);

  const songsData = await Playlist.aggregate([
    {
      $match: {
        $expr: { $eq: ["$_id", { $toObjectId: playlistId }] },
        $or: [{ owner: userId }, { status: "public" }],
      },
    },
    {
      $lookup: {
        from: "songs",
        localField: "songs",
        foreignField: "_id",
        as: "songs",
        pipeline: [
          ...(cursor
            ? [
                {
                  $match: {
                    _id: { $gt: new Types.ObjectId(cursor as string) },
                  },
                },
              ]
            : []),

          { $sort: { _id: 1 } },

          { $limit: parsedLimit + 1 },

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
                        { $eq: ["$likedBy", userId] },
                      ],
                    },
                  },
                },
              ],
              as: "likedDocs",
            },
          },
          {
            $addFields: {
              isLiked: { $gt: [{ $size: "$likedDocs" }, 0] },
            },
          },
          {
            $project: {
              title: 1,
              duration: 1,
              artist: 1,
              publicId: 1,
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
  ]);

  if (!songsData.length) {
    throw new ApiError(HttpStatus.NotFound, "Invalid Playlist");
  }

  const playlist = songsData[0];
  const songs = playlist.songs;

  let hasMoreSongs = false;
  let nextCursor: string | undefined = undefined;

  if (songs.length > parsedLimit) {
    hasMoreSongs = true;
    songs.pop();
  }

  if (songs.length > 0) {
    nextCursor = songs[songs.length - 1]._id.toString();
  }

  res.status(HttpStatus.OK).json(
    new ApiResponse(HttpStatus.OK, "Playlist songs fetched successfully", {
      ...playlist,
      songs: getSongsUrl(songs),
      nextCursor,
      hasMoreSongs,
    }),
  );
});
export {
  createPlaylist,
  addSongs,
  removeSongs,
  getPlaylistSongs,
  getPlaylists,
  updatePlaylist,
};
