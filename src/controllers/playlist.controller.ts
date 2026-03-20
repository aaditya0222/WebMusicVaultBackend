import Playlist from "../models/playlist.model";
import asyncHandler from "express-async-handler";
import { Request, Response } from "express";
import ApiError from "../utils/ApiError";
import ApiResponse from "../utils/ApiResponse";
import { Types } from "mongoose";
import { HttpStatus } from "../utils/HttpStatus";
import Song from "../models/song.model";
import { createPlaylistSchemaType } from "../schemas/playlist.schema";
import { env } from "../config/env";

const createPlaylist = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { name, status, description } = req.body as createPlaylistSchemaType;
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
    res
      .status(HttpStatus.Created)
      .json(new ApiResponse(HttpStatus.OK, "Successfully logged in", playlist));
  },
);

const getPlaylists = asyncHandler(async (req, res) => {
  const playlists = await Playlist.aggregate([
    {
      $match: {
        owner: new Types.ObjectId(req.user.id),
      },
    },
    {
      $addFields: {
        songs: { $size: "$songs" },
      },
    },
    {
      $unionWith: {
        coll: "likes",
        pipeline: [
          {
            $match: {
              likedBy: new Types.ObjectId(req.user.id),
            },
          },
          {
            $group: {
              _id: "$likedBy",
              songs: { $count: {} },
            },
          },
          {
            $addFields: {
              name: "Favourite Songs",
              description: "This playlist contains your favourite songs",
              status: "private",
              isDefault: true,
            },
          },
        ],
      },
    },
    {
      $unionWith: {
        coll: "likes",
        pipeline: [
          {
            $match: {
              likedBy: new Types.ObjectId(env.OWNER_MONGOOSE_ID),
            },
          },
          {
            $group: {
              _id: "$likedBy",
              songs: { $count: {} },
            },
          },
          {
            $addFields: {
              name: "Owner's Favourite Songs",
              description: "This playlist contains owner's favourite songs",
              status: "public",
              isDefault: true,
            },
          },
        ],
      },
    },
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
    {
      $project: {
        _id: 0,
      },
    },
  ]);
  res
    .status(HttpStatus.OK)
    .json(
      new ApiResponse(
        HttpStatus.OK,
        "Playlists fetched successfully",
        playlists[0],
      ),
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

const getPlaylistSongs = asyncHandler(async (req, res) => {
  let { playlistId } = req.params;
  let { limit } = req.query;
  const playlistSongs = await Playlist.aggregate([
    {
      $match: {
        $expr: {
          $eq: ["$_id", { $toObjectId: playlistId }],
        },
      },
    },
    {
      $lookup: {
        from: "songs",
        localField: "songs",
        foreignField: "_id",
        as: "songs",
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
            },
          },
          { $limit: Number(limit) },
        ],
      },
    },
  ]);

  if (!playlistSongs.length) {
    throw new ApiError(HttpStatus.NotFound, "Invalid Playlist");
  }

  res
    .status(HttpStatus.OK)
    .json(
      new ApiResponse(
        HttpStatus.OK,
        "Playlist songs fetched successfully",
        playlistSongs[0],
      ),
    );
});
export { createPlaylist, addSongs, getPlaylistSongs, getPlaylists };
