/**
 * Admin side of integrations: connections, keys, webhooks, file mapping, connectors,
 * logs and store-wide sync rules.
 */
import mongoose from 'mongoose';
import IntegrationConnection, { INTEGRATION_DOORS, INTEGRATION_SCOPES, WEBHOOK_EVENTS } from '../models/IntegrationConnection.js';
import IntegrationLog from '../models/IntegrationLog.js';
import WebhookDelivery from '../models/WebhookDelivery.js';
import LocationStock from '../models/LocationStock.js';
import FulfillmentLocation from '../models/FulfillmentLocation.js';
import Product from '../models/Product.js';
import { getIntegrationSettings, ONLINE_ORDER_HOLD_MODES } from '../models/IntegrationSettings.js';
import { AppError } from '../utils/AppError.js';
import { logAudit } from '../services/auditLog.service.js';
import { generateApiKey, generateWebhookSecret, encryptSecret, encryptJson, decryptJson } from '../services/integrations/secrets.js';
import { describeConnectors, getConnector, missingConnectorFields } from '../services/integrations/connectors/index.js';
import { assertSafeUrl, safeFetch } from '../services/integrations/outboundHttp.js';
import { previewFile, importFile, directDownloadUrl } from '../services/integrations/fileSync.service.js';
import { recordSync, clearUnmatched } from '../services/integrations/syncLog.service.js';
import { runConnectionNow, runConnectorPull } from '../services/integrations/runner.service.js';
import { sendTestWebhook, retryDelivery } from '../services/integrations/webhooks.service.js';
import { recomputeProductStock, computeWebsiteStock } from '../services/integrations/stockSync.service.js';
import { getProductMatcher, invalidateProductMatcher } from '../services/integrations/productMatcher.js';
import { latestAgentVersion } from './integrationApi.controller.js';

/** Sensible starting permissions for each door. */
const DEFAULT_SCOPES = {
  api: ['stock:write', 'products:read', 'orders:read', 'orders:write', 'locations:read'],
  webhook: ['orders:read', 'orders:write'],
  file: ['stock:write'],
  connector: [],
  agent: ['stock:write', 'prices:write', 'products:read', 'orders:read', 'orders:write', 'locations:read'],
};

function loadId(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new AppError('Invalid id', 400);
  return id;
}

async function findConnection(id, select = '') {
  const conn = await IntegrationConnection.findById(loadId(id)).select(select);
  if (!conn) throw new AppError('Connection not found', 404);
  return conn;
}

function health(c) {
  if (c.status === 'paused') return 'paused';
  if (c.consecutiveFailures > 0) return 'failing';
  if (c.unmatchedCodes?.length) return 'attention';
  if (!c.lastSyncAt && !c.apiKey?.lastUsedAt) return 'waiting';
  return 'ok';
}

