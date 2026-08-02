import { Schema, model, Types } from "mongoose";

export interface SongI {
  title: string;
  duration: number;
  artist?: string;
  publicId: string;
  fileUrl: string;
  owner: Types.ObjectId;
  coverImageUrl?: string;
  coverImagePublicId?: string;
  playCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const songSchema = new Schema<SongI>(
  {
    title: { type: String, required: true, trim: true },
    duration: { type: Number, required: true, min: 1 },
    artist: { type: String, default: "Unknown Artist", trim: true },
    publicId: { type: String, required: true },
    fileUrl: { type: String, required: true },
    coverImageUrl: String,
    coverImagePublicId: String,
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    playCount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  },
);
//indexing for searching
// songSchema.index(
//   {
//     title: "text",
//     artist: "text",
//     // tags: "text",
//     // genre: "text",
//   },
//   {
//     weights: {
//       title: 10,
//       artist: 3,
//     },
//   },
// );removed text search and switched to regex search instead
//indexing for artist+title uniqueness
songSchema.index({ title: 1, artist: 1 }, { unique: true });

songSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete (ret as any).__v;
  },
});
const Song = model<SongI>("Song", songSchema);
export default Song;
