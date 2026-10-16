/**
 * Secrets for outside systems: API keys we hand out (stored only as a hash) and
 * secrets we must be able to read back (webhook signing secret, connector logins),
 * stored AES-256-GCM encrypted with a key derived from INTEGRATIONS_SECRET (or JWT_SECRET).
 */
import crypto from 'node:crypto';

const KEY_PREFIX = 'mpk';

function encryptionKey() {
  const base = process.env.INTEGRATIONS_SECRET || process.env.JWT_SECRET;
  if (!base) throw new Error('INTEGRATIONS_SECRET (or JWT_SECRET) must be set to store integration secrets');
  return crypto.createHash('sha256').update(`integrations:${base}`).digest();
}

export function encryptSecret(plain) {
  if (plain == null || plain === '') return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join(':');
}

export function decryptSecret(stored) {
  if (!stored) return '';
  const [version, iv, tag, data] = String(stored).split(':');
  if (version !== 'v1' || !iv || !tag || data == null) return '';
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
}

export function encryptJson(value) {
  return value ? encryptSecret(JSON.stringify(value)) : '';
}

export function decryptJson(stored) {
  const text = decryptSecret(stored);
  if (!text) return {};
  try { return JSON.parse(text); } catch { return {}; }
}

export function hashApiKey(key) {
  return crypto.createHash('sha256').update(String(key)).digest('hex');
}

/** `mpk_<prefix>_<secret>` — the prefix is stored in clear to find the connection, the rest only as a hash. */
export function generateApiKey() {
  const prefix = crypto.randomBytes(6).toString('hex');
  const secret = crypto.randomBytes(24).toString('base64url');
  const key = `${KEY_PREFIX}_${prefix}_${secret}`;
  return { key, prefix, hash: hashApiKey(key), last4: key.slice(-4) };
}

export function parseApiKey(key) {
  const match = /^mpk_([a-f0-9]{12})_[A-Za-z0-9_-]{20,}$/.exec(String(key || '').trim());
  return match ? { prefix: match[1] } : null;
}

export function apiKeyMatches(key, hash) {
  if (!hash) return false;
  const a = Buffer.from(hashApiKey(key), 'hex');
  const b = Buffer.from(String(hash), 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function generateWebhookSecret() {
  return `whsec_${crypto.randomBytes(24).toString('base64url')}`;
}

/** Signature the receiver checks: HMAC-SHA256 of `${timestamp}.${body}`. */
export function signWebhook(secret, timestamp, body) {
  return crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}
