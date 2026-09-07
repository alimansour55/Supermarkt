const REQUIRED = ['MONGODB_URI', 'JWT_SECRET'];

const RECOMMENDED_IN_PRODUCTION = [
  'CLIENT_URL',
  'STRIPE_WEBHOOK_SECRET',
];

const DEV_DEFAULTS = {
  MONGODB_URI: 'mongodb://127.0.0.1:27017/marketplus',
  JWT_SECRET: 'dev_jwt_secret_at_least_32_characters_long',
};

/** Apply safe local defaults so `npm run dev` works before copying .env.example */
function applyDevEnvDefaults() {
  if (process.env.NODE_ENV === 'production') return;
  Object.entries(DEV_DEFAULTS).forEach(([key, value]) => {
    if (!process.env[key]?.trim()) {
      process.env[key] = value;
      console.warn(`[env] Using development default for ${key}`);
    }
  });
}

export const validateEnv = () => {
  applyDevEnvDefaults();

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
