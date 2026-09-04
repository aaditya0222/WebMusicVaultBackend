import asyncHandler from "express-async-handler";
import { Request, Response } from "express";
import { Types } from "mongoose";
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
  pinSongService,
  getPinnedSongsService,
} from "../services/song.services";
import {
  getSongsSchema,
  searchSongsSchema,
  uploadSongRequest,
  updateSongRequest,
  parsedSongsQuery,
  songFilesSchema,
  countParamSchema,
  singleCoverImageSchema,
  mongoId,
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
    const songId = req.params.id;
    await deleteSongService(songId, req.user._id, req.user?.role);
    res
      .status(HttpStatus.OK)
      .json(new ApiResponse(HttpStatus.OK, `song deleted successfully`, null));
  },
);
//this must be furthur extend to give random songs as per the given genre, tag , author or artist
const getRandomSong = asyncHandler(async (req: Request, res: Response) => {
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

const updateRequiredFieldsOfSong = asyncHandler(
  async (req: Request, res: Response) => {
    const songId = req.params.id;
    const data: updateSongRequest = req.body;
    const coverImage = singleCoverImageSchema.parse(req.file);

    if (Object.keys(data).length === 0 && !coverImage) {
      throw new ApiError(
        HttpStatus.BadRequest,
        "At least one updatable field should be provided",
      );
    }

    const updatedSong = await updateSongFieldsService({
      ...data,
      songId,
      userId: req.user._id,
      coverImage,
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

const getPinnedSongs = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?._id;

    const pinnedSongs = await getPinnedSongsService(userId);
    res
      .status(HttpStatus.OK)
      .send(
        new ApiResponse(
          HttpStatus.OK,
          "Pinned songs sent successfully",
          pinnedSongs,
        ),
      );
  },
);

const setPinSong = (pin: boolean) => {
  return asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const songId = mongoId.parse(req.params.id);

    const message = await pinSongService({
      songId: new Types.ObjectId(songId),
      userId: req.user._id,
      pin,
    });

    res
      .status(HttpStatus.OK)
      .send(
        new ApiResponse(
          HttpStatus.OK,
          message
            ? message
            : `Successfully ${pin ? "pinned" : "unpinned"} song`,
          null,
        ),
      );
  });
};

export {
  uploadSong,
  getSongById,
  deleteSongById,
  getRandomSong,
  updateRequiredFieldsOfSong,
  getSongsOrSearchSongs,
  setPinSong,
  getPinnedSongs,
};
