import { Request, Response, NextFunction } from "express";
import { env } from "../config/env";
import { HttpStatus } from "../utils/HttpStatus";
const maintainanceMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const maintainance = env.MAINTAINANCE_MODE;
  if (maintainance) {
    return res.status(HttpStatus.Forbidden).json({
      status: HttpStatus.Forbidden,
      message: "Server is under maintenance. Please try again later.",
    });
  }
  next();
};

export default maintainanceMiddleware;
