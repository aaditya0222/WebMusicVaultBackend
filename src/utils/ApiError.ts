import { ErrorCode } from "./ErrorCode";
import { HttpStatus } from "./HttpStatus";

class ApiError extends Error {
  status: typeof HttpStatus;
  errors?: string[];
  code?: typeof ErrorCode;
  constructor(
    status: typeof HttpStatus,
    message: string,
    errors?: string[],
    code?: typeof ErrorCode,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors || undefined;
    this.code = code;
    if (process.env.NODE_ENV === "development") {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}
export default ApiError;
