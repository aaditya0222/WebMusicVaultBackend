import { Request, Response, NextFunction } from "express";
import { env } from "../config/env";
import { HttpStatus } from "../utils/HttpStatus";
import { ErrorCode } from "../utils/ErrorCode";
const maintenanceMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const maintenance = env.MAINTENANCE_MODE;
  if (maintenance) {
    return res.status(HttpStatus.Forbidden).json({
      status: HttpStatus.Forbidden,
      message: "Server is under maintenance. Please try again later.",
      code: ErrorCode.MAINTENANCE_MODE,
    });
  }
  next();
};

export default maintenanceMiddleware;
