/**
 * Open API for outside systems (cashier/POS, ERP, the shop-PC agent).
 * Every handler runs as `req.integration` (the connection the API key belongs to).
 * Writes honour test mode / ?dryRun=true and the Idempotency-Key header.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import FulfillmentLocation from '../models/FulfillmentLocation.js';
import IntegrationConnection from '../models/IntegrationConnection.js';
import { AppError } from '../utils/AppError.js';
import { escapeRegex } from '../utils/escapeRegex.js';
import { applyStockReport, MAX_BATCH } from '../services/integrations/stockSync.service.js';
import { applyPriceReport } from '../services/integrations/priceSync.service.js';
import { importFile } from '../services/integrations/fileSync.service.js';
import { listOrderFeed, findOrderByRef, serializeOrders, acknowledgeOrder } from '../services/integrations/orderFeed.service.js';
import { recordSync, onceByKey } from '../services/integrations/syncLog.service.js';

const AGENT_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../integrations-agent/shop-agent.mjs');

const idempotencyKey = (req) => req.headers['idempotency-key'] || req.body?.idempotencyKey || null;

function readItems(req) {
  const items = Array.isArray(req.body) ? req.body : req.body?.items;
  if (!Array.isArray(items)) throw new AppError('Send { "items": [ … ] }', 400);
  if (items.length > MAX_BATCH) throw new AppError(`Send at most ${MAX_BATCH} items per call`, 400);
  return items;
}

function publicResult(result, { replayed = false, dryRun = false } = {}) {
  const { lines, parts, ...summary } = result || {};
  return {
    ...summary,
    dryRun,
    replayed: replayed || Boolean(result?.replayed),
    ...(dryRun && lines ? { preview: lines.slice(0, 200) } : {}),
  };
}

export async function ping(req, res) {
  const c = req.integration;
  res.json({
    success: true,
    data: { connection: c.name, connectionId: c._id, scopes: c.scopes, testMode: c.testMode, serverTime: new Date().toISOString() },
  });
}

export async function getLocations(req, res) {
  const locations = await FulfillmentLocation.find({ isActive: true }).select('name address isDefault').lean();
  const codes = new Map((req.integration.locationMap || []).map((m) => [String(m.location), m.externalCode]));
  res.json({
    success: true,
    data: locations.map((l) => ({ id: String(l._id), name: l.name, address: l.address, isDefault: l.isDefault, yourCode: codes.get(String(l._id)) || null })),
  });
}

async function runStockWrite(req, res, mode) {
  const items = readItems(req);
  const startedAt = Date.now();
  const key = idempotencyKey(req) || (mode === 'adjust' ? req.body?.reference : null);
  if (mode === 'adjust' && !key) {
    throw new AppError('Send a unique "reference" (e.g. the receipt number) so the same sale is never counted twice', 400);
  }
  const run = () => applyStockReport(req.integration, items, { mode, dryRun: req.dryRun });
  const result = req.dryRun ? await run() : await onceByKey(req.integration, key ? `stock:${mode}:${key}` : null, run);
  if (!result.replayed) {
    await recordSync(req.integration, { kind: 'stock', result, dryRun: req.dryRun, startedAt, message: mode === 'adjust' ? `Adjustment ${key}` : '' });
  }
  res.json({ success: true, data: publicResult(result, { dryRun: req.dryRun }) });
}

export const putStock = (req, res) => runStockWrite(req, res, 'set');
export const postStockAdjustments = (req, res) => runStockWrite(req, res, 'adjust');

export async function putPrices(req, res) {
  const items = readItems(req);
  const startedAt = Date.now();
  if (!req.integration.rules?.prices && !req.integration.rules?.costPrices) {
    throw new AppError('This connection is not allowed to change prices — turn it on in the store admin', 403);
  }
  const run = () => applyPriceReport(req.integration, items, { dryRun: req.dryRun });
  const key = idempotencyKey(req);
  const result = req.dryRun ? await run() : await onceByKey(req.integration, key ? `prices:${key}` : null, run);
  if (!result.replayed) await recordSync(req.integration, { kind: 'prices', result, dryRun: req.dryRun, startedAt });
  res.json({ success: true, data: publicResult(result, { dryRun: req.dryRun }) });
}

export async function postFile(req, res) {
  const startedAt = Date.now();
  const file = req.file?.buffer || (Buffer.isBuffer(req.body) && req.body.length ? req.body : null);
  if (!file) throw new AppError('Upload the file as multipart field "file" or as the raw request body', 400);
  const filename = req.file?.originalname || String(req.query.filename || req.headers['x-filename'] || '');
  let result;
  try {
    result = await importFile(req.integration, file, { filename, dryRun: req.dryRun });
  } catch (err) {
    throw new AppError(err.message, 400);
  }
  await recordSync(req.integration, { kind: 'file', result, dryRun: req.dryRun, startedAt, message: filename ? `File ${filename}` : 'File upload' });
  res.json({ success: true, data: publicResult(result, { dryRun: req.dryRun }) });
}

function serializeProduct(p, { includeCost }) {
  const variants = (p.variants || []).map((v) => ({
    id: String(v._id),
    name: [v.valueEn, v.valueAr].filter(Boolean).join(' / '),
    barcode: v.barcode || '',
    sku: v.sku || '',
    price: v.price ?? p.price,
    oldPrice: v.oldPrice ?? null,
    ...(includeCost ? { costPrice: v.wholesalePrice || 0 } : {}),
    stock: v.stock || 0,
    available: Math.max(0, (v.stock || 0) - (v.reservedStock || 0)),
  }));
  return {
    id: String(p._id),
    name: p.nameEn || p.nameAr,
    nameAr: p.nameAr,
    barcode: p.barcode || '',
    sku: p.sku || '',
    unit: p.unit || '',
    price: p.price,
    oldPrice: p.oldPrice ?? null,
    ...(includeCost ? { costPrice: p.wholesalePrice || 0 } : {}),
    stock: p.stock || 0,
    available: Math.max(0, (p.stock || 0) - (p.reservedStock || 0)),
    isActive: p.isActive !== false,
    variants,
    updatedAt: p.updatedAt,
  };
}

export async function getProducts(req, res) {
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const filter = { seller: null };
  if (req.query.updatedSince) {
    const at = new Date(req.query.updatedSince);
    if (Number.isNaN(at.getTime())) throw new AppError('updatedSince must be a date', 400);
    filter.updatedAt = { $gt: at };
  }
  if (req.query.code) {
    const code = new RegExp(`^${escapeRegex(String(req.query.code).trim())}$`, 'i');
    filter.$or = [{ barcode: code }, { sku: code }, { 'variants.barcode': code }, { 'variants.sku': code }];
  }
  const [products, total] = await Promise.all([
    Product.find(filter)
      .select('nameAr nameEn barcode sku unit price oldPrice wholesalePrice stock reservedStock isActive variants updatedAt')
      .sort({ updatedAt: 1, _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Product.countDocuments(filter),
  ]);
  const includeCost = req.integration.scopes.includes('prices:write');
  res.json({
    success: true,
    data: products.map((p) => serializeProduct(p, { includeCost })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}

export async function getOrders(req, res) {
  try {
    const feed = await listOrderFeed(req.query);
    res.json({ success: true, data: feed.orders, nextCursor: feed.nextCursor, hasMore: feed.hasMore });
  } catch (err) {
    throw new AppError(err.message, err.statusCode || 500);
  }
}

export async function getOrder(req, res) {
  const order = await findOrderByRef(req.params.ref);
  if (!order) throw new AppError('Order not found', 404);
  res.json({ success: true, data: (await serializeOrders([order]))[0] });
}

export async function postAcknowledge(req, res) {
  const result = await acknowledgeOrder(req.integration, req.params.ref, {
    externalReference: req.body?.externalReference,
    dryRun: req.dryRun,
  });
  if (!result.found) throw new AppError('Order not found', 404);
  if (!result.alreadyAcknowledged && !req.dryRun) {
    await recordSync(req.integration, {
      kind: 'orders',
      result: { received: 1, updated: 1 },
      message: `Order #${result.order.number} acknowledged${req.body?.externalReference ? ` as ${req.body.externalReference}` : ''}`,
    });
  }
  res.json({ success: true, data: { ...result.order, alreadyAcknowledged: result.alreadyAcknowledged, dryRun: req.dryRun } });
}

export async function postAgentHeartbeat(req, res) {
  const version = String(req.body?.version || '').slice(0, 20);
  const hostname = String(req.body?.hostname || '').slice(0, 80);
  await IntegrationConnection.updateOne(
    { _id: req.integration._id },
    { $set: { 'agent.version': version, 'agent.hostname': hostname, 'agent.lastSeenAt': new Date() } },
  );
  const latest = await latestAgentVersion();
  res.json({ success: true, data: { latestVersion: latest, updateAvailable: Boolean(latest && version && latest !== version) } });
}

export async function latestAgentVersion() {
  try {
    const text = await fs.readFile(AGENT_FILE, 'utf8');
    return /AGENT_VERSION\s*=\s*'([^']+)'/.exec(text)?.[1] || null;
  } catch {
    return null;
  }
}

export async function getAgentDownload(req, res) {
  try {
    const text = await fs.readFile(AGENT_FILE, 'utf8');
    res.type('text/javascript').set('Content-Disposition', 'attachment; filename="shop-agent.mjs"').send(text);
  } catch {
    throw new AppError('Agent file is not available on this server', 404);
  }
}

export function assertObjectId(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new AppError('Invalid id', 400);
}
