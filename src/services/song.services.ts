import ApiError from "../utils/ApiError";
import { HttpStatus } from "../utils/HttpStatus";
import { UploadApiResponse } from "cloudinary";
import { deleteFile, uploadFile } from "../config/cloudinary";
import Song from "../models/song.model";
import type { SongI } from "../models/song.model";
import { PipelineStage, SortOrder, Types } from "mongoose";
import { env } from "../config/env";
import {
  idType,
  updateSongRequest,
  uploadSongRequest,
} from "../schemas/song.schema";
import { MongoServerError } from "mongodb";

import { FilterQuery } from "mongoose";

type skippedT = { title: string; reason: string }[];
interface uploadSongResponse {
  uploaded: SongI[];
  skipped: skippedT;
  summary: {
    totalFiles: number;
    uploadCount: number;
    skippedCount: number;
  };
}
type nonUniqueSortBy = "playCount" | "duration" | "createdAt";
type uniqueSortBy = "title";
type sortByT = nonUniqueSortBy | uniqueSortBy;
type cursorT =
  | {
      value: string | number | Date;
      _id?: string;
    }
  | undefined;

interface getSongsOrSearchSongsServiceI {
  limit: number;
  sortBy: sortByT;
  sortOrder: "asc" | "desc";
  cursor: cursorT;
  query?: string;
  // genre?: string;
  // tags?: string[];
  userId?: Types.ObjectId;
}

import rateLimit from "express-rate-limit";

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 uploads per hour
  message: { status: 429, message: "Too many uploads, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

const uploadSongService = async (
  body: uploadSongRequest,
  files: { song: Express.Multer.File; coverImage?: Express.Multer.File },
  userId: Types.ObjectId,
): Promise<{ song: SongI }> => {
  let songUploadResult: UploadApiResponse | undefined;
  let coverUploadResult: UploadApiResponse | undefined;

  try {
    songUploadResult = await uploadFile({
      buffer: files.song.buffer,
      folder: "songs",
      resource_type: "video",
    });

    if (!songUploadResult || "error" in songUploadResult) {
      throw new Error("There was a problem while uploading song");
    }
    if (files.coverImage) {
      coverUploadResult = await uploadFile({
        buffer: files.coverImage.buffer,
        folder: "coverImages",
        resource_type: "image",
      });

      if (!coverUploadResult || "error" in coverUploadResult) {
        throw new Error("There was a problem while uploading cover image");
      }
    }

    const song = await Song.create({
      title: body.title ?? files.song.originalname,
      duration: songUploadResult.duration,
      publicId: songUploadResult.public_id,
      fileUrl: songUploadResult.secure_url,
      coverImageUrl: coverUploadResult?.secure_url,
      coverImagePublicId: coverUploadResult?.public_id,
      artist: body.artist,
      owner: userId,
    });

    return { song };
  } catch (error) {
    env.NODE_ENV === "development" && console.error(error);

    // Cleanup whatever got uploaded before the failure
    if (songUploadResult?.public_id) {
      await deleteFile({
        publicId: songUploadResult.public_id,
        resource_type: "video",
      });
    }
    if (coverUploadResult?.public_id) {
      await deleteFile({
        publicId: coverUploadResult.public_id,
        resource_type: "image",
      });
    }

    if (error instanceof MongoServerError && error.code === 11000) {
      throw new ApiError(HttpStatus.Conflict, "Song already exists");
    }

    throw new ApiError(
      HttpStatus.InternalServerError,
      "Unexpected error while uploading",
    );
  }
};
const deleteSongService = async (
  id: idType,
  userId: Types.ObjectId,
): Promise<void> => {
  const song = await Song.findOneAndDelete({ _id: id, owner: userId });
  if (!song) {
    throw new ApiError(
      HttpStatus.Forbidden,
      "You do not have permission to delete this song or it does not exist",
    );
  }
  await deleteFile({ publicId: song.publicId, resource_type: "video" });
};

//*for non unique fields need to use the _id as secondary cusror for exactly getting the document

const createCursorQuery = ({
  cursor,
  sortBy,
  sortOrder,
}: {
  cursor: cursorT;
  sortBy: sortByT;
  sortOrder: SortOrder;
}): FilterQuery<SongI> => {
  if (cursor) {
    // NEW CODE - Convert string dates back to Date objects for proper comparison
    const cursorValue =
      sortBy === "createdAt" && typeof cursor.value === "string"
        ? new Date(cursor.value)
        : cursor.value;

    if (sortOrder === "asc") {
      return sortBy === "title"
        ? {
            [sortBy]: { $gt: cursorValue },
          }
        : {
            $or: [
              {
                [sortBy]: { $gt: cursorValue },
              },
              {
                [sortBy]: cursorValue,
                _id: { $gt: new Types.ObjectId(cursor._id) },
              },
            ],
          };
    } else {
      return sortBy === "title"
        ? {
            [sortBy]: { $lt: cursorValue },
          }
        : {
            $or: [
              {
                [sortBy]: { $lt: cursorValue },
              },
              {
                [sortBy]: cursorValue,
                _id: { $lt: new Types.ObjectId(cursor._id) },
              },
            ],
          };
    }

    // OLD CODE - The problem: using cursor.value directly without converting string back to Date
    // MongoDB compares string "2025-01-15T10:30:00.000Z" lexicographically, not chronologically
    // This breaks pagination when using dates
    // if (sortOrder === "asc") {
    //   return sortBy === "title"
    //     ? { $or: [{ [sortBy]: { $gt: cursor.value } }] }
    //     : {
    //         $or: [
    //           { [sortBy]: { $gt: cursor.value } },
    //           { [sortBy]: cursor.value, _id: { $gt: new Types.ObjectId(cursor._id) } },
    //         ],
    //       };
    // }
  } else {
    return {};
  }
};
const getSongsOrSearchSongsService = async ({
  sortBy,
  sortOrder,
  cursor,
  limit,
  query,
  // genre,
  // tags,
  userId,
}: getSongsOrSearchSongsServiceI): Promise<{
  songs: SongI[];
  nextCursor: cursorT;
  hasMoreSongs: boolean;
}> => {
  let songs;
  let hasMoreSongs = false;
  let nextCursor: cursorT;
  const isSearch = !!query;
  const cursorQuery = createCursorQuery({ sortBy, sortOrder, cursor });
  const sort: Record<string, 1 | -1> = {
    //$sort requires 1 or -1 not the SortOrder type;
    [sortBy]: sortOrder === "asc" ? 1 : -1,
    _id: sortOrder === "asc" ? 1 : -1,
  };

  const createPipeline = (query: FilterQuery<SongI>): PipelineStage[] => {
    return [
      {
        $match: query,
      },
      {
        $sort: sort,
      },
      {
        $limit: limit + 1,
      },
    ];
  };
  const ownerPipeline: PipelineStage[] = [
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
      $addFields: { owner: { $first: "$owner" } },
    },
  ];
  const likePipeline: PipelineStage[] = [
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
                  { $eq: ["$likedBy", new Types.ObjectId(userId)] },
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
        likedDocs: 0,
      },
    },
  ];
  if (!isSearch) {
    songs = await Song.aggregate([
      ...createPipeline(cursorQuery),
      ...(userId ? likePipeline : []),
      ...ownerPipeline,
    ]);
  } else {
    const dbSearchQuery: FilterQuery<SongI> = {
      $and: [
        ...query.split(/\s+/).map((word) => {
          return {
            $or: [
              { title: { $regex: word, $options: "i" } },
              { artist: { $regex: word, $options: "i" } },
            ],
          };
        }),
        cursorQuery,
      ],
    };
    // ...(tags && { tags: { $in: tags } }),
    // ...(genre && { genre }),
    // };
    // const dbSearchQuery: FilterQuery<SongI> = {
    //   $text: {
    //     $search: query as string,
    //   },
    //   ...cursorQuery,
    // };
    // songs = await Song.find(dbSearchQuery)
    //   .sort(sort)
    //   .limit(limit + 1)
    //   .lean();
    songs = await Song.aggregate([
      ...createPipeline(dbSearchQuery),
      ...(userId ? likePipeline : []),
      ...ownerPipeline,
    ]);
  }
  if (songs.length > limit) {
    hasMoreSongs = true;
    songs.pop();
  }
  if (!hasMoreSongs || songs.length === 0) {
    nextCursor = undefined;
  } else {
    const lastSong = songs[songs.length - 1];

    // NEW CODE - Converts Date to ISO string for proper serialization
    const cursorValue =
      sortBy === "createdAt" && lastSong[sortBy] instanceof Date
        ? (lastSong[sortBy] as Date).toISOString()
        : lastSong[sortBy];

    nextCursor = {
      value: cursorValue,
      _id: lastSong._id.toString(),
    };

    // OLD CODE - The problem: passes Date object directly, gets serialized as string, then comparison fails
    // nextCursor = {
    //   value: lastSong[sortBy],
    //   _id: lastSong._id.toString(),
    // };
  }

  return { songs, nextCursor, hasMoreSongs };
};

