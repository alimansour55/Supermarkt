/**
 * Paymob (Egypt) — Intention API + Unified Checkout.
 *
 * Flow: create an intention for the order → send the customer to Paymob's hosted
 * Unified Checkout (cards incl. Meeza, Apple Pay, mobile wallets, valU) → Paymob POSTs
 * the result to our notification URL (HMAC-SHA512 signed) and redirects the customer back.
 * The webhook is authoritative; the redirect is double-checked against the inquiry API.
 */
import crypto from 'node:crypto';
import { AppError } from '../../utils/AppError.js';
import { getPaymobConfig, paymobIntegrationsFor } from '../../config/payments.js';

const REQUEST_TIMEOUT_MS = 15_000;

/** Paymob's documented field order for the Transaction Processed callback HMAC. */
export const PAYMOB_HMAC_FIELDS = [
  'amount_cents',
  'created_at',
  'currency',
  'error_occured',
  'has_parent_transaction',
  'id',
  'integration_id',
  'is_3d_secure',
  'is_auth',
  'is_capture',
  'is_refunded',
  'is_standalone_payment',
  'is_voided',
  'order.id',
  'owner',
  'pending',
  'source_data.pan',
  'source_data.sub_type',
  'source_data.type',
  'success',
];

const toHmacString = (value) => (value === undefined || value === null ? '' : String(value));

function readPath(obj, path) {
  return path.split('.').reduce((cur, key) => (cur == null ? undefined : cur[key]), obj);
}

function hmacHex(concatenated, secret) {
  return crypto.createHmac('sha512', secret).update(concatenated, 'utf8').digest('hex');
}

function safeEqualHex(a, b) {
  const left = Buffer.from(String(a || '').toLowerCase(), 'utf8');
  const right = Buffer.from(String(b || '').toLowerCase(), 'utf8');
  return left.length === right.length && left.length > 0 && crypto.timingSafeEqual(left, right);
}

/** The exact string Paymob signs, built from a callback's `obj`. */
export function paymobCallbackSigningString(obj) {
  return PAYMOB_HMAC_FIELDS.map((field) => toHmacString(readPath(obj, field))).join('');
}

/** Same fields, but from the flat query string Paymob appends to the redirect URL. */
export function paymobRedirectSigningString(query) {
  return PAYMOB_HMAC_FIELDS
    .map((field) => toHmacString(field === 'order.id' ? query.order : query[field]))
    .join('');
}

export function verifyPaymobCallback(obj, hmac, secret = getPaymobConfig().hmacSecret) {
  if (!secret || !obj || !hmac) return false;
  return safeEqualHex(hmacHex(paymobCallbackSigningString(obj), secret), hmac);
}

export function verifyPaymobRedirect(query, secret = getPaymobConfig().hmacSecret) {
  if (!secret || !query?.hmac) return false;
  return safeEqualHex(hmacHex(paymobRedirectSigningString(query), secret), query.hmac);
}

const asBool = (value) => value === true || value === 'true';

/**
 * Reduce a Paymob transaction (callback `obj`, inquiry response, or redirect query) to
 * what the order needs. Refund/void child transactions are reported as `refund_event`.
 */
export function interpretPaymobTransaction(tx) {
  const orderField = tx.order;
  const base = {
    transactionId: tx.id != null ? String(tx.id) : null,
    amountCents: Number(tx.amount_cents),
    currency: tx.currency || '',
    merchantOrderId: (typeof orderField === 'object' ? orderField?.merchant_order_id : null)
      ?? tx.merchant_order_id ?? null,
    paymobOrderId: typeof orderField === 'object' ? orderField?.id ?? null : orderField ?? null,
    sourceType: readPath(tx, 'source_data.type') ?? tx['source_data.type'] ?? '',
    sourceSubType: readPath(tx, 'source_data.sub_type') ?? tx['source_data.sub_type'] ?? '',
    maskedPan: readPath(tx, 'source_data.pan') ?? tx['source_data.pan'] ?? '',
  };
  if (asBool(tx.has_parent_transaction) || asBool(tx.is_refunded) || asBool(tx.is_voided)) {
    return { ...base, state: 'refund_event' };
  }
  if (asBool(tx.pending)) return { ...base, state: 'pending' };
  if (asBool(tx.success)) return { ...base, state: 'paid' };
  return { ...base, state: 'failed' };
}

