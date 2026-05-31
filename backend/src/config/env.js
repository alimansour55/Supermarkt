const REQUIRED = ['MONGODB_URI', 'JWT_SECRET'];

const RECOMMENDED_IN_PRODUCTION = [
  'CLIENT_URL',
  'STRIPE_WEBHOOK_SECRET',
];

export const validateEnv = () => {
  const missing = REQUIRED.filter((key) => !process.env[key]?.trim());

  if (missing.length) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. Copy .env.example to .env and configure secrets.`,
    );
  }

  if (process.env.JWT_SECRET.length < 32 && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be at least 32 characters in production');
  }

  if (process.env.NODE_ENV === 'production') {
    RECOMMENDED_IN_PRODUCTION.forEach((key) => {
      if (!process.env[key]?.trim()) {
        console.warn(`Warning: ${key} is not set — recommended for production`);
      }
    });
  }
};
