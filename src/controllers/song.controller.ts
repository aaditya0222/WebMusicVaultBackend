import asyncHandler from "express-async-handler";
import { Request, Response } from "express";
import { uploadSong, deleteSong } from "../config/cloudinary";
import Song from "../models/song.model";
import { HttpStatus } from "../utils/HttpStatus";
import ApiResponse from "../utils/ApiResponse";
import ApiError from "../utils/ApiError";
import { UploadApiResponse } from "cloudinary";
import type { SortOrder } from "mongoose";
import mongoose from "mongoose";

const uploadSongs = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      throw new ApiError(
        HttpStatus.BadRequest,
        "No files uploaded. Please upload at least one song.",
      );
    }

    const savedSongs = [];
    const alreadyExistingSongs = [];
    for (const file of files) {
      const existingSong = await Song.findOne({ title: file.originalname });
      if (existingSong) {
        alreadyExistingSongs.push(existingSong.title);
        continue;
      }
      const uploadResult: UploadApiResponse = await uploadSong(file.buffer);

      const durationInSeconds = uploadResult.duration || 0;

      const song = await Song.create({
        title: file.originalname,
        duration: durationInSeconds,
        publicId: uploadResult.public_id,
        fileUrl: uploadResult.secure_url,
      });
      savedSongs.push(song);
    }
    const message =
      alreadyExistingSongs.length > 0
        ? `${savedSongs.length} song(s) uploaded successfully. ${alreadyExistingSongs.length} already existed.`
        : `${savedSongs.length} song(s) uploaded successfully`;
    res
      .status(HttpStatus.Created)
      .json(
        new ApiResponse(
          HttpStatus.Created,
          message,
          savedSongs,
          alreadyExistingSongs,
        ),
      );
  },
);

const getAllSongs = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const limit = Number(req.query.limit) || 10;
    const sortByValue = req.query.sortOrder as string;
    let cursor = req.query.cursor as string | undefined;
    let sortBy: SortOrder;
    if (!sortByValue) {
      sortBy = -1; // descending
    } else if (sortByValue.toLowerCase() === "asc") {
      sortBy = -1; //descending
    } else {
      sortBy = 1; //ascending
    }
    const query: any = {};
    if (cursor && !mongoose.Types.ObjectId.isValid(cursor)) {
      cursor = undefined;
    }
    if (cursor) {
      query._id = sortBy === 1 ? { $gt: cursor } : { $lt: cursor };
    }

    const songs = await Song.find(query)
      .select("title duration fileUrl artist")
      .limit(limit + 1)
      .sort({ createdAt: sortBy });
    const hasMoreSongs = songs.length > limit;
    if (hasMoreSongs) {
      songs.pop();
    }
    const nextCursor = songs.length ? songs[songs.length - 1]._id : undefined;

    if (!songs || songs.length === 0) {
      throw new ApiResponse(HttpStatus.NotFound, "No songs found", null);
    }

    res.status(HttpStatus.OK).json(
      new ApiResponse(HttpStatus.OK, "Songs sent successfully", {
        songs,
        nextCursor,
        hasMoreSongs,
      }),
    );
  },
);

const getSongById = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const song = await Song.findById(req.params.id);
    if (!song) {
      throw new ApiError(HttpStatus.NotFound, "Song not found");
    }
    res
      .status(HttpStatus.OK)
      .json(new ApiResponse(HttpStatus.OK, "Song sent successfully", song));
  },
);

const deleteSongById = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const song = await Song.findByIdAndDelete(req.params.id);
    if (!song) {
      throw new ApiError(HttpStatus.NotFound, "Song not found");
    }

    await deleteSong(song!.publicId);
    if (!song) {
      res
        .status(HttpStatus.NotFound)
        .json(new ApiError(HttpStatus.NotFound, "Song not found"));
      return;
    }
    res
      .status(HttpStatus.OK)
      .json(new ApiResponse(HttpStatus.OK, `song deleted successfully`, null));
  },
);

const searchSong = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const limit = Number(req.query.limit) || 10;
    let cursor = req.query.cursor as string | undefined;
    const searchQuery = req.query.searchQuery as string;
    let query: any = {};
    if (cursor && !mongoose.Types.ObjectId.isValid(cursor)) {
      cursor = undefined;
    }
    if (cursor) {
      query = { $gt: cursor };
    }
    const searchedSongs = await Song.find({
      title: { $regex: searchQuery, $options: "i" },
      ...(cursor && { _id: query }),
    }).limit(limit + 1);
    const hasMoreSongs = searchedSongs.length > limit;
    if (hasMoreSongs) {
      searchedSongs.pop();
    }
    const nextCursor = searchedSongs.length
      ? searchedSongs[searchedSongs.length - 1]._id
      : undefined;
    res.status(HttpStatus.OK).json(
      new ApiResponse(HttpStatus.OK, "Song(s) sent successfully", {
        songs: searchedSongs,
        nextCursor,
        hasMoreSongs,
      }),
    );
  },
);
const getRandomSong = asyncHandler(async (_req: Request, res: Response) => {
  const randomSongArr = await Song.aggregate([{ $sample: { size: 1 } }]);

  res
    .status(HttpStatus.OK)
    .send(
      new ApiResponse(
        HttpStatus.OK,
        "Successfully sent a random song",
        randomSongArr[0],
      ),
    );
});
export {
  uploadSongs,
  getAllSongs,
  getSongById,
  deleteSongById,
  searchSong,
  getRandomSong,
};
