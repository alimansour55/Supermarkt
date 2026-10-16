/**
 * Webhooks: we tell outside systems when something happens to an online order.
 *
 * Every event is stored first (WebhookDelivery) and sent by the scheduler, so a slow or
 * offline receiver never slows the shop down. Each request is signed:
 *   X-MarketPlus-Signature: sha256=HMAC_SHA256(secret, `${X-MarketPlus-Timestamp}.${rawBody}`)
 * Failed deliveries are retried with growing gaps for about two days, then marked failed
 * (and an admin alert goes out). Receivers must treat X-MarketPlus-Event-Id as unique.
 */
import crypto from 'node:crypto';
import IntegrationConnection from '../../models/IntegrationConnection.js';
import WebhookDelivery from '../../models/WebhookDelivery.js';
import IntegrationLog from '../../models/IntegrationLog.js';
import { decryptSecret, signWebhook } from './secrets.js';
import { safeFetch } from './outboundHttp.js';
import { alertFailure } from './syncLog.service.js';

/** Minutes to wait after attempt N fails. */
export const RETRY_MINUTES = [1, 5, 30, 120, 360, 720, 1440];
const MAX_ATTEMPTS = RETRY_MINUTES.length + 1;
const BATCH = 50;

export function buildEnvelope(event, eventId, data) {
  return { id: eventId, event, createdAt: new Date().toISOString(), data };
}

/** Store one event for every active connection that listens to it. */
export async function enqueueWebhookEvent(event, eventId, data) {
  const listeners = await IntegrationConnection.find({
    status: 'active',
    testMode: false,
    'webhook.enabled': true,
    'webhook.events': event,
  }).select('_id').lean();
  if (!listeners.length) return 0;

  const payload = buildEnvelope(event, eventId, data);
  let queued = 0;
  for (const conn of listeners) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await WebhookDelivery.create({ connection: conn._id, eventId, event, payload });
      queued += 1;
    } catch (err) {
      if (err?.code !== 11000) throw err; // already queued — the scanner saw this change before
    }
  }
  return queued;
}

async function postWebhook(connection, delivery) {
  const secret = decryptSecret(connection.webhook?.secret);
  const body = JSON.stringify(delivery.payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'MarketPlus-Webhooks/1.0',
    'X-MarketPlus-Event': delivery.event,
    'X-MarketPlus-Event-Id': delivery.eventId,
    'X-MarketPlus-Timestamp': timestamp,
    'X-MarketPlus-Delivery-Attempt': String((delivery.attempts || 0) + 1),
  };
  if (secret) headers['X-MarketPlus-Signature'] = `sha256=${signWebhook(secret, timestamp, body)}`;
  return safeFetch(connection.webhook.url, { method: 'POST', headers, body, timeoutMs: 10000, maxBytes: 64 * 1024 });
}

async function attemptDelivery(delivery) {
  const connection = await IntegrationConnection.findById(delivery.connection).select('+webhook.secret');
  if (!connection || connection.status !== 'active' || !connection.webhook?.enabled || !connection.webhook?.url) {
    await WebhookDelivery.updateOne({ _id: delivery._id }, {
      $set: { status: 'failed', lastError: 'Webhook is switched off for this connection', lockedUntil: null },
    });
    return false;
  }
  const attempts = (delivery.attempts || 0) + 1;
  let statusCode = null;
  let error = '';
  try {
    const res = await postWebhook(connection, delivery);
    statusCode = res.status;
    if (!res.ok) error = `Receiver answered HTTP ${res.status}`;
  } catch (err) {
    error = err.message || 'Request failed';
  }

  if (!error) {
    await WebhookDelivery.updateOne({ _id: delivery._id }, {
      $set: { status: 'delivered', attempts, lastStatusCode: statusCode, lastError: '', deliveredAt: new Date(), lockedUntil: null },
    });
    return true;
  }

  const giveUp = attempts >= MAX_ATTEMPTS;
  const next = new Date(Date.now() + (RETRY_MINUTES[attempts - 1] || 1440) * 60 * 1000);
  await WebhookDelivery.updateOne({ _id: delivery._id }, {
    $set: {
      status: giveUp ? 'failed' : 'pending',
      attempts,
      lastStatusCode: statusCode,
      lastError: error,
      nextAttemptAt: giveUp ? delivery.nextAttemptAt : next,
      lockedUntil: null,
    },
  });
  if (giveUp || attempts === 3) {
    await IntegrationLog.create({
      connection: connection._id,
      direction: 'out',
      kind: 'webhook',
      status: 'error',
      message: `${delivery.event} (${delivery.eventId}) ${giveUp ? 'gave up after' : 'still failing after'} ${attempts} attempts: ${error}`,
    });
    await alertFailure(connection, `Webhook ${delivery.event} could not be delivered: ${error}`);
  }
  return false;
}

/** Send whatever is due. Each delivery is claimed first so two servers never send it twice. */
export async function deliverDueWebhooks(now = new Date()) {
  let sent = 0;
  for (let i = 0; i < BATCH; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const delivery = await WebhookDelivery.findOneAndUpdate(
      {
        status: 'pending',
        nextAttemptAt: { $lte: now },
        $or: [{ lockedUntil: null }, { lockedUntil: { $lt: now } }],
      },
      { $set: { lockedUntil: new Date(now.getTime() + 60 * 1000) } },
      { sort: { nextAttemptAt: 1 }, new: true },
    ).lean();
    if (!delivery) break;
    // eslint-disable-next-line no-await-in-loop
    if (await attemptDelivery(delivery)) sent += 1;
  }
  return sent;
}

/** Retry a failed (or pending) delivery right away. */
export async function retryDelivery(deliveryId) {
  const delivery = await WebhookDelivery.findOneAndUpdate(
    { _id: deliveryId, status: { $in: ['failed', 'pending'] } },
    { $set: { status: 'pending', nextAttemptAt: new Date(), lockedUntil: new Date(Date.now() + 60 * 1000) } },
    { new: true },
  ).lean();
  if (!delivery) return null;
  await attemptDelivery(delivery);
  return WebhookDelivery.findById(deliveryId).lean();
}

/** "Send test" button: a signed ping, sent now, not stored. */
export async function sendTestWebhook(connection) {
  const eventId = `ping:${crypto.randomUUID()}`;
  const delivery = {
    event: 'ping',
    eventId,
    attempts: 0,
    payload: buildEnvelope('ping', eventId, { message: 'Test from MarketPlus — your webhook works.', connectionId: String(connection._id) }),
  };
  try {
    const res = await postWebhook(connection, delivery);
    return { ok: res.ok, status: res.status, message: res.ok ? 'Delivered' : `Receiver answered HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, status: null, message: err.message };
  }
}
