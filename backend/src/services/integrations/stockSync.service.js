/**
 * Stock coming in from outside systems.
 *
 * Outside systems report stock per branch (LocationStock). The stock the website sells is
 * rebuilt from those rows, never written directly:
 *
 *   website stock = Σ reported stock at branches sold online
 *                   − safety buffer
 *                   − items of online orders still "on hold" (sold online, not yet out of the outside system)
 *
 * Products nobody reports stock for are never touched. Because the number is always rebuilt
 * from the same inputs, applying the same report twice gives the same result.
 */
import mongoose from 'mongoose';
import Product from '../../models/Product.js';
import Order from '../../models/Order.js';
import LocationStock from '../../models/LocationStock.js';
import FulfillmentLocation from '../../models/FulfillmentLocation.js';
import { getIntegrationSettings } from '../../models/IntegrationSettings.js';
import { checkInventoryAlert } from '../inventoryAlert.service.js';
import { getProductMatcher } from './productMatcher.js';

const HOLD_WINDOW_DAYS = 30;
const OPEN_STATUSES = ['pending', 'confirmed', 'preparing', 'out_for_delivery'];
const NOT_HELD_FOR_ACK = ['cancelled', 'delivery_failed', 'returned'];
export const MAX_BATCH = 5000;

const lineKey = (productId, variantId) => `${productId}:${variantId || ''}`;

/** Numbers as cashier systems send them: "1,250.5", "١٢٥", "12٫5", " 7 ". */
function toNumber(value) {
  if (value === null || value === undefined || value === '') return NaN;
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  const text = String(value)
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06F0))
    .replace(/٫/g, '.')
    .replace(/[,٬\s]/g, '');
  if (!text) return NaN;
  const n = Number(text);
  return Number.isFinite(n) ? n : NaN;
}

const STORE_WIDE = '';

/** Branches resolver for one connection: external code / our id / default. */
export async function buildLocationResolver(connection) {
  const locations = await FulfillmentLocation.find({ isActive: true }).select('_id name isDefault').lean();
  const byId = new Map(locations.map((l) => [String(l._id), l]));
  const byCode = new Map(
    (connection?.locationMap || [])
      .filter((m) => byId.has(String(m.location)))
      .map((m) => [String(m.externalCode).trim().toUpperCase(), String(m.location)]),
  );
  const fallback = (connection?.defaultLocation && byId.has(String(connection.defaultLocation)))
    ? String(connection.defaultLocation)
    : String((locations.find((l) => l.isDefault) || locations[0])?._id || '');

  return {
    hasAny: locations.length > 0,
    /** → branch id, '' for "the whole store" (no branches set up), or null for an unknown branch code. */
    resolve(code) {
      if (!locations.length) return STORE_WIDE;
      const raw = code == null ? '' : String(code).trim();
      if (!raw) return fallback;
      const mapped = byCode.get(raw.toUpperCase());
      if (mapped) return mapped;
      if (byId.has(raw)) return raw;
      return null;
    },
  };
}