async function paymobRequest(path, { method = 'POST', body, auth = 'secret', token } = {}) {
  const config = getPaymobConfig();
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (auth === 'secret') headers.Authorization = `Token ${config.secretKey}`;
  if (auth === 'bearer') headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${config.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    throw new AppError(`Payment gateway unreachable: ${err.message}`, 502);
  }

  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text.slice(0, 300) }; }
  if (!response.ok) {
    const detail = data?.detail || data?.message || JSON.stringify(data).slice(0, 300);
    console.error(`[paymob] ${method} ${path} → ${response.status}: ${detail}`);
    throw new AppError(`Payment gateway error (${response.status})`, 502);
  }
  return data;
}

function splitName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { first: 'Customer', last: 'NA' };
  return { first: parts[0], last: parts.slice(1).join(' ') || 'NA' };
}

function billingEmail(user) {
  if (user?.email) return user.email;
  const digits = String(user?.phone || '').replace(/\D/g, '') || String(user?._id || 'customer');
  return `${digits}@customers.marketplus.local`;
}

/**
 * Create a Paymob intention for one payment attempt and return the hosted-checkout URL.
 * `reference` must be unique per attempt — it comes back as `merchant_order_id`.
 */
export async function createPaymobCheckout({ order, user, methodId, reference, notificationUrl, redirectionUrl }) {
  const config = getPaymobConfig();
  const integrations = paymobIntegrationsFor(methodId, config);
  if (!integrations.length) throw new AppError('Payment method is not configured', 503);

  const amountCents = Math.round(Number(order.total) * 100);
  const { first, last } = splitName(user?.name);
  const address = order.shippingAddress || {};
  const na = (value) => String(value || '').trim() || 'NA';

  const intention = await paymobRequest('/v1/intention/', {
    body: {
      amount: amountCents,
      currency: 'EGP',
      payment_methods: integrations,
      // One line for the whole order: coupons, points and wallet credit make
      // per-item amounts disagree with the charged total.
      items: [{
        name: `Order ${order.orderNumber}`.slice(0, 50),
        amount: amountCents,
        description: `${order.items?.length || 0} item(s)`,
        quantity: 1,
      }],
      billing_data: {
        first_name: first,
        last_name: last,
        email: billingEmail(user),
        phone_number: order.phone || user?.phone || 'NA',
        street: na(address.street),
        building: na(address.building),
        floor: na(address.floor),
        apartment: 'NA',
        city: na(address.city || address.area),
        state: na(address.governorate),
        country: 'EGY',
      },
      customer: { first_name: first, last_name: last, email: billingEmail(user) },
      special_reference: reference,
      extras: { orderId: String(order._id), orderNumber: order.orderNumber },
      expiration: 3600,
      notification_url: notificationUrl,
      redirection_url: redirectionUrl,
    },
  });

  if (!intention?.client_secret) {
    throw new AppError('Payment gateway did not return a checkout session', 502);
  }

  const query = new URLSearchParams({ publicKey: config.publicKey, clientSecret: intention.client_secret });
  return {
    intentionId: intention.id ? String(intention.id) : null,
    paymobOrderId: intention.intention_order_id ? String(intention.intention_order_id) : null,
    checkoutUrl: `${config.baseUrl}/unifiedcheckout/?${query}`,
    amountCents,
  };
}

/** Authoritative transaction lookup (needs PAYMOB_API_KEY); null when unavailable. */
export async function fetchPaymobTransaction(transactionId) {
  const config = getPaymobConfig();
  if (!config.apiKey || !transactionId) return null;
  const auth = await paymobRequest('/api/auth/tokens', { body: { api_key: config.apiKey }, auth: 'none' });
  if (!auth?.token) return null;
  return paymobRequest(`/api/acceptance/transactions/${encodeURIComponent(transactionId)}`, {
    method: 'GET',
    auth: 'bearer',
    token: auth.token,
  });
}

/** Refund (full or partial) a captured Paymob transaction. Returns the refund transaction id. */
export async function refundPaymobTransaction(transactionId, amountEgp) {
  const result = await paymobRequest('/api/acceptance/void_refund/refund', {
    body: { transaction_id: Number(transactionId), amount_cents: Math.round(Number(amountEgp) * 100) },
  });
  if (result && result.success === false) {
    throw new AppError(`Refund was declined by the payment gateway${result.data?.message ? `: ${result.data.message}` : ''}`, 502);
  }
  return result?.id != null ? String(result.id) : null;
}
