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

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    validateEnv();
    await connectDB();

    initCloudinary();
    configureStripe();
    configureNodemailer();
    configureSms();

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();
