/** Private LAN origins for phone/tablet testing on the same Wi‑Fi (development only). */
const LAN_ORIGIN_RE = /^https?:\/\/(?:192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(?::\d+)?$/;

const parseOrigins = () => {
  const fromEnv = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const defaults = [
    process.env.CLIENT_URL,
    ...(process.env.NODE_ENV !== 'production'
      ? ['http://localhost:5173', 'http://127.0.0.1:5173']
      : []),
  ].filter(Boolean);

  return [...new Set([...defaults, ...fromEnv])];
};

export const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = parseOrigins();

    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, origin);
      return;
    }

    if (process.env.NODE_ENV !== 'production') {
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        callback(null, origin);
        return;
      }
      if (LAN_ORIGIN_RE.test(origin)) {
        callback(null, origin);
        return;
      }
    }

    callback(new Error('Not allowed by CORS'));
  },
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
