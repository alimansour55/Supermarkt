/**
 * FawryPay — "Pay at Fawry" reference numbers. The customer gets a reference number at
 * checkout and pays it in cash at any Fawry outlet or in the myFawry app; Fawry then
 * calls our webhook (Server Notification V2, SHA-256 signed). Status can also be pulled.
 */
import crypto from 'node:crypto';
import { AppError } from '../../utils/AppError.js';
import { getFawryConfig } from '../../config/payments.js';

const REQUEST_TIMEOUT_MS = 15_000;

const sha256 = (value) => crypto.createHash('sha256').update(value, 'utf8').digest('hex');

/** Fawry signs amounts with exactly two decimals ("10.00"). */
export const fawryAmount = (value) => Number(value || 0).toFixed(2);

function safeEqualHex(a, b) {
  const left = Buffer.from(String(a || '').toLowerCase(), 'utf8');
  const right = Buffer.from(String(b || '').toLowerCase(), 'utf8');
  return left.length === right.length && left.length > 0 && crypto.timingSafeEqual(left, right);
}

/** Unique numeric merchant reference per payment attempt (Fawry expects digits). */
export function newFawryMerchantRef() {
  return `${Date.now()}${crypto.randomInt(100, 1000)}`;
}

/** +201012345678 / 201012345678 / 01012345678 → 01012345678 */
export function fawryMobile(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('20') && digits.length === 12) return `0${digits.slice(2)}`;
  if (digits.length === 10 && digits.startsWith('1')) return `0${digits}`;
  return digits;
}

export function chargeSignature({ merchantCode, merchantRefNum, customerProfileId = '', paymentMethod, amount, secureKey }) {
  return sha256(`${merchantCode}${merchantRefNum}${customerProfileId}${paymentMethod}${fawryAmount(amount)}${secureKey}`);
}

export function notificationSignature(body, secureKey) {
  return sha256([
    body.fawryRefNumber ?? '',
    body.merchantRefNumber ?? '',
    fawryAmount(body.paymentAmount),
    fawryAmount(body.orderAmount),
    body.orderStatus ?? '',
    body.paymentMethod ?? '',
    body.paymentRefrenceNumber ?? '', // sic — Fawry's spelling
    secureKey,
  ].join(''));
}

export function verifyFawryNotification(body, secureKey = getFawryConfig().secureKey) {
  if (!secureKey || !body?.messageSignature) return false;
  return safeEqualHex(notificationSignature(body, secureKey), body.messageSignature);
}

/** Map a Fawry order status onto our payment states. */
export function interpretFawryStatus(status) {
  switch (String(status || '').toUpperCase()) {
    case 'PAID': return 'paid';
    case 'NEW':
    case 'UNPAID': return 'pending';
    case 'EXPIRED':
    case 'CANCELED':
    case 'CANCELLED':
    case 'FAILED': return 'failed';
    case 'REFUNDED':
    case 'PARTIAL_REFUNDED': return 'refund_event';
    default: return 'pending';
  }
}

async function fawryRequest(path, { method = 'POST', body, query } = {}) {
  const config = getFawryConfig();
  const url = new URL(`${config.baseUrl}${path}`);
  if (query) Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));

  let response;
  try {
    response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    throw new AppError(`Fawry unreachable: ${err.message}`, 502);
  }
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text.slice(0, 300) }; }

  const statusCode = Number(data?.statusCode ?? response.status);
  if (!response.ok || statusCode !== 200) {
    console.error(`[fawry] ${method} ${path} → ${response.status}/${statusCode}: ${data?.statusDescription || data?.raw || ''}`);
    throw new AppError(`Fawry error: ${data?.statusDescription || response.status}`, 502);
  }
  return data;
}

/** Create a Pay-at-Fawry reference number for the order. */
export async function createFawryReference({ order, user, merchantRefNum, notificationUrl, lang = 'ar' }) {
  const config = getFawryConfig();
  if (!config.merchantCode || !config.secureKey) throw new AppError('Fawry is not configured', 503);

  const paymentMethod = 'PAYATFAWRY';
  const amount = fawryAmount(order.total);
  const expiresAt = new Date(Date.now() + config.expiryHours * 60 * 60 * 1000);
  const email = user?.email
    || `${String(user?.phone || order.phone || '').replace(/\D/g, '') || 'customer'}@customers.marketplus.local`;

  const data = await fawryRequest('/ECommerceWeb/Fawry/payments/charge', {
    body: {
      merchantCode: config.merchantCode,
      merchantRefNum,
      customerName: user?.name || 'Customer',
      customerMobile: fawryMobile(order.phone || user?.phone),
      customerEmail: email,
      paymentMethod,
      amount: Number(amount),
      currencyCode: 'EGP',
      language: lang === 'en' ? 'en-gb' : 'ar-eg',
      description: `Order ${order.orderNumber}`,
      paymentExpiry: expiresAt.getTime(),
      orderWebHookUrl: notificationUrl,
      chargeItems: [{
        itemId: String(order.orderNumber),
        description: `Order ${order.orderNumber}`,
        price: Number(amount),
        quantity: 1,
      }],
      signature: chargeSignature({
        merchantCode: config.merchantCode,
        merchantRefNum,
        paymentMethod,
        amount,
        secureKey: config.secureKey,
      }),
    },
  });

  if (!data?.referenceNumber) throw new AppError('Fawry did not return a reference number', 502);
  return {
    referenceNumber: String(data.referenceNumber),
    expiresAt: data.expirationTime ? new Date(Number(data.expirationTime)) : expiresAt,
  };
}

/** Pull the live status of a reference (Get Payment Status V2). */
export async function fetchFawryStatus(merchantRefNumber) {
  const config = getFawryConfig();
  const data = await fawryRequest('/ECommerceWeb/Fawry/payments/status/v2', {
    method: 'GET',
    query: {
      merchantCode: config.merchantCode,
      merchantRefNumber,
      signature: sha256(`${config.merchantCode}${merchantRefNumber}${config.secureKey}`),
    },
  });
  const status = data?.orderStatus || data?.paymentStatus;
  return {
    state: interpretFawryStatus(status),
    rawStatus: status,
    fawryRefNumber: data?.fawryRefNumber ? String(data.fawryRefNumber) : null,
    paymentAmount: Number(data?.paymentAmount ?? data?.orderAmount ?? 0),
  };
}

export async function refundFawryPayment(referenceNumber, amountEgp, reason = 'Customer refund') {
  const config = getFawryConfig();
  const refundAmount = fawryAmount(amountEgp);
  const data = await fawryRequest('/ECommerceWeb/Fawry/payments/refund', {
    body: {
      merchantCode: config.merchantCode,
      referenceNumber,
      refundAmount: Number(refundAmount),
      reason,
      signature: sha256(`${config.merchantCode}${referenceNumber}${refundAmount}${reason}${config.secureKey}`),
    },
  });
  return data?.referenceNumber ? String(data.referenceNumber) : referenceNumber;
}
