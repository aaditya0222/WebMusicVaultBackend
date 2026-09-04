import { Request, Response, NextFunction } from "express";
import { env } from "../config/env";
import { Error as MongooseError } from "mongoose";
import { ZodError } from "zod";
import { HttpStatus } from "../utils/HttpStatus";
import { ErrorCode } from "../utils/ErrorCode";
import { TokenExpiredError } from "jsonwebtoken";
import { MulterError } from "multer";
interface CustomError extends Error {
  status?: HttpStatus;
  errors?: (string | { field: string; message: string })[];
  // `string` is included so a `CustomError & MulterError` intersection stays
  // representable (MulterError.code is a plain string, e.g. "LIMIT_FILE_SIZE")
  // instead of collapsing to `never`.
  code?: ErrorCode | string;
}

type NormalizedError = { field?: string; message: string };

const errorMiddleware = (
  err: CustomError,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  let status = err.status || HttpStatus.InternalServerError;
  let message = err.message || "Backend Error";
  let code = err.code;
  let responseErrors: NormalizedError[] = [];

  if (err instanceof MongooseError.ValidationError) {
    status = HttpStatus.BadRequest;
    code = ErrorCode.VALIDATION_ERROR;
    message = "Validation Error";
    responseErrors = Object.entries(err.errors).map(([field, error]) => ({
      field,
      message: error.message,
    }));
  } else if (err instanceof ZodError) {
    status = HttpStatus.BadRequest;
    code = ErrorCode.VALIDATION_ERROR;
    message = "Validation Error";

    responseErrors = err.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));
  } else if (err instanceof TokenExpiredError) {
    status = HttpStatus.Unauthorized;
    message = "Session expired, please login again";
    code = ErrorCode.TOKEN_EXPIRED;
  } else if (err instanceof MulterError) {
    // Multer errors carry no `status`, so without this branch they fall
    // through as 500s (multer aborts the upload mid-stream -> LIMIT_FILE_SIZE
    // is a client error, not a server fault).
    if (err.code === "LIMIT_FILE_SIZE") {
      status = HttpStatus.PayloadTooLarge;
      const imageMb = Math.round(
        env.MAX_COVER_IMAGE_FILE_SIZE / (1024 * 1024),
      );
      const musicMb = Math.round(env.MAX_MUSIC_FILE_SIZE / (1024 * 1024));
      message =
        err.field === "song"
          ? `Audio file is too large. Maximum allowed size is ${musicMb} MB`
          : `Image is too large. Maximum allowed size is ${imageMb} MB`;
    } else if (err.code === "LIMIT_UNEXPECTED_FILE") {
      status = HttpStatus.BadRequest;
      message = err.field
        ? `Unexpected file field: ${err.field}`
        : "Unexpected file in upload";
    } else {
      status = HttpStatus.BadRequest;
      message = `Upload error: ${err.message}`;
    }
  } else if (Array.isArray(err.errors) && err.errors.length > 0) {
    responseErrors = err.errors.map((e) =>
      typeof e === "string" ? { message: e } : e,
    );
  } else {
    responseErrors = [{ message: err.message }];
  }

  res.status(status).json({
    status,
    message,
    code,
    ...(responseErrors.length && { errors: responseErrors }),
    ...(env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

export default errorMiddleware;
