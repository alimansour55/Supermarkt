import Product from '../models/Product.js';
import { formatProduct } from './formatters.js';

/** Mongo predicate: base stock left, or at least one variant with stock. */
const IN_STOCK_MATCH = {
  $or: [
    { stock: { $gt: 0 } },
    { variants: { $elemMatch: { stock: { $gt: 0 } } } },
  ],
};

/** JS mirror of IN_STOCK_MATCH for already-loaded docs. */
const isInStock = (p) =>
  (Number(p?.stock) || 0) > 0 ||
  (Array.isArray(p?.variants) && p.variants.some((v) => (Number(v?.stock) || 0) > 0));

const idStr = (v) => String(v?._id ?? v);

/**
 * Build the "Similar products" list for a product page.
 *
 * Respects `product.similarMode`:
 *   - 'off'    -> []
 *   - 'manual' -> only the admin's `similarProducts` picks (in stock), in pick order
 *   - 'auto'   -> picks first, then auto-filled with relevant in-stock products
 *
 * @param {object} product        lean Product doc (needs similarProducts, similarMode,
 *                                 category, brand, price)
 * @param {object} [opts]
 * @param {number} [opts.limit=8] max items to return
 * @param {string[]} [opts.excludeIds=[]] extra product ids to keep out (e.g. FBT strip)
 * @returns {Promise<object[]>} formatted products
 */
export async function buildSimilarProducts(product, { limit = 8, excludeIds = [] } = {}) {
  if (!product || product.similarMode === 'off') return [];

  const selfId = idStr(product);
  const pickIds = (product.similarProducts || []).map(idStr);

  // 1) Manual picks — preserve admin order, drop inactive / out-of-stock.
  let picks = [];
  if (pickIds.length) {
    const pickDocs = await Product.find({ _id: { $in: pickIds }, isActive: true })
      .populate('category', 'slug nameAr nameEn')
      .lean();
    const byId = new Map(pickDocs.map((p) => [idStr(p), p]));
    picks = pickIds
      .map((id) => byId.get(id))
      .filter((p) => p && isInStock(p));
  }

  if (product.similarMode === 'manual' || picks.length >= limit) {
    return picks.slice(0, limit).map(formatProduct);
  }

  // 2) Auto-fill the remainder with a relevance query.
  const excluded = new Set([
    selfId,
    ...picks.map(idStr),
    ...pickIds,
    ...excludeIds.map(String),
  ]);

  const catId = product.category?._id ?? product.category ?? null;
  if (!catId) return picks.slice(0, limit).map(formatProduct);

  const candidates = await Product.find({
    isActive: true,
    _id: { $nin: [...excluded] },
    $and: [{ category: catId }, IN_STOCK_MATCH],
  })
    .populate('category', 'slug nameAr nameEn')
    .sort({ soldCount: -1 })
    .limit(40)
    .lean();

  const basePrice = Number(product.price) || 0;
  const maxSold = Math.max(1, ...candidates.map((c) => Number(c.soldCount) || 0));
  const brand = (product.brand || '').trim().toLowerCase();
  const subKey = String(catId);

  const scored = candidates
    .map((c) => {
      let score = 0;
      if (subKey && String(c.category?._id ?? c.category) === subKey) score += 3;
      if (brand && (c.brand || '').trim().toLowerCase() === brand) score += 2;
      if (basePrice > 0) {
        const ratio = Math.abs((Number(c.price) || 0) - basePrice) / basePrice;
        if (ratio <= 0.25) score += 2;
        else if (ratio <= 0.5) score += 1;
      }
      score += (Number(c.soldCount) || 0) / maxSold;
      score += (Number(c.rating) || 0) / 5;
      return { c, score };
    })
    .sort((a, b) => b.score - a.score);

  const fill = scored.slice(0, limit - picks.length).map((s) => s.c);
  return [...picks, ...fill].slice(0, limit).map(formatProduct);
}
