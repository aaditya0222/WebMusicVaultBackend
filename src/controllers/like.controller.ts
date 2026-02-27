import asyncHandler from "express-async-handler";
import { Request, Response } from "express";
import Song from "../models/song.model";
import Like from "../models/like.model";
import { HttpStatus } from "../utils/HttpStatus";
import ApiResponse from "../utils/ApiResponse";
const toggleSongLike = asyncHandler(async (req: Request, res: Response) => {
  const songId = req.params.id;
  const song = await Song.exists({ _id: songId });
  if (!song) {
    res.status(404).json({ message: "Song not found" });
    return;
  }
  const likeData = {
    song: songId,
    likedBy: req.user._id,
  };

  const deletedLike = await Like.findOneAndDelete(likeData);
  if (deletedLike) {
    res
      .status(200)
      .send(
        new ApiResponse(
          HttpStatus.OK,
          "Successfully removed song from favourites",
          false,
        ),
      );
    return;
  }

  await Like.create(likeData);

  res
    .status(200)
    .send(
      new ApiResponse(
        HttpStatus.OK,
        "Successfully added song to favourites",
        true,
      ),
    );
});

export { toggleSongLike };
