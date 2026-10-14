import * as Sentry from '@sentry/node';
import { logger } from './logger.js';

let enabled = false;

/** Error reporting is opt-in: set SENTRY_DSN to turn it on. */
export function initMonitoring() {
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) return false;
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE) || 0,
  });
  enabled = true;
  logger.info('Sentry error reporting enabled');
  return true;
}

export function captureError(err, context = {}) {
  if (!enabled) return;
  Sentry.withScope((scope) => {
    if (context.user) scope.setUser(context.user);
    if (context.tags) scope.setTags(context.tags);
    if (context.extra) scope.setExtras(context.extra);
    Sentry.captureException(err);
  });
}
