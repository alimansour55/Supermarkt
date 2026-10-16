/**
 * Sync log, unmatched-code tracking, failure alerts and idempotency for integrations.
 */
import IntegrationLog from '../../models/IntegrationLog.js';
import IntegrationEvent from '../../models/IntegrationEvent.js';
import IntegrationConnection from '../../models/IntegrationConnection.js';
import { getIntegrationSettings } from '../../models/IntegrationSettings.js';
import { createNotification } from '../notification.service.js';
import { sendEmail, getAdminEmails } from '../../emails/index.js';

const ALERT_EVERY_MS = 60 * 60 * 1000;
const MAX_UNMATCHED_KEPT = 200;

/** Turn a sync result into a log line + connection health fields. */
export async function recordSync(connection, { direction = 'in', kind, result, message = '', dryRun = false, startedAt }) {
  const unmatched = result?.unmatched || [];
  const failed = result?.failed || [];
  const counts = {
    received: result?.received || 0,
    updated: result?.updated || 0,
    unchanged: result?.unchanged || 0,
    unmatched: unmatched.length,
    failed: failed.length,
  };
  let status = 'ok';
  if (result?.error) status = 'error';
  else if (counts.failed || counts.unmatched) status = counts.updated || counts.unchanged ? 'partial' : 'error';

  const log = await IntegrationLog.create({
    connection: connection._id,
    direction,
    kind,
    status,
    message: message || result?.error || '',
    counts,
    unmatched: unmatched.slice(0, 100),
    problems: failed.slice(0, 50).map((f) => ({ code: f.code || '', message: f.message || String(f) })),
    dryRun,
    durationMs: startedAt ? Date.now() - startedAt : 0,
  });

  const now = new Date();
  const update = { $set: { lastSyncAt: now } };
  if (status === 'error') {
    update.$set.lastError = message || result?.error || failed[0]?.message || 'Sync failed';
    update.$set.lastErrorAt = now;
    update.$inc = { consecutiveFailures: 1 };
  } else {
    update.$set.lastSuccessAt = now;
    update.$set.consecutiveFailures = 0;
    update.$set.lastError = '';
  }
  await IntegrationConnection.updateOne({ _id: connection._id }, update);
  if (unmatched.length && !dryRun) await rememberUnmatched(connection._id, unmatched);

  if (status === 'error' && !dryRun) {
    await alertFailure(connection, update.$set.lastError);
  } else if (unmatched.length && !dryRun) {
    const settings = await getIntegrationSettings();
    if (settings.alertOnUnmatched) {
      await alertFailure(connection, `${unmatched.length} barcode(s) were not found on the website, e.g. ${unmatched.slice(0, 5).join(', ')}`, { quiet: true });
    }
  }
  return log;
}

export async function rememberUnmatched(connectionId, codes) {
  const conn = await IntegrationConnection.findById(connectionId).select('unmatchedCodes');
  if (!conn) return;
  const now = new Date();
  const map = new Map((conn.unmatchedCodes || []).map((u) => [u.code, { code: u.code, seenAt: u.seenAt, count: u.count || 1 }]));
  for (const code of new Set(codes)) {
    const prev = map.get(code);
    map.set(code, { code, seenAt: now, count: (prev?.count || 0) + 1 });
  }
  const list = [...map.values()].sort((a, b) => b.seenAt - a.seenAt).slice(0, MAX_UNMATCHED_KEPT);
  await IntegrationConnection.updateOne({ _id: connectionId }, { $set: { unmatchedCodes: list } });
}

/** Drop codes that now match a product (called after products are edited or on demand). */
export async function clearUnmatched(connectionId, codes = null) {
  if (!codes) {
    await IntegrationConnection.updateOne({ _id: connectionId }, { $set: { unmatchedCodes: [] } });
    return;
  }
  await IntegrationConnection.updateOne({ _id: connectionId }, { $pull: { unmatchedCodes: { code: { $in: codes } } } });
}

/** In-app notification + email, at most once an hour per connection. */
export async function alertFailure(connection, message, { quiet = false } = {}) {
  const fresh = await IntegrationConnection.findOneAndUpdate(
    {
      _id: connection._id,
      $or: [{ lastAlertAt: null }, { lastAlertAt: { $lt: new Date(Date.now() - ALERT_EVERY_MS) } }],
    },
    { $set: { lastAlertAt: new Date() } },
    { new: true },
  );
  if (!fresh) return false;

  try {
    await createNotification({
      type: 'integration_alert',
      titleAr: quiet ? `أكواد غير معروفة من ${connection.name}` : `مشكلة في الربط مع ${connection.name}`,
      titleEn: quiet ? `Unknown codes from ${connection.name}` : `Sync problem with ${connection.name}`,
      messageAr: message,
      messageEn: message,
      link: `/admin/integrations?connection=${connection._id}`,
      data: { connectionId: connection._id },
    });
  } catch (err) {
    console.error('Integration alert notification failed:', err.message);
  }

  try {
    const settings = await getIntegrationSettings();
    const to = settings.alertEmails?.length ? settings.alertEmails : await getAdminEmails();
    if (to.length) {
      const safe = String(message).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
      const name = String(connection.name).replace(/[<>&]/g, '');
      await sendEmail({
        to,
        subject: quiet ? `Unknown barcodes from ${name}` : `Sync problem: ${name}`,
        html: `<p>${quiet ? 'Some barcodes sent by' : 'The connection'} <strong>${name}</strong> ${quiet ? 'do not match any product.' : 'could not sync.'}</p><p>${safe}</p><p>Open Admin → Settings → Connected systems to see the log.</p>`,
        text: `${name}: ${message}`,
      });
    }
  } catch (err) {
    console.error('Integration alert email failed:', err.message);
  }
  return true;
}

/**
 * Run `fn` once per (connection, key). A repeat call returns the first result with
 * `replayed: true` instead of applying the update again. No key → always runs.
 */
export async function onceByKey(connection, key, fn) {
  if (!key) return fn();
  const cleanKey = String(key).slice(0, 200);
  const prior = await IntegrationEvent.findOne({ connection: connection._id, key: cleanKey }).lean();
  if (prior) return { ...(prior.result || {}), replayed: true };

  let claimed;
  try {
    claimed = await IntegrationEvent.create({ connection: connection._id, key: cleanKey, result: null });
  } catch (err) {
    if (err?.code === 11000) {
      const other = await IntegrationEvent.findOne({ connection: connection._id, key: cleanKey }).lean();
      return { ...(other?.result || { inProgress: true }), replayed: true };
    }
    throw err;
  }
  try {
    const result = await fn();
    const { lines, ...summary } = result || {};
    await IntegrationEvent.updateOne({ _id: claimed._id }, { $set: { result: summary } });
    return result;
  } catch (err) {
    await IntegrationEvent.deleteOne({ _id: claimed._id });
    throw err;
  }
}
