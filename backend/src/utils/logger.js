import { format } from 'node:util';
import pino from 'pino';

const base = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'test' ? 'silent' : 'info'),
  base: { service: 'marketplus-api' },
  timestamp: pino.stdTimeFunctions.isoTime,
});

/**
 * console-compatible front for pino: `logger.error('Upload failed:', err.message)`
 * reads like the old console calls, but lands as one structured JSON line.
 * An Error argument is attached as `err` (with its stack) instead of being stringified.
 * A leading plain object is passed through as pino bindings.
 */
const level = (name) => (...args) => {
  if (args.length && args[0] && typeof args[0] === 'object' && !(args[0] instanceof Error)) {
    const [fields, ...rest] = args;
    return base[name](fields, rest.length ? format(...rest) : undefined);
  }
  const err = args.find((a) => a instanceof Error);
  const parts = args.filter((a) => a !== err);
  const msg = parts.length ? format(...parts) : err?.message;
  return err ? base[name]({ err }, msg) : base[name](msg);
};

export const logger = {
  debug: level('debug'),
  info: level('info'),
  warn: level('warn'),
  error: level('error'),
  fatal: level('fatal'),
  child: (bindings) => base.child(bindings),
};

export default logger;
