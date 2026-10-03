/**
 * Express app — CORS, Stripe webhook (raw body), JSON routes, error handling.
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import routes from './routes/index.js';
import { stripeWebhook } from './controllers/payment.controller.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import { hidePrivateFields } from './middleware/hidePrivateFields.js';
import { corsOptions } from './config/cors.js';

const app = express();

// This is a JSON-only API (the React app is served separately), so the HTML-oriented
// CSP directives are unnecessary here and can be safely disabled.
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));
app.use(cors(corsOptions));

app.post('/api/payment/webhook', express.raw({ type: 'application/json' }), stripeWebhook);

app.use(express.json({
  limit: '10mb',
  verify: (req, _res, buf) => { req.rawBody = buf; },
}));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get('/', (_req, res) => {
  res.json({
    success: true,
    message: 'Welcome to MarketPlus API',
    docs: '/api/health',
  });
});

app.use('/api', hidePrivateFields, routes);

app.use(notFound);
app.use(errorHandler);

export default app;
