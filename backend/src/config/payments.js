/**
 * Payment gateway configuration (Egypt): Paymob + Fawry. Every value comes from the
 * environment; a method is offered at checkout only when its gateway is configured,
 * so a half-configured gateway can never take an order it cannot charge.
 */

const env = (key) => process.env[key]?.trim() || '';
const intEnv = (key) => {
  const n = Number.parseInt(env(key), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export function getPaymobConfig() {
  return {
    baseUrl: (env('PAYMOB_BASE_URL') || 'https://accept.paymob.com').replace(/\/+$/, ''),
    secretKey: env('PAYMOB_SECRET_KEY'),
    publicKey: env('PAYMOB_PUBLIC_KEY'),
    hmacSecret: env('PAYMOB_HMAC_SECRET'),
    /** Legacy API key — only for the transaction-inquiry (reconciliation) API. */
    apiKey: env('PAYMOB_API_KEY'),
    integrations: {
      card: intEnv('PAYMOB_INTEGRATION_CARD'),
      applePay: intEnv('PAYMOB_INTEGRATION_APPLE_PAY'),
      wallet: intEnv('PAYMOB_INTEGRATION_WALLET'),
      valu: intEnv('PAYMOB_INTEGRATION_VALU'),
    },
  };
}

export function getFawryConfig() {
  const live = env('FAWRY_ENV') === 'production';
  return {
    baseUrl: (env('FAWRY_BASE_URL') || (live ? 'https://www.atfawry.com' : 'https://atfawry.fawrystaging.com'))
      .replace(/\/+$/, ''),
    merchantCode: env('FAWRY_MERCHANT_CODE'),
    secureKey: env('FAWRY_SECURE_KEY'),
    expiryHours: Number(env('FAWRY_EXPIRY_HOURS')) || 48,
  };
}

const paymobCore = (c) => Boolean(c.secretKey && c.publicKey && c.hmacSecret);

/** Paymob integration ids to offer for a checkout method (empty = not configured). */
export function paymobIntegrationsFor(methodId, config = getPaymobConfig()) {
  const { card, applePay, wallet, valu } = config.integrations;
  switch (methodId) {
    case 'paymob_card': return [card, applePay].filter(Boolean);
    case 'paymob_wallet': return [wallet].filter(Boolean);
    case 'paymob_valu': return [valu].filter(Boolean);
    default: return [];
  }
}

export function isPaymentMethodConfigured(methodId) {
  switch (methodId) {
    case 'paymob_card':
    case 'paymob_wallet':
    case 'paymob_valu': {
      const config = getPaymobConfig();
      return paymobCore(config) && paymobIntegrationsFor(methodId, config).length > 0;
    }
    case 'fawry': {
      const config = getFawryConfig();
      return Boolean(config.merchantCode && config.secureKey);
    }
    case 'stripe':
      return Boolean(env('STRIPE_SECRET_KEY'));
    default:
      return true; // cod and manual transfers need no gateway
  }
}

/** Public origin of this API, used for gateway callbacks (must be reachable from the internet). */
export function publicApiUrl() {
  const explicit = env('PUBLIC_API_URL');
  if (explicit) return explicit.replace(/\/+$/, '');
  return `${(env('CLIENT_URL') || 'http://localhost:5173').replace(/\/+$/, '')}/api`;
}

export function clientUrl() {
  return (env('CLIENT_URL') || 'http://localhost:5173').replace(/\/+$/, '');
}

/** Deep link the mobile app listens on after a hosted-checkout payment. */
export function appReturnUrl() {
  return env('APP_PAYMENT_RETURN_URL') || 'marketplus://app/payment/result';
}
