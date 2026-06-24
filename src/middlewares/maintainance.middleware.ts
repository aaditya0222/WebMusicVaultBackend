import { Request, Response, NextFunction } from "express";
import { env } from "../config/env";
import { HttpStatus } from "../utils/HttpStatus";
import { ErrorCode } from "../utils/ErrorCode";
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
      code: ErrorCode.MAINTENANCE_MODE,
    });
  }
  next();
};

export default maintainanceMiddleware;
