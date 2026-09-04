import { NextFunction, Request, Response } from "express";
import jwt, { JsonWebTokenError, TokenExpiredError } from "jsonwebtoken";
import { env } from "../config/env";
import ApiError from "../utils/ApiError";
import { HttpStatus } from "../utils/HttpStatus";
import { ErrorCode } from "../utils/ErrorCode";
import User from "../models/user.model";
import type { JwtPayload } from "jsonwebtoken";

export const authMiddleware = async (
  req: Request,
  _res: Response,
  next: NextFunction,
  strict: boolean = true,
) => {
  const accessToken = req.get("authorization")?.split(" ")[1];

  if (!accessToken) {
    if (strict) {
      return next(
        new ApiError(HttpStatus.Unauthorized, "Access token is required"),
      );
    }
    // No token -> genuine guest, proceed without a user.
    return next();
  }

  try {
    const decoded = jwt.verify(
      accessToken,
      env.ACCESS_TOKEN_SECRET,
    ) as JwtPayload;
    const user = await User.findById(decoded._id);
    if (!user) {
      return next(new ApiError(HttpStatus.Unauthorized, "Invalid token"));
    }
    req.user = user;
    next();
  } catch (error) {
    // Normalize JWT failures so both route flavors return a consistent 401
    // instead of an unhandled 500 from a raw jsonwebtoken error.
    const authError =
      error instanceof JsonWebTokenError
        ? new ApiError(
            HttpStatus.Unauthorized,
            error instanceof TokenExpiredError
              ? "Session expired, please login again"
              : "Invalid token",
            { code: ErrorCode.TOKEN_EXPIRED },
          )
        : error;

    if (strict) {
      return next(authError);
    }

    // Non-strict routes: a token that WAS presented but is expired/invalid
    // must 401 so the client interceptor refreshes it. Silently degrading
    // to guest data here is what made playlists/songs look wrong after the
    // access token expired mid-session. Non-JWT errors (DB hiccups) are
    // still ignored -> request continues as a guest.
    if (error instanceof JsonWebTokenError) {
      return next(authError);
    }
    next();
  }
};

export const authMiddlewareNotStrict = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  return authMiddleware(req, res, next, false);
};
