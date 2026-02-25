import { z } from "zod";
import { objectId } from "./playlist.schema";
const likeSongSchema = z.object({
  params: z.object({
    id: objectId,
  }),
});

export { likeSongSchema };
