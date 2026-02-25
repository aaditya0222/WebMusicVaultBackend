import { model, Schema, Types } from "mongoose";

interface Like {
  song?: Types.ObjectId;
  playlist?: Types.ObjectId;
  likedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
const likeSchema = new Schema<Like>(
  {
    song: {
      type: Schema.Types.ObjectId,
      ref: "Song",
    },
    playlist: {
      type: Schema.Types.ObjectId,
      ref: "Playlist",
    },
    likedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);
likeSchema.pre("validate", function (next) {
  if (!this.song && !this.playlist) {
    return next(new Error("Like must reference a song or playlist"));
  }
  if (this.song && this.playlist) {
    return next(new Error("Like cannot reference both"));
  }
  // Ensure the unused field is removed from the document entirely
  if (this.song) {
    this.playlist = undefined;
  } else {
    this.song = undefined;
  }
  next();
});
likeSchema.index({ song: 1, likedBy: 1 }, { unique: true, sparse: true });
//when not using sparse true it was treating also the undefined values as actual values which was causing error.
likeSchema.index({ playlist: 1, likedBy: 1 }, { unique: true, sparse: true });

const Like = model<Like>("Like", likeSchema);
export default Like;
