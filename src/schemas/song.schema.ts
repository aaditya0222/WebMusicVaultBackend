import { z } from "zod";
export const mongoId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid ID");

const artist = z
  .string()
  .trim()
  .min(1, "artist must be at least of 1 characters")
  .max(30, "artist must be less than or equal to 30 characters")
  .regex(
    /^[a-zA-Z0-9._,& ]+$/,
    "artist can only contain letters, numbers, dots, underscores, comma, ampersand or spaces",
  );

const title = z
  .string()
  .trim()
  .min(1, "Title must be at least of 1 characters")
  .max(125, "Length of title must be less than or equal to 125 characters")
  .optional();

const uploadSongSchema = z.object({
  body: z.object({
    title,
    artist: artist.optional(),
  }),
});

const basePaginationSchema = z.object({
  limit: z.coerce.number().min(1).max(25).default(20),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  sortBy: z
    .enum(["relevance", "createdAt", "title", "duration", "playCount"])
    .default("createdAt"),
  cursor: z
    .object({
      value: z.union([z.string(), z.number(), z.date()]),
      _id: mongoId.optional(),
      playCount: z.number().optional(),
    })
    .optional(),
});

const searchFieldsSchema = z.object({
  query: z.string().trim().min(1).max(50),
});

const countParamSchema = z.object({
  params: z.object({ count: z.coerce.number().min(1).max(25).default(10) }),
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
const fileSchema = z.custom<Express.Multer.File>();
const songFilesSchema = z.object({
  song: z.array(fileSchema).transform((arr) => arr[0]),
  coverImage: z
    .array(fileSchema)
    .transform((arr) => arr[0])
    .optional(),
});

const removeCoverImage = z
  .union([z.boolean(), z.string().transform((val) => val === "true")])
  .optional();

const updateSongSchema = z.object({
  params: z.object({ id: mongoId }),
  body: z
    .object({
      title,
      artist,
      removeCoverImage,
    })
    .partial(),
});

const singleCoverImageSchema = fileSchema.optional();

type uploadSongRequest = z.infer<typeof uploadSongSchema>["body"];
type updateSongParams = z.infer<typeof updateSongSchema>["params"];
type updateSongBody = z.infer<typeof updateSongSchema>["body"];
type updateSongRequest = updateSongParams & updateSongBody;
type songFileType = z.infer<typeof songFilesSchema>;
type idType = z.infer<typeof mongoId>;
type parsedSongsQuery = z.infer<typeof getSongsSchema> &
  Partial<z.infer<typeof searchSongsSchema>>;
// type getRandomSongRequest = z.infer<typeof getRandomSongSchema>;
export {
  uploadSongSchema,
  idParamSchema,
  idType,
  uploadSongRequest,
  songFilesSchema,
  songFileType,
  getSongsSchema,
  searchSongsSchema,
  updateSongSchema,
  updateSongRequest,
  parsedSongsQuery,
  countParamSchema,
  singleCoverImageSchema,
  // getRandomSongSchema,
  // getRandomSongRequest,
};
