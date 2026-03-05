import expressAsyncHandler from "express-async-handler";
import { Request, Response } from "express";
import { HttpStatus } from "../utils/HttpStatus";
import ApiResponse from "../utils/ApiResponse";
import { getUserDetailsToSend } from "../services/auth.services";

const getUserProfile = (req: Request, res: Response) => {
  const user = getUserDetailsToSend(req.user);
  res.status(HttpStatus.OK).json(
    new ApiResponse(HttpStatus.Created, "Successfully sent user data", {
      user,
    }),
  );
};

const updateUser = expressAsyncHandler((req: Request, res: Response) => {});

export { getUserProfile, updateUser };
