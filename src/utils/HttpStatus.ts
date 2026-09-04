export enum HttpStatus {
  // Success
  OK = 200,
  Created = 201,
  NoContent = 204,

  // Client errors
  BadRequest = 400,
  Unauthorized = 401,
  Forbidden = 403,
  NotFound = 404,
  Conflict = 409,
  PayloadTooLarge = 413,
  TooManyRequests = 429,

  // Server errors
  InternalServerError = 500,
  NotImplemented = 501,
  BadGateway = 502,
  ServiceUnavailable = 503,
  GatewayTimeout = 504,
}
