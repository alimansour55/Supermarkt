/**
 * Prices coming in from outside systems. Only applied when the connection is the
 * "boss" of prices (rules.prices) — cost prices separately (rules.costPrices).
 * Saved through the Product document so the discount/offer fields stay right.
 */
import Product from '../../models/Product.js';
import { getProductMatcher } from './productMatcher.js';
import { toNumber } from './stockSync.service.js';

const MONEY = (n) => Math.round(n * 100) / 100;

export async function applyPriceReport(connection, items, { dryRun = false } = {}) {
  const result = {
    received: Array.isArray(items) ? items.length : 0,
    updated: 0,
    unchanged: 0,
    unmatched: [],
    failed: [],
    ignored: [],
    lines: [],
  };
  if (!Array.isArray(items)) {
    result.failed.push({ code: '', message: 'items must be a list' });
    return result;
  }
  const allowPrice = connection?.rules?.prices !== false;
  const allowCost = connection?.rules?.costPrices === true;

  const matcher = await getProductMatcher();
  const changes = new Map(); // productId → [{ variantId, fields, code }]

  for (const raw of items) {
    const code = raw?.code ?? raw?.barcode ?? raw?.sku;
    if (code == null || String(code).trim() === '') {
      result.failed.push({ code: '', message: 'Missing barcode/sku' });
      continue;
    }
    const fields = {};
    const problems = [];
    if (raw.price !== undefined && raw.price !== null && raw.price !== '') {
      const price = toNumber(raw.price);
      if (Number.isNaN(price) || price <= 0) problems.push('price must be a number above 0');
      else if (allowPrice) fields.price = MONEY(price);
    }
    if (raw.oldPrice !== undefined && raw.oldPrice !== '') {
      const oldPrice = raw.oldPrice === null ? 0 : toNumber(raw.oldPrice);
      if (Number.isNaN(oldPrice) || oldPrice < 0) problems.push('oldPrice must be a number (0 or empty clears it)');
      else if (allowPrice) fields.oldPrice = oldPrice > 0 ? MONEY(oldPrice) : null;
    }
    const costRaw = raw.costPrice ?? raw.wholesalePrice;
    if (costRaw !== undefined && costRaw !== null && costRaw !== '') {
      const cost = toNumber(costRaw);
      if (Number.isNaN(cost) || cost < 0) problems.push('costPrice must be a number');
      else if (allowCost) fields.wholesalePrice = MONEY(cost);
    }
    if (problems.length) {
      result.failed.push({ code: String(code), message: problems.join('; ') });
      continue;
    }
    if (!Object.keys(fields).length) {
      result.ignored.push(String(code));
      continue;
    }
    const target = matcher.match(code);
    if (!target) { result.unmatched.push(String(code).trim()); continue; }
    if (target.ambiguous) {
      result.failed.push({ code: String(code), message: 'More than one product has this code — make it unique' });
      continue;
    }
    if (!changes.has(target.productId)) changes.set(target.productId, []);
    changes.get(target.productId).push({ variantId: target.variantId, fields, code: String(code).trim() });
  }

  if (!changes.size) return result;
  const products = await Product.find({ _id: { $in: [...changes.keys()] } });

  for (const product of products) {
    let dirty = false;
    for (const change of changes.get(String(product._id))) {
      const line = change.variantId ? product.variants.id(change.variantId) : product;
      if (!line) continue;
      const before = { price: line.price, oldPrice: line.oldPrice ?? null, wholesalePrice: line.wholesalePrice ?? 0 };
      const diff = Object.entries(change.fields).filter(([k, v]) => (before[k] ?? null) !== v);
      if (!diff.length) { result.unchanged += 1; continue; }
      // Never leave an "old price" at or below the new price — it would show a fake discount.
      const nextPrice = change.fields.price ?? line.price;
      const nextOld = change.fields.oldPrice !== undefined ? change.fields.oldPrice : line.oldPrice;
      if (nextOld && nextOld <= nextPrice) change.fields.oldPrice = null;

      result.updated += 1;
      result.lines.push({ code: change.code, productId: String(product._id), variantId: change.variantId, before, after: change.fields });
      if (!dryRun) {
        Object.assign(line, change.fields);
        dirty = true;
      }
    }
    // eslint-disable-next-line no-await-in-loop
    if (dirty) await product.save({ validateBeforeSave: false });
  }
  return result;
}
