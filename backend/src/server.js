/**
 * MarketPlus API entry point — validates env, connects MongoDB, starts Express.
 */
import './config/loadEnv.js';
import app from './app.js';
import connectDB from './config/db.js';
import { validateEnv } from './config/env.js';
import { initCloudinary } from './utils/cloudinaryUpload.js';
import { configureStripe } from './config/stripe.js';
import { configureNodemailer } from './config/nodemailer.js';
import { configureSms } from './config/sms.js';
import { logMobileAccessHints } from './utils/lanAddress.js';
import { startChatAutoCloseJob } from './controllers/supportConversation.controller.js';
import mongoose from 'mongoose';
import { logger } from './utils/logger.js';
import { initMonitoring, captureError } from './utils/monitoring.js';

const PORT = Number(process.env.PORT) || 5001;
const FRONTEND_PORT = Number(process.env.FRONTEND_PORT) || 5173;

let server;

const startServer = async () => {
  try {
    validateEnv();
    initMonitoring();
    await connectDB();
    startChatAutoCloseJob();

    initCloudinary();
    configureStripe();
    configureNodemailer();
    configureSms();

    server = app.listen(PORT, '0.0.0.0', () => {
      logger.info(`API running on http://localhost:${PORT} (all interfaces)`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logMobileAccessHints({ frontendPort: FRONTEND_PORT, apiPort: PORT });
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Let in-flight requests finish before exiting on a deploy / container stop.
const shutdown = (signal) => {
  logger.info(`${signal} received — shutting down`);
  const force = setTimeout(() => process.exit(1), 10_000);
  force.unref();
  server?.close(async () => {
    await mongoose.disconnect().catch(() => {});
    process.exit(0);
  });
  if (!server) process.exit(0);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  logger.error('Unhandled promise rejection', err);
  captureError(err, { tags: { kind: 'unhandledRejection' } });
});

startServer();
