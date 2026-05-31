import mongoose from 'mongoose';
import { asyncHandler } from '../middleware/errorHandler.js';

export const healthCheck = asyncHandler(async (_req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  res.status(200).json({
    success: true,
    message: 'MarketPlus API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: dbStatus[dbState] || 'unknown',
  });
});
