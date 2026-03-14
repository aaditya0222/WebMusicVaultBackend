import { Types, Schema, model } from "mongoose";

interface Playlist {
  name: string;
  owner: Types.ObjectId;
  songs: Types.ObjectId[];
  description?: string;
  status: "private" | "public";
  isDefault?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const playlistSchema = new Schema<Playlist>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    songs: [
      {
        type: Schema.Types.ObjectId,
        ref: "Song",
      },
    ],
    description: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["private", "public"],
      default: "private",
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

playlistSchema.index({ owner: 1, name: 1 }, { unique: true });
playlistSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete (ret as any).__v;
    return ret;
  },
});
const Playlist = model<Playlist>("Playlist", playlistSchema);
export default Playlist;