/** Quantities of online orders still on hold, per product line. */
export async function heldOnlineQuantities(productIds, settings, now = new Date()) {
  const mode = settings?.onlineOrderHold || 'until_delivered';
  if (mode === 'none' || !productIds.length) return new Map();

  const windowStart = new Date(now.getTime() - HOLD_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const since = settings?.holdSince && settings.holdSince > windowStart ? settings.holdSince : windowStart;
  const ids = productIds.map((id) => new mongoose.Types.ObjectId(String(id)));

  const match = {
    createdAt: { $gte: since },
    'items.product': { $in: ids },
    $or: [{ 'trash.stage': { $exists: false } }, { 'trash.stage': 'none' }],
    orderStatus: mode === 'ack' ? { $nin: NOT_HELD_FOR_ACK } : { $in: OPEN_STATUSES },
  };

  const pipeline = [{ $match: match }];
  if (mode === 'ack') {
    pipeline.push(
      { $lookup: { from: 'integrationorderstates', localField: '_id', foreignField: 'order', as: 'integrationState' } },
      { $match: { 'integrationState.acknowledgedAt': { $not: { $type: 'date' } } } },
    );
  }
  pipeline.push(
    { $unwind: '$items' },
    { $match: { 'items.product': { $in: ids } } },
    { $group: { _id: { p: '$items.product', v: '$items.variantId' }, qty: { $sum: '$items.quantity' } } },
  );

  const rows = await Order.aggregate(pipeline);
  return new Map(rows.map((r) => [lineKey(r._id.p, r._id.v), r.qty]));
}

async function onlineLocationIds(settings) {
  const active = await FulfillmentLocation.find({ isActive: true }).select('_id').lean();
  const activeIds = active.map((l) => String(l._id));
  const chosen = (settings?.onlineLocations || []).map(String).filter((id) => activeIds.includes(id));
  return chosen.length ? chosen : activeIds;
}

/**
 * Work out the website stock of every synced line of these products.
 * → Map lineKey → { productId, variantId, stock, reported, held }
 */
export async function computeWebsiteStock(productIds, { settings } = {}) {
  const s = settings || await getIntegrationSettings();
  const ids = [...new Set(productIds.map(String))];
  if (!ids.length) return new Map();

  const [rows, online, held] = await Promise.all([
    LocationStock.find({ product: { $in: ids } }).lean(),
    onlineLocationIds(s),
    heldOnlineQuantities(ids, s),
  ]);

  const out = new Map();
  for (const row of rows) {
    const key = lineKey(row.product, row.variantId);
    if (!out.has(key)) {
      out.set(key, { productId: String(row.product), variantId: row.variantId ? String(row.variantId) : null, reported: 0 });
    }
    if (!row.location || online.includes(String(row.location))) {
      out.get(key).reported += Math.max(0, Math.floor(row.quantity || 0));
    }
  }
  for (const [key, line] of out) {
    line.held = held.get(key) || 0;
    line.stock = Math.max(0, line.reported - (s.stockBuffer || 0) - line.held);
  }
  return out;
}

/** Write the rebuilt stock onto products; returns how many lines changed. */
export async function recomputeProductStock(productIds, { settings } = {}) {
  const lines = await computeWebsiteStock(productIds, { settings });
  if (!lines.size) return 0;

  const products = await Product.find({ _id: { $in: [...new Set([...lines.values()].map((l) => l.productId))] } })
    .select('_id stock variants._id variants.stock isActive nameAr nameEn slug')
    .lean();
  const byId = new Map(products.map((p) => [String(p._id), p]));
  const now = new Date();
  let changed = 0;

  for (const line of lines.values()) {
    const product = byId.get(line.productId);
    if (!product) continue;
    if (line.variantId) {
      const variant = (product.variants || []).find((v) => String(v._id) === line.variantId);
      if (!variant || (variant.stock || 0) === line.stock) continue;
      // eslint-disable-next-line no-await-in-loop
      await Product.updateOne(
        { _id: product._id, 'variants._id': variant._id },
        { $set: { 'variants.$.stock': line.stock, stockUpdatedAt: now } },
      );
      changed += 1;
    } else {
      const previous = product.stock || 0;
      if (previous === line.stock) continue;
      // eslint-disable-next-line no-await-in-loop
      await Product.updateOne(
        { _id: product._id },
        {
          $set: { stock: line.stock, stockUpdatedAt: now },
          $push: { stockHistory: { $each: [{ previousStock: previous, stock: line.stock, changedAt: now }], $position: 0, $slice: 20 } },
        },
      );
      changed += 1;
      // eslint-disable-next-line no-await-in-loop
      await checkInventoryAlert({ ...product, stock: line.stock }, previous);
    }
  }
  return changed;
}

/** Products that have at least one reported stock row (so their stock is owned by an outside system). */
export async function filterSyncedProducts(productIds) {
  if (!productIds.length) return [];
  const ids = await LocationStock.distinct('product', { product: { $in: productIds } });
  return ids.map(String);
}

/**
 * Apply a stock report from an outside system.
 *
 * items: [{ code, quantity }]   mode 'set'    — "this is how many we have now"
 *        [{ code, change }]     mode 'adjust' — "this many were sold (-) / received (+)"
 * Each item may name a `location` (the outside system's branch code, or our branch id).
 */
export async function applyStockReport(connection, items, { mode = 'set', dryRun = false } = {}) {
  const result = {
    received: Array.isArray(items) ? items.length : 0,
    updated: 0,
    unchanged: 0,
    unmatched: [],
    failed: [],
    lines: [],
  };
  if (!Array.isArray(items)) {
    result.failed.push({ code: '', message: 'items must be a list' });
    return result;
  }

  const matcher = await getProductMatcher();
  const locations = await buildLocationResolver(connection);

  // Merge the batch first: last report wins for "set", changes add up for "adjust".
  const merged = new Map();
  for (const raw of items) {
    const code = raw?.code ?? raw?.barcode ?? raw?.sku;
    const value = toNumber(mode === 'adjust' ? (raw?.change ?? raw?.quantity) : raw?.quantity);
    if (code == null || String(code).trim() === '') {
      result.failed.push({ code: '', message: 'Missing barcode/sku' });
      continue;
    }
    if (Number.isNaN(value)) {
      result.failed.push({ code: String(code), message: mode === 'adjust' ? 'change must be a number' : 'quantity must be a number' });
      continue;
    }
    const target = matcher.match(code);
    if (!target) {
      result.unmatched.push(String(code).trim());
      continue;
    }
    if (target.ambiguous) {
      result.failed.push({ code: String(code), message: 'More than one product has this code — make it unique' });
      continue;
    }
    const location = locations.resolve(raw?.location);
    if (location === null) {
      result.failed.push({ code: String(code), message: `Unknown branch "${raw.location}" — map it on the connection page` });
      continue;
    }
    const key = `${lineKey(target.productId, target.variantId)}@${location}`;
    const prev = merged.get(key);
    merged.set(key, {
      ...target,
      code: String(code).trim(),
      location,
      value: mode === 'adjust' && prev ? prev.value + value : value,
    });
  }

  const entries = [...merged.values()];
  const existing = await LocationStock.find({
    product: { $in: [...new Set(entries.map((e) => e.productId))] },
  }).lean();
  const existingByKey = new Map(existing.map((r) => [`${lineKey(r.product, r.variantId)}@${r.location || STORE_WIDE}`, r]));

  // A product's first report through "adjust" starts from what the website has today.
  const needsSeed = mode === 'adjust'
    ? entries.filter((e) => !existing.some((r) => String(r.product) === e.productId && String(r.variantId || '') === String(e.variantId || '')))
    : [];
  const seedStock = new Map();
  if (needsSeed.length) {
    const seedProducts = await Product.find({ _id: { $in: needsSeed.map((e) => e.productId) } })
      .select('_id stock variants._id variants.stock').lean();
    for (const p of seedProducts) {
      seedStock.set(lineKey(p._id, null), p.stock || 0);
      for (const v of p.variants || []) seedStock.set(lineKey(p._id, v._id), v.stock || 0);
    }
  }

  const now = new Date();
  for (const e of entries) {
    const key = `${lineKey(e.productId, e.variantId)}@${e.location}`;
    const before = existingByKey.get(key)?.quantity;
    const base = before ?? (mode === 'adjust' ? (seedStock.get(lineKey(e.productId, e.variantId)) ?? 0) : 0);
    const after = mode === 'adjust' ? base + e.value : e.value;
    const changed = before === undefined || before !== after;
    result.lines.push({ code: e.code, productId: e.productId, variantId: e.variantId, location: e.location || null, before: before ?? null, after });
    if (!changed) {
      result.unchanged += 1;
      continue;
    }
    result.updated += 1;
    if (dryRun) continue;
    const filter = { product: e.productId, variantId: e.variantId || null, location: e.location || null };
    // eslint-disable-next-line no-await-in-loop
    await LocationStock.updateOne(
      filter,
      mode === 'adjust' && before !== undefined
        ? { $inc: { quantity: e.value }, $set: { connection: connection?._id || null, reportedAt: now } }
        : { $set: { quantity: after, connection: connection?._id || null, reportedAt: now } },
      { upsert: true },
    );
    if (e.location) {
      // The store has branches now: a store-wide row from before would be counted twice.
      // eslint-disable-next-line no-await-in-loop
      await LocationStock.deleteMany({ product: e.productId, variantId: e.variantId || null, location: null });
    }
  }

  if (!dryRun && result.updated) {
    await recomputeProductStock([...new Set(entries.map((e) => e.productId))]);
  }
  return result;
}

export { toNumber, lineKey };
