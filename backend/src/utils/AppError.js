export class AppError extends Error {
  /** `fields` (optional): [{ field, ar, en }] so forms can show each problem under its input. */
  constructor(message, statusCode = 500, fields = null) {
    super(message);
    this.statusCode = statusCode;
    if (fields) this.fields = fields;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}
