import { z } from "zod";

const name = z
  .string()
  .trim()
  .min(3, "Playlist name must be greater than 2 characters")
  .max(30, "Playlist name must be less than or equal to 30 characters")
  .regex(
    /^[a-zA-Z0-9_ ]+$/,
    "Playlist name can only contain letters, numbers, underscores, and spaces",
  );

const description = z
  .string()
  .trim()
  .min(3, "Description must be greater than 2 letters")
  .max(100, "Description must be less than 100 letters")
  .optional();

const status = z.enum(["private", "public"]).default("private");

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectId");

const createPlaylistSchema = z.object({
  body: z.object({
    name,
    description,
    status,
  }),
});

const modifyPlaylistSongSchema = z.object({
  params: z.object({
    playlistId: objectId,
  }),
  body: z.object({
    songIds: z.array(objectId),
  }),
});
const removePlaylistSongSchema = z.object({
  params: z.object({
    playlistId: objectId,
  }),
  body: z.object({
    songIds: z.array(objectId),
  }),
});
const getPlaylistSongsSchema = z.object({
  params: z.object({
    playlistId: objectId,
  }),
  query: z.object({
    limit: z.coerce.number().min(1).max(25).default(20),
    cursor: z.string().optional(),
  }),
});

const updatePlaylistSchema = z.object({
  params: z.object({
    playlistId: objectId,
  }),
  body: z.object({
    name: name.optional(),
    description: description.optional(),
    status: z.enum(["private", "public"]).optional(),
  }),
});

type createPlaylistSchemaType = z.infer<typeof createPlaylistSchema>["body"];
type updatePlaylistSchemaType = z.infer<typeof updatePlaylistSchema>["body"];
export {
  createPlaylistSchema,
  modifyPlaylistSongSchema,
  removePlaylistSongSchema,
  getPlaylistSongsSchema,
  updatePlaylistSchema,
  objectId,
  createPlaylistSchemaType,
  updatePlaylistSchemaType,
};
