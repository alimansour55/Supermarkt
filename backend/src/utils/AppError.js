export class AppError extends Error {
  constructor(message, statusCode = 500, errorCode = undefined) {
    super(message);
    this.statusCode = statusCode;
    /** Optional machine-readable reason the client can branch on (sent as `code`). */
    this.errorCode = errorCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}
