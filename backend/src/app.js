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

// Behind a reverse proxy (Caddy/Nginx, Docker network) req.ip must come from
// X-Forwarded-For, otherwise every visitor shares the proxy's IP and the login
// rate limiter locks everyone out together. Trusts private-network proxies by default.
app.set('trust proxy', process.env.TRUST_PROXY || 'loopback, linklocal, uniquelocal');

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
