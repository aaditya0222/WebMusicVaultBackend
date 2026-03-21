import expressAsyncHandler from "express-async-handler";
import { Request, Response } from "express";
import { HttpStatus } from "../utils/HttpStatus";
import ApiResponse from "../utils/ApiResponse";
import { getUserDetailsToSend } from "../services/auth.services";
import Song from "../models/song.model";
import Like from "../models/like.model";

const getUserProfile = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const user = getUserDetailsToSend(req.user);

    const [uploadedSongs, favouriteSongs] = await Promise.all([
      Song.countDocuments({ owner: req.user.id }),
      Like.countDocuments({ likedBy: req.user.id, song: { $exists: true } }),
    ]);

    res.status(HttpStatus.OK).json(
      new ApiResponse(HttpStatus.OK, "Successfully sent user data", {
        ...user,
        uploadedSongs,
        favouriteSongs,
      }),
    );
  },
);

const updateUser = expressAsyncHandler((req: Request, res: Response) => {});

export { getUserProfile, updateUser };
