/**
 * Production server for the server-rendered storefront.
 *
 *   npm run build && npm start
 *
 * Env:
 *   PORT               port to listen on (default 3000)
 *   API_PROXY_TARGET   when set, /api/* is proxied to the Express API (e.g. http://127.0.0.1:5001).
 *                      Leave unset when a reverse proxy (Nginx/Caddy) already routes /api.
 *   API_INTERNAL_URL   API base the SSR loaders call from the server (default http://127.0.0.1:5001/api)
 */
import compression from 'compression';
import express from 'express';
import { createRequestHandler } from '@react-router/express';
import { createProxyMiddleware } from 'http-proxy-middleware';

const PORT = Number(process.env.PORT) || 3000;
const API_PROXY_TARGET = process.env.API_PROXY_TARGET?.trim();

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', process.env.TRUST_PROXY || 'loopback, linklocal, uniquelocal');

if (API_PROXY_TARGET) {
  app.use(createProxyMiddleware({
    target: API_PROXY_TARGET,
    changeOrigin: true,
    pathFilter: '/api',
  }));
}

app.use(compression());

// Fingerprinted build assets — cache forever.
app.use('/assets', express.static('build/client/assets', { immutable: true, maxAge: '1y' }));
// Everything else in public/ (favicon, robots.txt…) — short cache.
app.use(express.static('build/client', { maxAge: '1h', index: false }));

const build = await import('./build/server/index.js');
app.all('*splat', createRequestHandler({ build, mode: process.env.NODE_ENV }));

app.listen(PORT, () => {
  console.log(`Storefront SSR server listening on http://localhost:${PORT}`);
  if (API_PROXY_TARGET) console.log(`  /api → ${API_PROXY_TARGET}`);
});
