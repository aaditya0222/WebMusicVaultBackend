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
} from "../services/song.services";
import {
  idParamSchema,
  getSongsSchema,
  searchSongsSchema,
  uploadSongRequest,
  songSchema,
  updateSongRequest,
  parsedSongsQuery,
  getRandomSongSchema,
  getRandomSongRequest,
} from "../schemas/song.schema";

const uploadSongs = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const body: uploadSongRequest = req.body;
    const files = songSchema.parse(req.files);

    const uploadRes = await uploadSongService(body, files, req.user._id);
    let msg = "";
    if (uploadRes.uploaded.length === 0 && uploadRes.skipped.length > 0) {
      msg = "All songs were skipped or failed to upload.";
    } else if (uploadRes.uploaded.length > 0 && uploadRes.skipped.length > 0) {
      msg = `${uploadRes.uploaded.length} song(s) uploaded successfully. ${uploadRes.skipped.length} skipped.`;
    } else if (uploadRes.uploaded.length > 0) {
      msg = `${uploadRes.uploaded.length} song(s) uploaded successfully.`;
    } else {
      msg = "No files were uploaded.";
    }
    res
      .status(HttpStatus.Created)
      .json(new ApiResponse(HttpStatus.Created, msg, uploadRes));
  },
);

const getSongsOrSearchSongs = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const isSearch = Object.keys(req.query).some((key) =>
      ["query", "tags", "genre", "artist", "title"].includes(key),
    );

    const parsedQuery: parsedSongsQuery = isSearch
      ? searchSongsSchema.parse(req.query)
      : getSongsSchema.parse(req.query);

    const { limit, sortBy, sortOrder, cursor, query, genre, tags } =
      parsedQuery;

    const { songs, nextCursor, hasMoreSongs } =
      await getSongsOrSearchSongsService({
        limit,
        sortBy,
        sortOrder,
        cursor,
        query,
        genre,
        tags,
        isSearch,
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
    const { id } = idParamSchema.parse(req.params);
    const song = await Song.findById(id);
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
    const { id } = idParamSchema.parse(req.params);
    await deleteSongService(id);
    res
      .status(HttpStatus.OK)
      .json(new ApiResponse(HttpStatus.OK, `song deleted successfully`, null));
  },
);
//this must be furthur extend to give random songs as per the given genre, tag , author or artist
const getRandomSong = asyncHandler(async (req: Request, res: Response) => {
  const query: getRandomSongRequest = getRandomSongSchema.parse(req.query);
  const randomSong = await getRandomSongService(query);
  if (!randomSong) {
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
        randomSong,
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
    const updatedSong = await updateSongFieldsService({ ...data, songId });
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
  uploadSongs,
  getSongById,
  deleteSongById,
  getRandomSong,
  updateAllFieldsOfSong,
  getSongsOrSearchSongs,
  getAllSongOfArtist,
  increamentPlayCount,
};
