import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error('MONGODB_URI is not defined in environment variables');
  }

  mongoose.set('strictQuery', true);

  await mongoose.connect(uri);
  logger.info(`MongoDB connected: ${mongoose.connection.host}`);
};

export default connectDB;
