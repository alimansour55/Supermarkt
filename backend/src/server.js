/**
 * MarketPlus API entry point — validates env, connects MongoDB, starts Express.
 */
import 'dotenv/config';
import app from './app.js';
import connectDB from './config/db.js';
import { validateEnv } from './config/env.js';
import { initCloudinary } from './utils/cloudinaryUpload.js';
import { configureStripe } from './config/stripe.js';
import { configureNodemailer } from './config/nodemailer.js';
import { configureSms } from './config/sms.js';
import { logMobileAccessHints } from './utils/lanAddress.js';

const PORT = Number(process.env.PORT) || 5001;
const FRONTEND_PORT = Number(process.env.FRONTEND_PORT) || 5173;

const startServer = async () => {
  try {
    validateEnv();
    await connectDB();

    initCloudinary();
    configureStripe();
    configureNodemailer();
    configureSms();

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`API running on http://localhost:${PORT} (all interfaces)`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logMobileAccessHints({ frontendPort: FRONTEND_PORT, apiPort: PORT });
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();
