/**
 * Authentication for outside systems calling the Open API (/api/integrations/v1).
 * Key in `Authorization: Bearer mpk_…` or `X-Api-Key: mpk_…`. Each key belongs to one
 * connection and only opens the scopes ticked on it.
 */
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import IntegrationConnection from '../models/IntegrationConnection.js';
import { AppError } from '../utils/AppError.js';
import { apiKeyMatches, parseApiKey } from '../services/integrations/secrets.js';

const LAST_USED_EVERY_MS = 60 * 1000;

function readKey(req) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  return String(req.headers['x-api-key'] || '').trim();
}

export async function integrationAuth(req, res, next) {
  try {
    const key = readKey(req);
    const parsed = parseApiKey(key);
    if (!parsed) throw new AppError('Missing or malformed API key — send it as "Authorization: Bearer mpk_…"', 401);

    const connection = await IntegrationConnection.findOne({ 'apiKey.prefix': parsed.prefix }).select('+apiKey.hash');
    if (!connection || !apiKeyMatches(key, connection.apiKey?.hash)) {
      throw new AppError('API key is not valid (it may have been replaced or deleted)', 401);
    }
    if (connection.status !== 'active') throw new AppError('This connection is paused in the store admin', 403);
    if (connection.allowedIps?.length && !connection.allowedIps.includes(req.ip)) {
      throw new AppError(`Calls from ${req.ip} are not allowed for this key`, 403);
    }

    const last = connection.apiKey?.lastUsedAt?.getTime() || 0;
    if (Date.now() - last > LAST_USED_EVERY_MS) {
      IntegrationConnection.updateOne({ _id: connection._id }, { $set: { 'apiKey.lastUsedAt': new Date() } }).catch(() => {});
    }
    req.integration = connection;
    req.dryRun = connection.testMode || String(req.query.dryRun || req.headers['x-dry-run'] || '') === 'true';
    next();
  } catch (err) {
    next(err);
  }
}

export const requireScope = (...scopes) => (req, res, next) => {
  const have = req.integration?.scopes || [];
  if (!scopes.some((s) => have.includes(s))) {
    return next(new AppError(`This key is not allowed to do that — it needs the "${scopes.join('" or "')}" permission`, 403));
  }
  next();
};

/** 600 calls a minute per key (per IP before the key is known). */
export const integrationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.INTEGRATIONS_RATE_LIMIT) || 600,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const parsed = parseApiKey(readKey(req));
    return parsed ? `integration:${parsed.prefix}` : `integration-ip:${ipKeyGenerator(req.ip)}`;
  },
  message: { success: false, message: 'Too many requests — slow down and retry in a minute' },
});
