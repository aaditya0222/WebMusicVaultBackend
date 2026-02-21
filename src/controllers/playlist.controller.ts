import Playlist from "../models/playlist.model";
import asyncHandler from "express-async-handler";
import { Request, Response } from "express";
import ApiError from "../utils/ApiError";
import ApiResponse from "../utils/ApiResponse";
import { Types } from "mongoose";
import { HttpStatus } from "../utils/HttpStatus";
import Song from "../models/song.model";
import { duration } from "zod/v4/classic/iso.cjs";
const createPlaylist = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { name, status, description } = req.body;
    const existingPlaylist = await Playlist.findOne({ name });
    if (existingPlaylist) {
      throw new ApiError(
        HttpStatus.Conflict,
        `Playlist with name '${name}' is already created`,
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
  const { playlistId, limit } = req.query;
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
              pipeline: [
                {
                  $project: {
                    username: 1,
                  },
                },
              ],
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
          {
            $limit: limit,
          },
        ],
      },
    },
  ]);
  if (!playlistSongs.length) {
    throw new ApiError(HttpStatus.NotFound, "Invalid Playlist");
  }
});

export { createPlaylist, addSongs, getPlaylistSongs };
