import { z } from "zod";
import { GENRES, TAGS } from "../models/song.model";

export const mongoId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid ID");

const artist = z
  .string()
  .trim()
  .min(1, "artist must be at least of 1 characters")
  .max(30, "artist must be less than or equal to 30 characters")
  .regex(/^[a-zA-Z0-9._ ]+$/, "artist can only contain lowercase letters")
  .transform((u) => u.toLowerCase());

const title = z
  .string()
  .trim()
  .min(1, "artist must be at least of 1 characters")
  .max(125, "Lenght of title must be less than or equal to 125 characters")
  .optional();
const genre = z.enum(GENRES).optional();
const tags = z.array(z.enum(TAGS)).optional();

const uploadSongSchema = z.object({
  body: z.object({
    title,
    artist: artist.optional(),
    genre,
    tags,
  }),
});

const basePaginationSchema = z.object({
  limit: z.coerce.number().min(1).max(25).default(20),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  sortBy: z
    .enum(["createdAt", "title", "duration", "playCount"])
    .default("createdAt"),
  cursor: z
    .object({
      value: z.union([z.string(), z.number(), z.date()]),
      _id: mongoId.optional(),
    })
    .optional(),
});

const searchFieldsSchema = z.object({
  query: z.string().trim().min(1).optional(),
  genre,
  tags,
});

const cursorPreprocess = (input: unknown) => {
  if (!input || typeof input !== "object") {
    return {};
  }
  const obj = input as Record<string, unknown>;
  if (typeof obj.cursor === "string") {
    try {
      obj.cursor = JSON.parse(obj.cursor);
    } catch {
      obj.cursor = undefined;
    }
  }
  return obj;
};

const getSongsSchema = z.preprocess(cursorPreprocess, basePaginationSchema);
const searchSongsSchema = z.preprocess(
  cursorPreprocess,
  basePaginationSchema.extend(searchFieldsSchema.shape),
);

const idParamSchema = z.object({
  params: z.object({ id: mongoId }),
});
const songSchema = z
  .array(z.custom<Express.Multer.File>())
  .min(1, "At least 1 song is required")
  .max(3, "At most 3 songs are allowed");

const getRandomSongSchema = z.preprocess(
  (data: any) => {
    if (!data || typeof data !== "object") {
      return {};
    }
    const d = data as Record<string, unknown>;
    const parsedData = {
      ...d,
      tags: d.tags
        ? Array.isArray(data.tags)
          ? data.tags
          : [data.tags]
        : undefined,
    };
    return parsedData;
  },
  z.object({
    genre,
    tags,
  }),
);

const updateSongSchema = z.object({
  params: z.object({ id: mongoId }),
  body: z.object({
    title,
    artist: artist.optional(),
    genre,
    tags,
  }),
});

type uploadSongRequest = z.infer<typeof uploadSongSchema>["body"];
type updateSongParams = z.infer<typeof updateSongSchema>["params"];
type updateSongBody = z.infer<typeof updateSongSchema>["body"];
type updateSongRequest = updateSongParams & updateSongBody;
type songType = z.infer<typeof songSchema>;
type idType = z.infer<typeof mongoId>;
type parsedSongsQuery = z.infer<typeof getSongsSchema> &
  Partial<z.infer<typeof searchSongsSchema>>;
type getRandomSongRequest = z.infer<typeof getRandomSongSchema>;
export {
  uploadSongSchema,
  idParamSchema,
  idType,
  uploadSongRequest,
  songSchema,
  songType,
  getSongsSchema,
  searchSongsSchema,
  updateSongSchema,
  updateSongRequest,
  parsedSongsQuery,
  getRandomSongSchema,
  getRandomSongRequest,
};
