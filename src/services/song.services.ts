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
  userId?: Types.ObjectId;
}
interface pinSongI {
  songId: Types.ObjectId;
  userId: Types.ObjectId;
  pin: boolean;
}

import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import Like from "../models/like.model";
import Playlist from "../models/playlist.model";
import User from "../models/user.model";

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { status: 429, message: "Too many uploads, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,

  keyGenerator: (req) => {
    const userId = (req.user as any)?._id?.toString();
    if (userId) return userId;

    return ipKeyGenerator(req.ip ?? "");
  },
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
    if (env.NODE_ENV === "development") console.error(error);

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
  songId: idType,
  userId: Types.ObjectId,
  role: "admin" | "user",
): Promise<void> => {
  const song = await Song.findById(songId);

  if (!song) {
    throw new ApiError(HttpStatus.NotFound, "Song not found");
  }

  if (role !== "admin" && !song.owner?.equals(userId)) {
    throw new ApiError(
      HttpStatus.Forbidden,
      "You do not have permission to delete this song",
    );
  }

  await Promise.all([
    Song.findByIdAndDelete(songId),
    Like.deleteMany({ song: songId }), //delete song's instances from Like model to ensure consistency and transparency between different models of the app.
    Playlist.updateMany({ song: songId }, { $pull: { songs: songId } }),
    User.updateMany(
      { pinnedSongs: songId },
      { $pull: { pinnedSongs: songId } },
    ),
    deleteFile({ publicId: song.publicId, resource_type: "video" }),
  ]);
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

const getLikePipeline = (userId: Types.ObjectId): PipelineStage[] => {
  return [
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
      $addFields: { isLiked: { $gt: [{ $size: "$likedDocs" }, 0] } },
    },
    {
      $project: {
        likedDocs: 0,
      },
    },
  ];
};
const getOwnerPipeline = (): PipelineStage[] => {
  return [
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
};

const getSongsOrSearchSongsService = async ({
  sortBy,
  sortOrder,
  cursor,
  limit,
  query,
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

  const ownerPipeline = getOwnerPipeline();
  const likePipeline = userId ? getLikePipeline(userId) : [];

  const target = userId
    ? await User.findById(userId).select("pinnedSongs")
    : await User.findOne({ role: "admin" }).select("pinnedSongs");
  const pinnedSongIds = target?.pinnedSongs ?? [];
  const filterPipeline = createPipeline({
    ...cursorQuery,
    _id: { $nin: pinnedSongIds },
  });
  if (!isSearch) {
    songs = await Song.aggregate([
      ...filterPipeline,
      ...likePipeline,
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

    songs = await Song.aggregate([
      ...createPipeline(dbSearchQuery),
      ...likePipeline,
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
  }

  return { songs, nextCursor, hasMoreSongs };
};

const getRandomSongService = async (
  count: number,
  userId?: Types.ObjectId,
): Promise<SongI[] | null> => {
  const likePipeline = userId ? getLikePipeline(userId) : [];

  const ownerPipeline = getOwnerPipeline();

  const randomSongArray = await Song.aggregate([
    { $sample: { size: count } },
    ...likePipeline,
    ...ownerPipeline,
  ]);

  if (!randomSongArray.length) {
    return null;
  }

  return randomSongArray;
};

const getSongByIdService = async (
  songId: string,
  userId?: Types.ObjectId,
): Promise<SongI | null> => {
  const likePipeline = userId ? getLikePipeline(userId) : [];

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

  const songArray = await Song.aggregate([
    {
      $match: { _id: new Types.ObjectId(songId) },
    },
    ...likePipeline,
    ...ownerPipeline,
  ]);

  return songArray.length > 0 ? songArray[0] : null;
};

const updateSongFieldsService = async ({
  songId,
  userId,
  title,
  artist,
  coverImage,
  removeCoverImage,
}: updateSongRequest & {
  songId: string;
  userId: Types.ObjectId;
  coverImage?: Express.Multer.File;
}): Promise<SongI> => {
  const user = await User.findById(userId);
  const song = await Song.findById(songId);

  if (!song) {
    throw new ApiError(HttpStatus.NotFound, "Song with given id not found");
  }

  if (!user || (user.role !== "admin" && !song.owner.equals(user._id))) {
    throw new ApiError(
      HttpStatus.Forbidden,
      "You do not have permission to update this song",
    );
  }

  let coverUploadResult: UploadApiResponse | undefined;

  if (coverImage) {
    coverUploadResult = await uploadFile({
      buffer: coverImage.buffer,
      folder: "coverImages",
      resource_type: "image",
    });

    if (!coverUploadResult || "error" in coverUploadResult) {
      throw new Error("There was a problem while uploading cover image");
    }
  }
  const oldPublicId = song.coverImagePublicId;

  if (title) song.title = title + ".mp3";
  if (artist) song.artist = artist;
  if (coverUploadResult) {
    song.coverImagePublicId = coverUploadResult.public_id;
    song.coverImageUrl = coverUploadResult.secure_url;
  } else if (removeCoverImage) {
    song.coverImagePublicId = undefined;
    song.coverImageUrl = undefined;
  }

  await song.save();

  if ((coverUploadResult || removeCoverImage) && oldPublicId) {
    await deleteFile({
      publicId: oldPublicId,
      resource_type: "image",
    });
  }
  return song;
};
const pinSongService = async ({
  songId,
  userId,
  pin,
}: pinSongI): Promise<string | void> => {
  if (!Types.ObjectId.isValid(songId.toString())) {
    throw new ApiError(HttpStatus.NotFound, "Song not found");
  }

  const user = await User.findById(userId).select("pinnedSongs");

  if (!user) {
    throw new ApiError(HttpStatus.NotFound, "User not found");
  }

  const alreadyPinned = user.pinnedSongs.some(
    (pinnedSongId) => pinnedSongId.toString() === songId.toString(),
  );

  if (pin) {
    if (alreadyPinned) return "This song is already pinned";

    if (user.pinnedSongs.length >= 3) {
      throw new ApiError(
        HttpStatus.BadRequest,
        "You can only pin up to 3 songs. Unpin one to add another.",
      );
    }

    const songExists = await Song.exists({ _id: songId });

    if (!songExists) {
      throw new ApiError(HttpStatus.NotFound, "Song not found");
    }

    await User.findByIdAndUpdate(userId, {
      $addToSet: {
        pinnedSongs: songId,
      },
    });

    return;
  }

  if (!alreadyPinned) return;

  await User.findByIdAndUpdate(userId, {
    $pull: {
      pinnedSongs: songId,
    },
  });
};
const getPinnedSongsService = async (
  userId?: Types.ObjectId,
): Promise<SongI[]> => {
  const target = userId
    ? await User.findById(userId).select("pinnedSongs")
    : await User.findOne({ role: "admin" }).select("pinnedSongs");
  const pinnedSongIds = target?.pinnedSongs ?? [];
  if (!pinnedSongIds.length) {
    return [];
  }

  const likePipeline = userId ? getLikePipeline(userId) : [];
  const ownerPipeline = getOwnerPipeline();

  const pinnedSongs = await Song.aggregate([
    { $match: { _id: { $in: pinnedSongIds } } },
    ...likePipeline,
    ...ownerPipeline,
  ]);

  const orderedPinnedSongs = pinnedSongIds
    .map((id) =>
      pinnedSongs.find((song) => song._id.toString() === id.toString()),
    )
    .filter((song): song is SongI => song !== undefined);
  // `song is SongI` is a TypeScript type predicate.
  // It tells TypeScript that if this callback returns `true`,
  // `song` is guaranteed to be a `SongI` (not `undefined`).

  return orderedPinnedSongs;
};
export {
  uploadSongService,
  getSongsOrSearchSongsService,
  deleteSongService,
  getRandomSongService,
  updateSongFieldsService,
  getSongByIdService,
  uploadLimiter,
  pinSongService,
  getPinnedSongsService,
};
