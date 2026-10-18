/**
 * Data for homepage blocks that are not the same for every shopper (picked for
 * you, buy it again) plus the shared reviews row. The public homepage response
 * is cached for everyone, so the per-shopper rows are served by their own
 * endpoints and fetched by the browser after hydration.
 */
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import User from '../models/User.js';
import { formatProduct } from '../utils/formatters.js';
import { IN_STOCK_MATCH, buildSimilarProducts } from '../utils/relatedProducts.js';
import { reviewerDisplayName } from '../utils/homepageBlocks.js';

const SEED_LIMIT = 4;
const ORDER_SCAN_LIMIT = 30;

const idStr = (v) => String(v?._id ?? v);

/** Best-selling in-stock products — the fallback row and the builder's sample data. */
export async function bestSellingInStock(limit = 12, excludeIds = []) {
  const products = await Product.find({
    isActive: true,
    _id: { $nin: excludeIds },
    ...IN_STOCK_MATCH,
  })
    .populate('category', 'slug nameAr nameEn')
    .sort({ soldCount: -1, rating: -1 })
    .limit(limit)
    .lean();
  return products.map(formatProduct);
}

/** Products in the shopper's recent orders, newest order first, de-duplicated. */
async function orderedProductIds(userId, max = 60) {
  const orders = await Order.find({ user: userId, orderStatus: { $ne: 'cancelled' } })
    .select('items.product')
    .sort({ createdAt: -1 })
    .limit(ORDER_SCAN_LIMIT)
    .lean();
  const seen = new Set();
  const ids = [];
  orders.forEach((order) => {
    (order.items || []).forEach((item) => {
      const id = item.product ? idStr(item.product) : '';
      if (id && !seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }
    });
  });
  return ids.slice(0, max);
}

/**
 * "Buy it again" — products from the signed-in shopper's past orders that are
 * still on sale and in stock, most recently ordered first.
 */
export async function buyAgainProducts(userId, limit = 12) {
  if (!userId) return [];
  const ids = await orderedProductIds(userId);
  if (!ids.length) return [];
  const docs = await Product.find({ _id: { $in: ids }, isActive: true, ...IN_STOCK_MATCH })
    .populate('category', 'slug nameAr nameEn')
    .lean();
  const byId = new Map(docs.map((p) => [idStr(p), p]));
  return ids.map((id) => byId.get(id)).filter(Boolean).slice(0, limit).map(formatProduct);
}

/**
 * "Picked for you" — similar products (same rules as the product page's
 * "Similar products") for what the shopper looked at recently and, when signed
 * in, what they ordered. Results from each seed are interleaved so one product
 * does not fill the whole row. Falls back to best sellers when there is no
 * history (fallback 'best_sellers') or returns nothing (fallback 'hide').
 */
export async function pickedForYouProducts({
  viewedIds = [],
  userId = null,
  limit = 12,
  fallback = 'best_sellers',
} = {}) {
  const seedIds = [...viewedIds];
  if (userId && seedIds.length < SEED_LIMIT) {
    const ordered = await orderedProductIds(userId, SEED_LIMIT);
    ordered.forEach((id) => { if (!seedIds.includes(id)) seedIds.push(id); });
  }
  const seeds = seedIds.length
    ? await Product.find({ _id: { $in: seedIds.slice(0, SEED_LIMIT * 2) }, isActive: true })
      .select('similarProducts similarMode category brand price')
      .lean()
    : [];
  const order = new Map(seedIds.map((id, i) => [id, i]));
  seeds.sort((a, b) => (order.get(idStr(a)) ?? 0) - (order.get(idStr(b)) ?? 0));
  const usable = seeds.slice(0, SEED_LIMIT);
  // Never suggest what the shopper is already looking at.
  const excluded = new Set(seedIds);

  const lists = await Promise.all(usable.map((seed) => buildSimilarProducts(seed, {
    limit,
    excludeIds: [...excluded],
  })));

  const picked = [];
  const seen = new Set(excluded);
  for (let round = 0; picked.length < limit && lists.some((list) => list.length > round); round += 1) {
    lists.forEach((list) => {
      const product = list[round];
      if (!product || picked.length >= limit) return;
      const id = idStr(product);
      if (seen.has(id)) return;
      seen.add(id);
      picked.push(product);
    });
  }

  const personalized = picked.length > 0;
  if (picked.length < limit && fallback === 'best_sellers') {
    const fill = await bestSellingInStock(limit - picked.length, [...seen]);
    picked.push(...fill);
  }
  return { products: picked.slice(0, limit), personalized };
}

/**
 * Approved, written reviews for the homepage reviews row — featured and pinned
 * first, then newest. Only the shopper's first name and last initial are shown.
 */
export async function homepageReviews({ minRating = 4, verifiedOnly = false, limit = 8 } = {}) {
  const reviewMatch = {
    'reviews.status': 'approved',
    'reviews.rating': { $gte: minRating },
    'reviews.comment': { $type: 'string', $ne: '' },
  };
  if (verifiedOnly) {
    reviewMatch.$or = [
      { 'reviews.verifiedPurchaseManual': true },
      { 'reviews.verifiedPurchaseManual': null, 'reviews.verifiedPurchase': true },
    ];
  }

  const rows = await Product.aggregate([
    { $match: { isActive: true, 'reviews.status': 'approved' } },
    { $project: { slug: 1, nameAr: 1, nameEn: 1, images: 1, emoji: 1, reviews: 1 } },
    { $unwind: '$reviews' },
    { $match: reviewMatch },
    { $sort: { 'reviews.featured': -1, 'reviews.pinned': -1, 'reviews.createdAt': -1 } },
    { $limit: limit },
  ]);
  const userIds = [...new Set(rows.map((row) => row.reviews.user).filter(Boolean).map(String))];
  const users = userIds.length ? await User.find({ _id: { $in: userIds } }).select('name').lean() : [];
  const names = new Map(users.map((u) => [String(u._id), u.name]));

  return rows.map((row) => {
    const review = row.reviews;
    const verified = review.verifiedPurchaseManual ?? review.verifiedPurchase ?? false;
    return {
      id: String(review._id),
      rating: review.rating,
      title: review.title || '',
      comment: review.comment || '',
      createdAt: review.createdAt,
      verified: Boolean(verified),
      name: reviewerDisplayName(names.get(String(review.user))),
      product: {
        _id: String(row._id),
        slug: row.slug,
        nameAr: row.nameAr,
        nameEn: row.nameEn,
        // A product photo URL, or the emoji some catalogue items use instead.
        image: row.images?.[0] || row.emoji || '',
      },
    };
  });
}
