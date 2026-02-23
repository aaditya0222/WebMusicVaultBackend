import { Document, Schema, model } from "mongoose";
interface songT extends Document {
  title: string;
  duration: number;
  artist: string;
  publicId: string;
  fileUrl: string;
  owner?: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const songSchema = new Schema<songT>(
  {
    title: { type: String, required: true },
    duration: { type: Number, required: true },
    artist: { type: String, default: "Unknown Artist" },
    publicId: { type: String, required: true },
    fileUrl: { type: String, required: true },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
  },
  {
    timestamps: true,
  },
);

const Song = model<songT>("Song", songSchema);
export default Song;
