/**
 * Finds the store product (or variant) an outside system means by a barcode or SKU.
 *
 * Codes are compared trimmed, without inner spaces and case-insensitively. Spreadsheet
 * programs often drop leading zeros from barcodes, so a code that only matches once both
 * sides lose their leading zeros still matches — unless that is ambiguous.
 * Only store-owned products are matched; marketplace seller listings are never synced.
 */
import Product from '../../models/Product.js';

const CACHE_MS = 60 * 1000;
let cache = null;

export function normalizeCode(code) {
  if (code == null) return '';
  return String(code).replace(/\s+/g, '').trim().toUpperCase();
}

function stripZeros(code) {
  return /^\d+$/.test(code) ? code.replace(/^0+(?=\d)/, '') : code;
}

function addCode(map, code, target) {
  if (!code) return;
  const list = map.get(code);
  if (!list) map.set(code, [target]);
  else if (!list.some((t) => t.key === target.key)) list.push(target);
}

async function buildIndex() {
  const products = await Product.find({ seller: null })
    .select('_id barcode sku variants._id variants.barcode variants.sku')
    .lean();
  const exact = new Map();
  const loose = new Map();
  for (const p of products) {
    const base = { productId: String(p._id), variantId: null, key: `${p._id}:` };
    for (const code of [p.barcode, p.sku]) {
      const n = normalizeCode(code);
      addCode(exact, n, base);
      addCode(loose, stripZeros(n), base);
    }
    for (const v of p.variants || []) {
      const target = { productId: String(p._id), variantId: String(v._id), key: `${p._id}:${v._id}` };
      for (const code of [v.barcode, v.sku]) {
        const n = normalizeCode(code);
        addCode(exact, n, target);
        addCode(loose, stripZeros(n), target);
      }
    }
  }
  return { exact, loose, builtAt: Date.now() };
}

export function invalidateProductMatcher() {
  cache = null;
}

export async function getProductMatcher({ fresh = false } = {}) {
  if (fresh || !cache || Date.now() - cache.builtAt > CACHE_MS) {
    cache = await buildIndex();
  }
  const { exact, loose } = cache;
  return {
    /** → { productId, variantId } | { ambiguous: true } | null */
    match(code) {
      const n = normalizeCode(code);
      if (!n) return null;
      const hit = exact.get(n);
      if (hit?.length === 1) return hit[0];
      if (hit?.length > 1) return { ambiguous: true };
      const fallback = loose.get(stripZeros(n));
      if (fallback?.length === 1) return fallback[0];
      if (fallback?.length > 1) return { ambiguous: true };
      return null;
    },
  };
}
