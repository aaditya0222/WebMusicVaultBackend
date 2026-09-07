import { Schema, model, Types } from "mongoose";

export interface SongPalette {
  vibrant?: string | null;
  muted?: string | null;
  darkVibrant?: string | null;
  lightVibrant?: string | null;
}

export interface SongI {
  title: string;
  extension: string;
  duration: number;
  artist?: string;
  publicId: string;
  fileUrl: string;
  owner: Types.ObjectId;
  coverImageUrl?: string;
  coverImagePublicId?: string;
  palette?: SongPalette;
  playCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const songSchema = new Schema<SongI>(
  {
    title: { type: String, required: true, trim: true },
    extension: { type: String, default: ".mp3" },
    duration: { type: Number, required: true, min: 1 },
    artist: { type: String, default: "Unknown Artist", trim: true },
    publicId: { type: String, required: true },
    fileUrl: { type: String, required: true },
    coverImageUrl: String,
    coverImagePublicId: String,
    palette: {
      vibrant: String,
      muted: String,
      darkVibrant: String,
      lightVibrant: String,
    },
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

songSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete (ret as any).__v;
  },
});
const Song = model<SongI>("Song", songSchema);
export default Song;
