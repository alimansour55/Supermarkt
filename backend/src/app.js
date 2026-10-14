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
import { corsOptions } from './config/cors.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { requestId } from './middleware/requestId.js';

const app = express();

// Behind a reverse proxy / load balancer, req.ip must come from X-Forwarded-For or
// every rate limiter sees one shared IP. Set TRUST_PROXY to the hop count (e.g. 1).
if (process.env.TRUST_PROXY) {
  const hops = Number(process.env.TRUST_PROXY);
  app.set('trust proxy', Number.isFinite(hops) ? hops : process.env.TRUST_PROXY);
}

app.use(requestId);

// This is a JSON-only API (the React app is served separately), so the HTML-oriented
// CSP directives are unnecessary here and can be safely disabled.
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));
app.use(cors(corsOptions));

app.post('/api/payment/webhook', express.raw({ type: 'application/json' }), stripeWebhook);

// Uploads go through multer (multipart), so JSON bodies stay small — except the
// admin catalog import, which posts a whole CSV inside JSON. Whichever parser runs
// first wins, so the import route gets its larger limit here.
app.use('/api/products/admin/import', express.json({ limit: '10mb' }));
app.use(express.json({
  limit: '2mb',
  verify: (req, _res, buf) => { req.rawBody = buf; },
}));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());

app.get('/', (_req, res) => {
  res.json({
    success: true,
    message: 'Welcome to MarketPlus API',
    docs: '/api/health',
  });
});

app.use('/api', apiLimiter, routes);

app.use(notFound);
app.use(errorHandler);

export default app;
