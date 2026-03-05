import { Request, Response, NextFunction } from "express";
import { env } from "../config/env";
import { Error as MongooseError } from "mongoose";
import { ZodError } from "zod";
import { HttpStatus } from "../utils/HttpStatus";
import { ErrorCode } from "../utils/ErrorCode";
import { TokenExpiredError } from "jsonwebtoken";
interface CustomError extends Error {
  status?: HttpStatus;
  errors?: (string | { field: string; message: string })[];
  code?: ErrorCode;
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
    status = HttpStatus.ValidationError;
    message = "Validation Error";
    responseErrors = Object.entries(err.errors).map(([field, error]: any) => ({
      field,
      message: error.message,
    }));
  } else if (err instanceof ZodError) {
    status = HttpStatus.ValidationError;
    message = "Validation Error";

    responseErrors = err.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));
  } else if (err instanceof TokenExpiredError) {
    status = HttpStatus.Unauthorized;
    message = "Session expired, please login again";
    code = ErrorCode.TOKEN_EXPIRED;
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
