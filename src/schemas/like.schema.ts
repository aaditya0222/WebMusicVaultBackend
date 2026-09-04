import { z } from "zod";
import { objectId } from "./playlist.schema";
const likeSongSchema = z.object({
  params: z.object({
    id: objectId,
  }),
});

const getLikedSongsSchema = z.object({
  params: z.object({
    userId: objectId,
  }),
  query: z.object({
    limit: z.coerce.number().min(1).max(25).default(10),
    cursor: z.string().optional(),
  }),
});

export { likeSongSchema, getLikedSongsSchema };
