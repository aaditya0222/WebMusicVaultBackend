import { ErrorCode } from "./ErrorCode";
import { HttpStatus } from "./HttpStatus";

class ApiError extends Error {
  status: HttpStatus;
  errors?: string[];
  code?: ErrorCode;
  constructor(
    status: HttpStatus,
    message: string,
    errors?: string[],
    code?: ErrorCode,
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
