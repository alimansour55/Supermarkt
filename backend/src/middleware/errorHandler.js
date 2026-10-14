import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';
import { captureError } from '../utils/monitoring.js';

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(', ');
  }

  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue)[0];
    message = `${field} already exists`;
  }

  if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid ID format';
  }

  // Every server-side failure is logged and reported, in every environment —
  // previously production 500s left no trace at all.
  if (statusCode >= 500) {
    logger.error({
      err,
      requestId: req.id,
      method: req.method,
      url: req.originalUrl,
      userId: req.user?._id?.toString(),
    }, 'Request failed');
    captureError(err, {
      user: req.user ? { id: req.user._id.toString() } : undefined,
      tags: { requestId: req.id, method: req.method },
      extra: { url: req.originalUrl },
    });

    // Unexpected errors (not AppError) can carry driver/internal details; keep them
    // out of production responses. The request id ties the reply to the log line.
    if (!err.isOperational && process.env.NODE_ENV === 'production') {
      message = 'Something went wrong. Please try again.';
    }
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(statusCode >= 500 && req.id ? { requestId: req.id } : {}),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

export const notFound = (req, res, next) => {
  next(new AppError(`Route not found: ${req.originalUrl}`, 404));
};

export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
