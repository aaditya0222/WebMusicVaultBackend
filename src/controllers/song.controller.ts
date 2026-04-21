import asyncHandler from "express-async-handler";
import { Request, Response } from "express";
import Song from "../models/song.model";
import { HttpStatus } from "../utils/HttpStatus";
import ApiResponse from "../utils/ApiResponse";
import ApiError from "../utils/ApiError";
import {
  getSongsOrSearchSongsService,
  uploadSongService,
  deleteSongService,
  updateSongFieldsService,
  getRandomSongService,
  getSongByIdService,
} from "../services/song.services";
import {
  getSongsSchema,
  searchSongsSchema,
  uploadSongRequest,
  updateSongRequest,
  parsedSongsQuery,
  songFilesSchema,
  countParamSchema,
  // getRandomSongSchema,
  // getRandomSongRequest,
} from "../schemas/song.schema";

const uploadSong = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const body: uploadSongRequest = req.body;
    const files = songFilesSchema.parse(req.files);

    const uploadRes = await uploadSongService(body, files, req.user._id);

    res
      .status(HttpStatus.Created)
      .json(
        new ApiResponse(
          HttpStatus.Created,
          "Song uploaded successfully",
          uploadRes,
        ),
      );
  },
);
const getSongsOrSearchSongs = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    // const isSearch = Object.keys(req.query).some((key) =>
    //   ["query", "tags", "genre", "artist", "title"].includes(key),
    // );
    // const isSearch = Object.keys(req.query).some((key) =>
    //   ["query", "artist", "title"].includes(key),
    // );

    const isSearch = !!req.query.query;
    const userId = req.user?._id;
    const parsedQuery: parsedSongsQuery = isSearch
      ? searchSongsSchema.parse(req.query)
      : getSongsSchema.parse(req.query);

    const { limit, sortBy, sortOrder, cursor, query } = parsedQuery;

    const { songs, nextCursor, hasMoreSongs } =
      await getSongsOrSearchSongsService({
        limit,
        sortBy,
        sortOrder,
        cursor,
        query,
        // genre,
        // tags,
        userId,
      });
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
    const id = req.params.id;
    const userId = req.user?._id;
    const song = await getSongByIdService(id, userId);
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
    const id = req.params.id;
    await deleteSongService(id, req.user._id);
    res
      .status(HttpStatus.OK)
      .json(new ApiResponse(HttpStatus.OK, `song deleted successfully`, null));
  },
);
//this must be furthur extend to give random songs as per the given genre, tag , author or artist
const getRandomSong = asyncHandler(async (req: Request, res: Response) => {
  // const query: getRandomSongRequest = getRandomSongSchema.parse(req.query);
  const {
    params: { count },
  } = countParamSchema.parse(req);
  const userId = req.user?._id;
  const randomSongs = await getRandomSongService(count, userId);
  if (!randomSongs) {
    res
      .status(HttpStatus.OK)
      .send(new ApiResponse(HttpStatus.OK, "No songs found", null));
    return;
  }
  res
    .status(HttpStatus.OK)
    .send(
      new ApiResponse(
        HttpStatus.OK,
        "Successfully sent a random song",
        randomSongs,
      ),
    );
});

const updateAllFieldsOfSong = asyncHandler(
  async (req: Request, res: Response) => {
    const songId = req.params.id;
    if (!songId) {
      throw new ApiError(HttpStatus.BadRequest, "Invalid song id");
    }
    const data: updateSongRequest = req.body;
    const updatedSong = await updateSongFieldsService({
      ...data,
      songId,
      userId: req.user._id,
    });
    res
      .status(HttpStatus.OK)
      .send(
        new ApiResponse(
          HttpStatus.OK,
          "Song updated successfully",
          updatedSong,
        ),
      );
  },
);

const increamentPlayCount = asyncHandler(
  async (req: Request, res: Response) => {},
);
const getAllSongOfArtist = asyncHandler(
  async (req: Request, res: Response) => {},
);
export {
  uploadSong,
  getSongById,
  deleteSongById,
  getRandomSong,
  updateAllFieldsOfSong,
  getSongsOrSearchSongs,
  getAllSongOfArtist,
  increamentPlayCount,
};
