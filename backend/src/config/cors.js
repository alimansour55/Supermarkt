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

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    if (
      process.env.NODE_ENV !== 'production'
      && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
    ) {
      callback(null, true);
      return;
    }

    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