const getRandomSongService = async (
  count: number,
  userId: Types.ObjectId,
): Promise<SongI[] | null> => {
  const likePipeline: PipelineStage[] = [
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
                  { $eq: ["$likedBy", new Types.ObjectId(userId)] },
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
        likedDocs: 0,
      },
    },
  ];

  const randomSongArray = await Song.aggregate([
    { $sample: { size: count } },
    ...(userId ? likePipeline : []),
  ]);

  if (!randomSongArray.length) {
    return null;
  }

  return randomSongArray;
};

//*Here after, the song update services will come. Think about flow then start to code furthur. Although the udpateSongFields schema is done, try reviewing it as per your logic
const updateSongFieldsService = async ({
  songId,
  userId,
  title,
  artist,
  // tags,
  // genre,
}: updateSongRequest & {
  songId: string;
  userId: Types.ObjectId;
}): Promise<SongI> => {
  const song = await Song.findOneAndUpdate(
    { _id: songId, owner: userId },
    {
      $set: {
        ...(title && { title }),
        ...(artist && { artist }),
        // ...(genre && { genre }),
      },
      // ...(tags
      //   ? {
      //       $addToSet: {
      //         tags: { $each: tags },
      //       },
      //     }
      //   : {
      //       tags: [],
      //     }),
    },
    {
      new: true,
    },
  );
  if (!song) {
    throw new ApiError(
      HttpStatus.Forbidden,
      "You do not have permission to update this song or it does not exist",
    );
  }

  return song;
};
export {
  uploadSongService,
  getSongsOrSearchSongsService,
  deleteSongService,
  getRandomSongService,
  updateSongFieldsService,
  uploadLimiter,
};
