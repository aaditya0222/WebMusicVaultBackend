import { ErrorCode } from "./ErrorCode";
import { HttpStatus } from "./HttpStatus";
class ApiError extends Error {
  status: HttpStatus;
  code?: ErrorCode;
  errors?: string[];
  constructor(
    status: HttpStatus,
    message: string,
    options?: { code?: ErrorCode; errors?: string[] },
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    if (options?.code) this.code = options.code;
    if (options?.errors?.length) this.errors = options.errors;
    if (process.env.NODE_ENV === "development") {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}
export default ApiError;
