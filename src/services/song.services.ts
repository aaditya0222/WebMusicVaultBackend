import ApiError from "../utils/ApiError";
import { HttpStatus } from "../utils/HttpStatus";
import { UploadApiResponse, UploadApiErrorResponse } from "cloudinary";
import { deleteFile, uploadFile } from "../config/cloudinary";
import Song from "../models/song.model";
import type { SongI } from "../models/song.model";
import { SortOrder, Types } from "mongoose";
import { env } from "../config/env";
import {
  getRandomSongRequest,
  idType,
  songType,
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
  genre?: string;
  tags?: string[];
  isSearch: boolean;
}

type uploadResultReturnT =
  | {
      type: "skipped";
      title: string;
      reason: string;
    }
  | {
      type: "uploaded";
      song: SongI;
    };

const makeSkipped = (file: Express.Multer.File, reason: string) => ({
  type: "skipped" as "skipped",
  title: file.originalname,
  reason,
});

const uploadSongService = async (
  body: uploadSongRequest,
  files: songType,
  userId: Types.ObjectId,
): Promise<uploadSongResponse> => {
  const tasks = files.map(async (file): Promise<uploadResultReturnT> => {
    let uploadResult: UploadApiResponse | UploadApiErrorResponse | undefined;
    try {
      uploadResult = await uploadFile({
        buffer: file.buffer,
        folder: "songs",
        resource_type: "video",
      });
      if ("error" in uploadResult) {
        return makeSkipped(file, "Unexpected error while uploading");
      }
      const song = await Song.create({
        title: body.title ? body.title : file.originalname,
        duration: uploadResult.duration,
        publicId: uploadResult.public_id,
        fileUrl: uploadResult.secure_url,
        playbackUrl: uploadResult.playback_url,
        artist: body.artist,
        owner: userId,
        tags: body.tags,
        genre: body.genre,
      });
      return { type: "uploaded", song };
    } catch (error) {
      env.NODE_ENV === "development" && console.error(error);
      if (uploadResult?.public_id) {
        await deleteFile({
          publicId: uploadResult.public_id,
          resource_type: "video",
        });
        if (error instanceof MongoServerError && error.code === 11000) {
          //11000 is code for duplicate document returned by mongoose itslef
          return makeSkipped(file, "Song is already uploaded.");
          //this is for race conditions when 2 users upload same song and this helps to reduce one database fetching for exisitng user check and this works when unique is true in the fieldname in the schema
        }
        return makeSkipped(file, "Unexpected error while uploading");
      }
      return makeSkipped(file, "Unexpected error while uploading");
    }
  });

  const results = await Promise.allSettled(tasks);
  const uploadedSongs: SongI[] = [];
  const skippedSongs: skippedT = [];

  for (const r of results) {
    if (r.status === "fulfilled") {
      if (r.value.type === "uploaded") {
        uploadedSongs.push(r.value.song);
      } else {
        skippedSongs.push({ title: r.value.title, reason: r.value.reason });
      }
    }
  }
  return {
    uploaded: uploadedSongs,
    skipped: skippedSongs,
    summary: {
      totalFiles: files.length,
      uploadCount: uploadedSongs.length,
      skippedCount: skippedSongs.length,
    },
  };
};

const deleteSongService = async (id: idType): Promise<void> => {
  const song = await Song.findByIdAndDelete(id);
  if (!song) {
    throw new ApiError(HttpStatus.NotFound, "Song not found");
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
    if (sortOrder === "asc") {
      return sortBy === "title"
        ? {
            $or: [
              {
                [sortBy]: { $gt: cursor.value },
              },
            ],
          }
        : {
            $or: [
              {
                [sortBy]: { $gt: cursor.value },
              },
              {
                [sortBy]: cursor.value,
                _id: { $gt: new Types.ObjectId(cursor._id) },
              },
            ],
          };
    } else {
      return sortBy === "title"
        ? {
            $or: [
              {
                [sortBy]: { $lt: cursor.value },
              },
            ],
          }
        : {
            $or: [
              {
                [sortBy]: { $lt: cursor.value },
              },
              {
                [sortBy]: cursor.value,
                _id: { $lt: new Types.ObjectId(cursor._id) },
              },
            ],
          };
    }
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
  genre,
  tags,
  isSearch,
}: getSongsOrSearchSongsServiceI): Promise<{
  songs: SongI[];
  nextCursor: cursorT;
  hasMoreSongs: boolean;
}> => {
  let songs;
  let hasMoreSongs = false;
  let nextCursor: cursorT;
  const cursorQuery = createCursorQuery({ sortBy, sortOrder, cursor });
  console.log(cursorQuery);
  const sort: Record<string, SortOrder> = {
    [sortBy]: sortOrder === "asc" ? 1 : -1,
    _id: sortOrder === "asc" ? 1 : -1,
  };
  if (!isSearch) {
    songs = await Song.find(cursorQuery)
      .sort(sort)
      .limit(limit + 1)
      .lean();
  } else {
    const dbSearchQuery: FilterQuery<SongI> = {
      ...(query && {
        $and: [
          ...query.split(" ").map((word) => {
            return {
              $or: [
                { title: { $regex: word, $options: "i" } },
                { artist: { $regex: word, $options: "i" } },
              ],
            };
          }),
          cursorQuery,
        ],
      }),
      ...(tags && { tags: { $in: tags } }),
      ...(genre && { genre }),
    };

    songs = await Song.find(dbSearchQuery)
      .sort(sort)
      .limit(limit + 1)
      .lean();
  }
  if (songs.length > limit) {
    hasMoreSongs = true;
    songs.pop();
  }
  if (!hasMoreSongs || songs.length === 0) {
    nextCursor = undefined;
  } else {
    const lastSong = songs[songs.length - 1];
    nextCursor = {
      value: lastSong[sortBy],
      _id: lastSong._id.toString(),
    };
  }

  return { songs, nextCursor, hasMoreSongs };
};

const getRandomSongService = async (
  query: getRandomSongRequest,
): Promise<SongI | null> => {
  const { genre, tags } = query;

  const orFilters: Record<string, unknown>[] = [];

  if (genre) {
    orFilters.push({ genre });
  }

  if (tags && tags.length > 0) {
    orFilters.push({ tags: { $in: tags } });
  }

  const matchStage = orFilters.length > 0 ? { $or: orFilters } : {};

  const randomSongArray = await Song.aggregate([
    { $match: matchStage },
    { $sample: { size: 1 } },
  ]);

  if (!randomSongArray.length) {
    return null;
  }

  return randomSongArray[0];
};

//*Here after, the song update services will come. Think about flow then start to code furthur. Although the udpateSongFields schema is done, try reviewing it as per your logic
const updateSongFieldsService = async ({
  songId,
  title,
  artist,
  tags,
  genre,
}: updateSongRequest & { songId: string }): Promise<SongI> => {
  const song = await Song.findOneAndUpdate(
    { _id: songId },
    {
      $set: {
        ...(title && { title }),
        ...(artist && { artist }),
        ...(genre && { genre }),
      },
      ...(tags
        ? {
            $addToSet: {
              tags: { $each: tags },
            },
          }
        : {
            tags: [],
          }),
    },
    {
      new: true,
    },
  );
  if (!song) throw new ApiError(HttpStatus.NotFound, "Song not found");

  return song;
};
export {
  uploadSongService,
  getSongsOrSearchSongsService,
  deleteSongService,
  getRandomSongService,
  updateSongFieldsService,
};