function serializeConnection(c, { connectorConfig } = {}) {
  const obj = typeof c.toObject === 'function' ? c.toObject() : c;
  const connector = obj.connector?.key ? getConnector(obj.connector.key) : null;
  return {
    id: String(obj._id),
    name: obj.name,
    door: obj.door,
    status: obj.status,
    testMode: obj.testMode,
    health: health(obj),
    apiKey: obj.apiKey?.prefix ? {
      hint: `mpk_${obj.apiKey.prefix}_…${obj.apiKey.last4}`,
      createdAt: obj.apiKey.createdAt,
      lastUsedAt: obj.apiKey.lastUsedAt,
    } : null,
    scopes: obj.scopes || [],
    allowedIps: obj.allowedIps || [],
    rules: obj.rules,
    locationMap: (obj.locationMap || []).map((m) => ({ externalCode: m.externalCode, location: String(m.location) })),
    defaultLocation: obj.defaultLocation ? String(obj.defaultLocation) : null,
    webhook: {
      url: obj.webhook?.url || '',
      events: obj.webhook?.events || [],
      enabled: Boolean(obj.webhook?.enabled),
      hasSecret: Boolean(obj.webhook?.secret) || undefined,
    },
    file: {
      sourceUrl: obj.file?.sourceUrl || '',
      columns: obj.file?.columns || {},
      delimiter: obj.file?.delimiter || '',
    },
    connector: {
      key: obj.connector?.key || '',
      name: connector?.name || '',
      // Only non-secret values come back; password fields show as set/not set.
      config: connectorConfig && connector ? Object.fromEntries(connector.fields.map((f) => [
        f.key,
        f.type === 'password' ? (connectorConfig[f.key] ? '••••••••' : '') : (connectorConfig[f.key] ?? ''),
      ])) : undefined,
    },
    syncIntervalMinutes: obj.syncIntervalMinutes,
    nextRunAt: obj.nextRunAt,
    running: Boolean(obj.runningSince),
    lastSyncAt: obj.lastSyncAt,
    lastSuccessAt: obj.lastSuccessAt,
    lastError: obj.lastError,
    lastErrorAt: obj.lastErrorAt,
    consecutiveFailures: obj.consecutiveFailures,
    unmatchedCodes: obj.unmatchedCodes || [],
    agent: obj.agent,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
}

function serializeSettings(s) {
  return {
    stockBuffer: s.stockBuffer,
    onlineOrderHold: s.onlineOrderHold,
    holdSince: s.holdSince,
    onlineLocations: (s.onlineLocations || []).map(String),
    alertEmails: s.alertEmails || [],
    alertOnUnmatched: s.alertOnUnmatched,
  };
}

// ── Overview ──────────────────────────────────────────────────────────────────

export async function getOverview(req, res) {
  const [connections, settings, locations, pendingWebhooks, failedWebhooks, syncedProducts, agentVersion] = await Promise.all([
    IntegrationConnection.find().sort({ createdAt: -1 }).lean(),
    getIntegrationSettings(),
    FulfillmentLocation.find({ isActive: true }).select('name isDefault').sort({ isDefault: -1, name: 1 }).lean(),
    WebhookDelivery.countDocuments({ status: 'pending' }),
    WebhookDelivery.countDocuments({ status: 'failed', createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }),
    LocationStock.distinct('product').then((ids) => ids.length),
    latestAgentVersion(),
  ]);
  res.json({
    success: true,
    data: {
      connections: connections.map((c) => serializeConnection(c)),
      settings: serializeSettings(settings),
      locations: locations.map((l) => ({ id: String(l._id), name: l.name, isDefault: l.isDefault })),
      connectors: describeConnectors(),
      catalog: { doors: INTEGRATION_DOORS, scopes: INTEGRATION_SCOPES, webhookEvents: WEBHOOK_EVENTS, holdModes: ONLINE_ORDER_HOLD_MODES },
      stats: { pendingWebhooks, failedWebhooks, syncedProducts },
      agentVersion,
    },
  });
}

// ── Connections ───────────────────────────────────────────────────────────────

function cleanScopes(list) {
  return [...new Set((Array.isArray(list) ? list : []).filter((s) => INTEGRATION_SCOPES.includes(s)))];
}

export async function createConnection(req, res) {
  const { name, door } = req.body || {};
  if (!String(name || '').trim()) throw new AppError('Give the connection a name', 400);
  if (!INTEGRATION_DOORS.includes(door)) throw new AppError('Choose how the system connects', 400);

  const key = generateApiKey();
  const data = {
    name: String(name).trim().slice(0, 80),
    door,
    scopes: req.body.scopes ? cleanScopes(req.body.scopes) : DEFAULT_SCOPES[door],
    apiKey: { prefix: key.prefix, hash: key.hash, last4: key.last4, createdAt: new Date() },
    createdBy: req.user?._id,
    nextRunAt: new Date(),
  };
  let webhookSecret = null;
  if (door === 'webhook') {
    webhookSecret = generateWebhookSecret();
    data.webhook = { secret: encryptSecret(webhookSecret), events: ['order.created', 'order.cancelled'], enabled: false };
  }
  if (door === 'connector' && req.body.connectorKey) {
    if (!getConnector(req.body.connectorKey)) throw new AppError('Unknown system', 400);
    data.connector = { key: req.body.connectorKey };
    data.rules = { stock: true, prices: false, costPrices: false };
  }
  const conn = await IntegrationConnection.create(data);
  await logAudit({ req, action: 'integration.create', entityType: 'IntegrationConnection', entityId: conn._id, entityLabel: conn.name });
  res.status(201).json({
    success: true,
    data: { connection: serializeConnection(conn), apiKey: key.key, webhookSecret },
  });
}

export async function getConnection(req, res) {
  const conn = await findConnection(req.params.id, '+connector.config +webhook.secret');
  const config = decryptJson(conn.connector?.config);
  res.json({ success: true, data: serializeConnection(conn, { connectorConfig: config }) });
}

export async function updateConnection(req, res) {
  const conn = await findConnection(req.params.id, '+connector.config +webhook.secret');
  const body = req.body || {};

  if (body.name !== undefined) {
    if (!String(body.name).trim()) throw new AppError('Name cannot be empty', 400);
    conn.name = String(body.name).trim().slice(0, 80);
  }
  if (body.status !== undefined) {
    if (!['active', 'paused'].includes(body.status)) throw new AppError('Invalid status', 400);
    conn.status = body.status;
  }
  if (body.testMode !== undefined) conn.testMode = Boolean(body.testMode);
  if (body.scopes !== undefined) conn.scopes = cleanScopes(body.scopes);
  if (body.allowedIps !== undefined) {
    conn.allowedIps = (Array.isArray(body.allowedIps) ? body.allowedIps : String(body.allowedIps).split(/[\s,]+/))
      .map((s) => String(s).trim()).filter(Boolean).slice(0, 20);
  }
  if (body.rules) {
    for (const k of ['stock', 'prices', 'costPrices']) if (body.rules[k] !== undefined) conn.rules[k] = Boolean(body.rules[k]);
  }
  if (body.syncIntervalMinutes !== undefined) {
    const n = Math.round(Number(body.syncIntervalMinutes));
    if (!Number.isFinite(n) || n < 1 || n > 1440) throw new AppError('Sync interval must be 1–1440 minutes', 400);
    conn.syncIntervalMinutes = n;
    conn.nextRunAt = new Date();
  }

  if (body.locationMap !== undefined || body.defaultLocation !== undefined) {
    const active = new Set((await FulfillmentLocation.find({ isActive: true }).select('_id').lean()).map((l) => String(l._id)));
    if (body.locationMap !== undefined) {
      const seen = new Set();
      conn.locationMap = (Array.isArray(body.locationMap) ? body.locationMap : [])
        .map((m) => ({ externalCode: String(m.externalCode || '').trim(), location: String(m.location || '') }))
        .filter((m) => {
          if (!m.externalCode || !active.has(m.location) || seen.has(m.externalCode.toUpperCase())) return false;
          seen.add(m.externalCode.toUpperCase());
          return true;
        });
    }
    if (body.defaultLocation !== undefined) {
      conn.defaultLocation = body.defaultLocation && active.has(String(body.defaultLocation)) ? body.defaultLocation : null;
    }
  }

  if (body.webhook) {
    const w = body.webhook;
    if (w.url !== undefined) {
      const url = String(w.url || '').trim();
      if (url) {
        try { await assertSafeUrl(url); } catch (err) { throw new AppError(err.message, 400); }
      }
      conn.webhook.url = url;
    }
    if (w.events !== undefined) conn.webhook.events = (Array.isArray(w.events) ? w.events : []).filter((e) => WEBHOOK_EVENTS.includes(e));
    if (w.enabled !== undefined) {
      if (w.enabled && !conn.webhook.url) throw new AppError('Add the webhook address first', 400);
      conn.webhook.enabled = Boolean(w.enabled);
      if (conn.webhook.enabled && !conn.webhook.secret) conn.webhook.secret = encryptSecret(generateWebhookSecret());
    }
  }

  if (body.file) {
    const f = body.file;
    if (f.sourceUrl !== undefined) {
      const url = String(f.sourceUrl || '').trim();
      if (url) {
        try { await assertSafeUrl(directDownloadUrl(url)); } catch (err) { throw new AppError(err.message, 400); }
      }
      conn.file.sourceUrl = url;
      conn.file.lastFileHash = '';
      conn.nextRunAt = new Date();
    }
    if (f.columns) {
      for (const k of ['code', 'quantity', 'price', 'oldPrice', 'costPrice', 'location']) {
        if (f.columns[k] !== undefined) conn.file.columns[k] = String(f.columns[k] || '').trim();
      }
      conn.file.lastFileHash = '';
    }
    if (f.delimiter !== undefined) {
      if (!['', ',', ';', '\t', '|'].includes(f.delimiter)) throw new AppError('Unsupported separator', 400);
      conn.file.delimiter = f.delimiter;
    }
  }

  if (body.connector) {
    const key = body.connector.key ?? conn.connector.key;
    const connector = getConnector(key);
    if (key && !connector) throw new AppError('Unknown system', 400);
    if (key !== conn.connector.key) {
      conn.connector.key = key;
      conn.connector.config = '';
      conn.connector.cursor = null;
    }
    if (body.connector.config && connector) {
      const current = decryptJson(conn.connector.config);
      const next = { ...current };
      for (const field of connector.fields) {
        const value = body.connector.config[field.key];
        if (value === undefined) continue;
        // A masked password field means "keep what is saved".
        if (field.type === 'password' && (value === '••••••••' || value === '')) continue;
        next[field.key] = String(value).trim();
      }
      if (next.url) {
        try { await assertSafeUrl(next.url); } catch (err) { throw new AppError(err.message, 400); }
      }
      conn.connector.config = encryptJson(next);
    }
    conn.nextRunAt = new Date();
  }

  await conn.save();
  await logAudit({ req, action: 'integration.update', entityType: 'IntegrationConnection', entityId: conn._id, entityLabel: conn.name, changes: { fields: { from: null, to: Object.keys(body).join(', ') } } });
  res.json({ success: true, data: serializeConnection(conn, { connectorConfig: decryptJson(conn.connector?.config) }) });
}

export async function deleteConnection(req, res) {
  const conn = await findConnection(req.params.id);
  const products = await LocationStock.distinct('product', { connection: conn._id });
  await Promise.all([
    LocationStock.deleteMany({ connection: conn._id }),
    IntegrationLog.deleteMany({ connection: conn._id }),
    WebhookDelivery.deleteMany({ connection: conn._id }),
  ]);
  await conn.deleteOne();
  // Products still reported by other connections are rebuilt; the rest keep their last stock.
  if (products.length) await recomputeProductStock(products);
  await logAudit({ req, action: 'integration.delete', entityType: 'IntegrationConnection', entityId: conn._id, entityLabel: conn.name });
  res.json({ success: true, data: { deleted: true, releasedProducts: products.length } });
}

export async function rotateApiKey(req, res) {
  const conn = await findConnection(req.params.id);
  const key = generateApiKey();
  conn.apiKey = { prefix: key.prefix, hash: key.hash, last4: key.last4, createdAt: new Date(), lastUsedAt: null };
  await conn.save();
  await logAudit({ req, action: 'integration.rotate_key', entityType: 'IntegrationConnection', entityId: conn._id, entityLabel: conn.name });
  res.json({ success: true, data: { apiKey: key.key, connection: serializeConnection(conn) } });
}

export async function rotateWebhookSecret(req, res) {
  const conn = await findConnection(req.params.id, '+webhook.secret');
  const secret = generateWebhookSecret();
  conn.webhook.secret = encryptSecret(secret);
  await conn.save();
  await logAudit({ req, action: 'integration.rotate_webhook_secret', entityType: 'IntegrationConnection', entityId: conn._id, entityLabel: conn.name });
  res.json({ success: true, data: { webhookSecret: secret } });
}

// ── Test / run ────────────────────────────────────────────────────────────────

export async function testConnection(req, res) {
  const conn = await findConnection(req.params.id, '+connector.config +webhook.secret');
  const what = req.body?.what || conn.door;
  const startedAt = Date.now();
  let outcome;

  if (what === 'webhook') {
    if (!conn.webhook?.url) throw new AppError('Add the webhook address first', 400);
    outcome = await sendTestWebhook(conn);
  } else if (what === 'connector') {
    const connector = getConnector(conn.connector?.key);
    if (!connector) throw new AppError('Choose which system this connection is for', 400);
    const config = decryptJson(conn.connector?.config);
    const missing = missingConnectorFields(connector, config);
    if (missing.length) throw new AppError(`Fill in: ${missing.join(', ')}`, 400);
    try {
      const check = await connector.test(config);
      // Dry-run a full pull so the admin sees what would change before switching it on.
      const preview = await runConnectorPull(conn, { dryRun: true });
      outcome = {
        ok: true,
        message: check.message,
        locations: check.locations || [],
        preview: {
          received: preview.received,
          wouldUpdate: preview.updated,
          unchanged: preview.unchanged,
          unmatched: preview.unmatched.slice(0, 50),
          unmatchedCount: preview.unmatched.length,
          failed: preview.failed.slice(0, 20),
        },
      };
    } catch (err) {
      outcome = { ok: false, message: err.message };
    }
  } else if (what === 'file') {
    if (!conn.file?.sourceUrl) throw new AppError('Add a file link, or upload a file below', 400);
    try {
      const fileRes = await safeFetch(directDownloadUrl(conn.file.sourceUrl), { timeoutMs: 30000 });
      if (!fileRes.ok) throw new Error(`Could not download the file (HTTP ${fileRes.status})`);
      const isXlsx = fileRes.buffer.length >= 4 && fileRes.buffer.readUInt32LE(0) === 0x04034b50;
      const preview = previewFile(fileRes.buffer, { filename: isXlsx ? 'link.xlsx' : 'link.csv', delimiter: conn.file.delimiter });
      outcome = { ok: true, message: `File read — ${preview.rowCount} row(s)`, file: preview };
    } catch (err) {
      outcome = { ok: false, message: err.message };
    }
  } else {
    outcome = {
      ok: Boolean(conn.apiKey?.lastUsedAt),
      message: conn.apiKey?.lastUsedAt
        ? `The other system last called us ${conn.apiKey.lastUsedAt.toISOString()}`
        : 'Waiting for the other system to make its first call with this key',
    };
  }

  await IntegrationLog.create({
    connection: conn._id,
    direction: 'out',
    kind: 'test',
    status: outcome.ok ? 'ok' : 'error',
    message: `Test (${what}): ${outcome.message}`,
    durationMs: Date.now() - startedAt,
  });
  res.json({ success: true, data: outcome });
}

export async function runConnection(req, res) {
  const conn = await findConnection(req.params.id);
  if (!['connector', 'file'].includes(conn.door)) throw new AppError('Only pull connections can be run from here', 400);
  const log = await runConnectionNow(conn._id, { force: true });
  if (!log) throw new AppError('A sync is already running — try again in a minute', 409);
  res.json({ success: true, data: log });
}

// ── File door ─────────────────────────────────────────────────────────────────

export async function previewUpload(req, res) {
  await findConnection(req.params.id);
  if (!req.file?.buffer) throw new AppError('Choose a file', 400);
  try {
    res.json({ success: true, data: previewFile(req.file.buffer, { filename: req.file.originalname }) });
  } catch (err) {
    throw new AppError(err.message, 400);
  }
}

export async function importUpload(req, res) {
  const conn = await findConnection(req.params.id);
  if (!req.file?.buffer) throw new AppError('Choose a file', 400);
  const dryRun = conn.testMode || String(req.body?.dryRun) === 'true';
  let columns;
  if (req.body?.columns) {
    try { columns = JSON.parse(req.body.columns); } catch { throw new AppError('Invalid column mapping', 400); }
  }
  const startedAt = Date.now();
  let result;
  try {
    result = await importFile(conn, req.file.buffer, { filename: req.file.originalname, dryRun, columns });
  } catch (err) {
    throw new AppError(err.message, 400);
  }
  const log = await recordSync(conn, { kind: 'file', result, dryRun, startedAt, message: `Uploaded ${req.file.originalname}` });
  res.json({
    success: true,
    data: {
      log,
      dryRun,
      preview: dryRun ? [
        ...(result.parts.stock?.lines || []).map((l) => ({ ...l, field: 'stock' })),
        ...(result.parts.prices?.lines || []).map((l) => ({ ...l, field: 'prices' })),
      ].slice(0, 200) : undefined,
    },
  });
}

// ── Logs, deliveries, unmatched ───────────────────────────────────────────────

export async function getLogs(req, res) {
  const conn = await findConnection(req.params.id);
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const filter = { connection: conn._id };
  if (req.query.status) filter.status = req.query.status;
  const logs = await IntegrationLog.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
  res.json({ success: true, data: logs });
}

export async function getDeliveries(req, res) {
  const conn = await findConnection(req.params.id);
  const filter = { connection: conn._id };
  if (req.query.status) filter.status = req.query.status;
  const rows = await WebhookDelivery.find(filter).sort({ createdAt: -1 }).limit(100).select('-payload.data').lean();
  res.json({ success: true, data: rows });
}

export async function postRetryDelivery(req, res) {
  const row = await retryDelivery(loadId(req.params.deliveryId));
  if (!row) throw new AppError('Delivery not found or already delivered', 404);
  res.json({ success: true, data: row });
}

export async function deleteUnmatched(req, res) {
  const conn = await findConnection(req.params.id);
  invalidateProductMatcher();
  const codes = Array.isArray(req.body?.codes) ? req.body.codes : null;
  if (!codes) {
    // Keep only codes that still don't match anything.
    const matcher = await getProductMatcher({ fresh: true });
    const still = (conn.unmatchedCodes || []).filter((u) => !matcher.match(u.code));
    await IntegrationConnection.updateOne({ _id: conn._id }, { $set: { unmatchedCodes: still } });
    return res.json({ success: true, data: { remaining: still.length } });
  }
  await clearUnmatched(conn._id, codes);
  res.json({ success: true, data: { removed: codes.length } });
}

// ── Settings & stock view ─────────────────────────────────────────────────────

let recomputeRunning = false;
async function recomputeAllInBackground() {
  if (recomputeRunning) return;
  recomputeRunning = true;
  try {
    const ids = (await LocationStock.distinct('product')).map(String);
    for (let i = 0; i < ids.length; i += 200) {
      // eslint-disable-next-line no-await-in-loop
      await recomputeProductStock(ids.slice(i, i + 200));
    }
  } catch (err) {
    console.error('Integration stock rebuild failed:', err.message);
  } finally {
    recomputeRunning = false;
  }
}

export async function updateSettings(req, res) {
  const settings = await getIntegrationSettings();
  const body = req.body || {};
  if (body.stockBuffer !== undefined) {
    const n = Math.round(Number(body.stockBuffer));
    if (!Number.isFinite(n) || n < 0 || n > 1000) throw new AppError('Safety buffer must be 0–1000', 400);
    settings.stockBuffer = n;
  }
  if (body.onlineOrderHold !== undefined) {
    if (!ONLINE_ORDER_HOLD_MODES.includes(body.onlineOrderHold)) throw new AppError('Invalid hold mode', 400);
    if (body.onlineOrderHold !== settings.onlineOrderHold) {
      settings.onlineOrderHold = body.onlineOrderHold;
      settings.holdSince = new Date();
    }
  }
  if (body.onlineLocations !== undefined) {
    const active = new Set((await FulfillmentLocation.find({ isActive: true }).select('_id').lean()).map((l) => String(l._id)));
    settings.onlineLocations = (Array.isArray(body.onlineLocations) ? body.onlineLocations : []).map(String).filter((id) => active.has(id));
  }
  if (body.alertEmails !== undefined) {
    const list = (Array.isArray(body.alertEmails) ? body.alertEmails : String(body.alertEmails).split(/[\s,;]+/))
      .map((e) => String(e).trim().toLowerCase()).filter(Boolean);
    const bad = list.find((e) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    if (bad) throw new AppError(`"${bad}" is not an email address`, 400);
    settings.alertEmails = list.slice(0, 10);
  }
  if (body.alertOnUnmatched !== undefined) settings.alertOnUnmatched = Boolean(body.alertOnUnmatched);
  await settings.save();
  await logAudit({ req, action: 'integration.settings', entityType: 'IntegrationSettings', entityId: settings._id, entityLabel: 'Sync rules' });
  recomputeAllInBackground();
  res.json({ success: true, data: serializeSettings(settings) });
}

export async function rebuildStock(req, res) {
  recomputeAllInBackground();
  res.json({ success: true, data: { started: true } });
}

/** Where a product's website stock comes from — branch by branch. */
export async function getProductStockBreakdown(req, res) {
  const productId = loadId(req.params.productId);
  const product = await Product.findById(productId).select('nameAr nameEn stock variants._id variants.valueEn variants.valueAr variants.stock').lean();
  if (!product) throw new AppError('Product not found', 404);
  const settings = await getIntegrationSettings();
  const [rows, lines] = await Promise.all([
    LocationStock.find({ product: productId }).populate('location', 'name').populate('connection', 'name').lean(),
    computeWebsiteStock([productId], { settings }),
  ]);
  res.json({
    success: true,
    data: {
      synced: rows.length > 0,
      buffer: settings.stockBuffer,
      holdMode: settings.onlineOrderHold,
      branches: rows.map((r) => ({
        variantId: r.variantId ? String(r.variantId) : null,
        location: r.location?.name || '—',
        locationId: r.location?._id ? String(r.location._id) : null,
        quantity: r.quantity,
        connection: r.connection?.name || '—',
        reportedAt: r.reportedAt,
      })),
      lines: [...lines.values()],
    },
  });
}

// ── Shop-PC agent files ───────────────────────────────────────────────────────

const AGENT_FILES = {
  'shop-agent.mjs': 'text/javascript',
  'install-windows.ps1': 'text/plain',
  'config.example.json': 'application/json',
  'README.md': 'text/markdown',
};

export async function downloadAgentFile(req, res) {
  const name = req.params.file;
  if (!AGENT_FILES[name]) throw new AppError('Unknown file', 404);
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../integrations-agent');
  try {
    const content = await fs.readFile(path.join(dir, name));
    res.type(AGENT_FILES[name]).set('Content-Disposition', `attachment; filename="${name}"`).send(content);
  } catch {
    throw new AppError('File not available on this server', 404);
  }
}
