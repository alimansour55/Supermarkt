/**
 * Runs "pull" connections (ready connectors and file links) and the integration
 * background loop: order change scanner, webhook deliveries and due pulls.
 */
import IntegrationConnection from '../../models/IntegrationConnection.js';
import { applyStockReport } from './stockSync.service.js';
import { applyPriceReport } from './priceSync.service.js';
import { pullFileFromUrl } from './fileSync.service.js';
import { getConnector, missingConnectorFields } from './connectors/index.js';
import { decryptJson } from './secrets.js';
import { recordSync } from './syncLog.service.js';
import { scanOrderChanges } from './orderScanner.service.js';
import { deliverDueWebhooks } from './webhooks.service.js';

const STALE_RUN_MS = 15 * 60 * 1000;
const TICK_MS = 30 * 1000;

function combine(parts) {
  const list = Object.values(parts).filter(Boolean);
  return {
    received: list.reduce((n, p) => n + (p.received || 0), 0),
    updated: list.reduce((n, p) => n + (p.updated || 0), 0),
    unchanged: list.reduce((n, p) => n + (p.unchanged || 0), 0),
    unmatched: [...new Set(list.flatMap((p) => p.unmatched || []))],
    failed: list.flatMap((p) => p.failed || []),
    parts,
  };
}

/** Pull from a ready connector and apply what came back. */
export async function runConnectorPull(connection, { dryRun = false } = {}) {
  const connector = getConnector(connection.connector?.key);
  if (!connector) throw new Error('Choose which system this connection is for');
  const config = decryptJson(connection.connector?.config);
  const missing = missingConnectorFields(connector, config);
  if (missing.length) throw new Error(`Missing: ${missing.join(', ')}`);

  const pulled = await connector.pull(config, { cursor: connection.connector?.cursor });
  const parts = {};
  if (connection.rules?.stock !== false && pulled.stock?.length) {
    parts.stock = await applyStockReport(connection, pulled.stock, { mode: 'set', dryRun });
  }
  if ((connection.rules?.prices || connection.rules?.costPrices) && pulled.prices?.length) {
    parts.prices = await applyPriceReport(connection, pulled.prices, { dryRun });
  }
  return combine(parts);
}

/** Claim, run and log one pull connection. Returns the log entry (or null if it was busy). */
export async function runConnectionNow(connectionId, { force = false } = {}) {
  const now = new Date();
  const connection = await IntegrationConnection.findOneAndUpdate(
    {
      _id: connectionId,
      $or: [{ runningSince: null }, { runningSince: { $lt: new Date(now.getTime() - STALE_RUN_MS) } }],
    },
    { $set: { runningSince: now } },
    { new: true },
  ).select('+connector.config');
  if (!connection) return null;

  const startedAt = Date.now();
  const dryRun = connection.testMode;
  let kind = connection.door === 'file' ? 'file' : 'connector';
  let log;
  try {
    let result;
    if (connection.door === 'file') {
      result = await pullFileFromUrl(connection, { force });
      if (result.skipped) {
        await IntegrationConnection.updateOne({ _id: connection._id }, { $set: { lastSyncAt: new Date() } });
        return { skipped: true, reason: result.reason };
      }
      if (!dryRun && result.hash) {
        await IntegrationConnection.updateOne({ _id: connection._id }, { $set: { 'file.lastFileHash': result.hash } });
      }
    } else if (connection.door === 'connector') {
      result = await runConnectorPull(connection, { dryRun });
    } else {
      kind = 'test';
      result = { received: 0, updated: 0, unchanged: 0, unmatched: [], failed: [], error: 'This connection does not pull data — the other system sends it' };
    }
    log = await recordSync(connection, { kind, result, dryRun, startedAt });
  } catch (err) {
    log = await recordSync(connection, { kind, result: { error: err.message || 'Sync failed' }, dryRun, startedAt });
  } finally {
    await IntegrationConnection.updateOne(
      { _id: connection._id },
      {
        $set: {
          runningSince: null,
          nextRunAt: new Date(Date.now() + (connection.syncIntervalMinutes || 5) * 60 * 1000),
        },
      },
    );
  }
  return log;
}

export async function runDuePulls(now = new Date()) {
  const due = await IntegrationConnection.find({
    status: 'active',
    $and: [
      { $or: [{ door: 'connector' }, { door: 'file', 'file.sourceUrl': { $nin: ['', null] } }] },
      { $or: [{ nextRunAt: null }, { nextRunAt: { $lte: now } }] },
    ],
  }).select('_id').limit(20).lean();
  for (const c of due) {
    // eslint-disable-next-line no-await-in-loop
    await runConnectionNow(c._id);
  }
  return due.length;
}

let timer = null;
let ticking = false;

export async function runIntegrationTick() {
  if (ticking) return;
  ticking = true;
  try {
    for (const [name, fn] of [['order scanner', scanOrderChanges], ['webhooks', deliverDueWebhooks], ['scheduled pulls', runDuePulls]]) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await fn();
      } catch (err) {
        console.error(`Integration job "${name}" failed:`, err.message);
      }
    }
  } finally {
    ticking = false;
  }
}

export function startIntegrationJobs() {
  if (timer || process.env.INTEGRATIONS_JOBS === 'off') return;
  timer = setInterval(() => { runIntegrationTick(); }, TICK_MS);
  timer.unref?.();
  setTimeout(() => { runIntegrationTick(); }, 15_000).unref?.();
}
