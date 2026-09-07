import SearchEvent from '../models/SearchEvent.js';
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import StoreSettings from '../models/StoreSettings.js';
import { DEFAULT_TRENDING_SEARCHES } from '../constants/storeDefaults.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { formatProduct } from '../utils/formatters.js';
import {
  normalizeSearchQuery,
  resolveProductSearchFilter,
  findCategorySuggestions,
} from '../utils/searchQuery.js';
import { resolveCategoryProductFilter } from '../utils/categoryTree.js';

async function getStoreSearchSettings() {
  const settings = await StoreSettings.findOne({ key: 'main' }).select('searchSettings');
  return settings?.searchSettings || {};
}

const MIN_TRACKED_SEARCH_LENGTH = 3;

function isTrackableSearchQuery(query) {
  const normalized = normalizeSearchQuery(String(query || ''));
  return Array.from(normalized).length >= MIN_TRACKED_SEARCH_LENGTH && /[\p{L}\p{N}]/u.test(normalized);
}

function formatTrendingItem(item, product = null) {
  const query = String(item.query || item.labelAr || item.labelEn || '').trim();
  const labelAr = item.labelAr || product?.nameAr || query;
  const labelEn = item.labelEn || product?.nameEn || query;
  return {
    query: query || product?.nameAr || product?.nameEn || '',
    labelAr,
    labelEn,
    count: item.count || 0,
    productId: product?._id ? String(product._id) : (item.productId ? String(item.productId) : null),
    productSlug: product?.slug || null,
    image: product?.images?.[0] || product?.image || null,
  };
}

async function enrichTrendingItems(items) {
  const productIds = items
    .map((item) => item.productId)
    .filter(Boolean);

  const products = productIds.length
    ? await Product.find({ _id: { $in: productIds }, isActive: true })
      .select('nameAr nameEn slug images')
      .lean()
    : [];

  const byId = new Map(products.map((p) => [String(p._id), p]));

  return items.map((item) => {
    const product = item.productId ? byId.get(String(item.productId)) : null;
    if (item.productId && !product) return null;
    return formatTrendingItem(item, product);
  }).filter(Boolean);
}

async function getManualTrendingSearches(limit) {
  const searchSettings = await getStoreSearchSettings();
  if (searchSettings.trendingMode === 'auto') return null;

  const configured = (searchSettings.trendingSearches || [])
    .filter((item) => item.isActive !== false && (String(item.query || '').trim() || item.productId))
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    .slice(0, limit);

  if (!configured.length) return null;

  const enriched = await enrichTrendingItems(configured);
  return enriched.length ? enriched : null;
}

async function getAnalyticsTrendingSearches(limit, days) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const candidateLimit = Math.min(Math.max(limit * 2, 12), 24);
  const trending = await SearchEvent.aggregate([
    {
      $match: {
        createdAt: { $gte: since },
        normalizedQuery: { $regex: `.{${MIN_TRACKED_SEARCH_LENGTH},}` },
        noResults: false,
        resultCount: { $gt: 0 },
      },
    },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: '$normalizedQuery',
        count: { $sum: 1 },
        lastQuery: { $first: '$query' },
      },
    },
    { $sort: { count: -1, _id: 1 } },
    { $limit: candidateLimit },
  ]);

  if (!trending.length) return null;

  const seenProductIds = new Set();
  const results = [];

  for (const item of trending) {
    const query = item.lastQuery || item._id;
    if (!isTrackableSearchQuery(query)) continue;

    const { filter, useTextScore } = await resolveProductSearchFilter(
      { isActive: true },
      query,
      Product,
      Category,
    );
    const productQuery = Product.findOne(filter).select('nameAr nameEn slug images soldCount rating');
    productQuery.sort(
      useTextScore
        ? { score: { $meta: 'textScore' }, soldCount: -1, rating: -1 }
        : { soldCount: -1, rating: -1 },
    );
    const product = await productQuery.lean();

    if (!product || seenProductIds.has(String(product._id))) continue;
    seenProductIds.add(String(product._id));
    results.push(formatTrendingItem({ query, count: item.count }, product));
    if (results.length === limit) break;
  }

  return results.length ? results : null;
}

async function buildActiveProductFilter(query) {
  const filter = { isActive: true };
  if (query.category) {
    const categoryFilter = await resolveCategoryProductFilter(query.category);
    if (categoryFilter) {
      filter.$and = [
        ...(filter.$and || []),
        { $or: [{ category: categoryFilter }, { subCategory: categoryFilter }] },
      ];
    }
  }
  return filter;
}

export const getSearchSuggestions = asyncHandler(async (req, res) => {
  const q = req.query.q?.trim();
  const limit = Math.min(Number(req.query.limit) || 5, 10);
  const categoryLimit = Math.min(Number(req.query.categoryLimit) || 3, 6);

  if (!q || q.length < 2) {
    return res.json({
      success: true,
      data: { products: [], categories: [], totalProducts: 0 },
    });
  }

  const baseFilter = await buildActiveProductFilter(req.query);
  const { filter, useTextScore } = await resolveProductSearchFilter(baseFilter, q, Product, Category);

  const productQuery = Product.find(filter)
    .populate('category', 'slug nameAr nameEn')
    .limit(limit);

  if (useTextScore) {
    productQuery.sort({ score: { $meta: 'textScore' } });
  } else {
    productQuery.sort({ soldCount: -1, rating: -1 });
  }

  const [products, totalProducts, matchedCategories] = await Promise.all([
    productQuery,
    Product.countDocuments(filter),
    findCategorySuggestions(q, categoryLimit, Category),
  ]);

  res.json({
    success: true,
    data: {
      products: products.map(formatProduct),
      categories: matchedCategories,
      totalProducts,
    },
  });
});

export const getTrendingSearches = asyncHandler(async (req, res) => {
  const days = Math.min(Number(req.query.days) || 7, 30);
  const limit = Math.min(Number(req.query.limit) || 8, 20);
  const searchSettings = await getStoreSearchSettings();
  const mode = searchSettings.trendingMode === 'auto' ? 'auto' : 'manual';

  let results;
  if (mode === 'manual') {
    results = await getManualTrendingSearches(limit);
  } else {
    results = await getAnalyticsTrendingSearches(limit, days);
  }

  if (!results?.length) {
    results = DEFAULT_TRENDING_SEARCHES.slice(0, limit).map(formatTrendingItem);
  }

  res.json({ success: true, data: results, mode });
});

export const trackSearch = asyncHandler(async (req, res) => {
  const { query, resultCount = 0, sessionId, source = 'search' } = req.body;
  const trimmed = query?.trim();

  if (!isTrackableSearchQuery(trimmed)) {
    return res.status(400).json({
      success: false,
      message: `Query must contain at least ${MIN_TRACKED_SEARCH_LENGTH} letters or numbers`,
    });
  }

  const event = await SearchEvent.create({
    query: trimmed,
    normalizedQuery: normalizeSearchQuery(trimmed),
    resultCount: Number(resultCount) || 0,
    noResults: Number(resultCount) === 0,
    sessionId: sessionId || null,
    user: req.user?._id || null,
    source,
  });

  res.status(201).json({ success: true, data: { id: event._id } });
});

export const trackSearchConversion = asyncHandler(async (req, res) => {
  const { sessionId, query } = req.body;
  if (!sessionId && !query) {
    return res.status(400).json({ success: false, message: 'sessionId or query required' });
  }

  const filter = { converted: false };
  if (sessionId) filter.sessionId = sessionId;
  if (query) filter.normalizedQuery = normalizeSearchQuery(query);

  const event = await SearchEvent.findOne(filter).sort({ createdAt: -1 });
  if (!event) {
    return res.json({ success: true, data: { updated: false } });
  }

  event.converted = true;
  event.convertedAt = new Date();
  await event.save();

  res.json({ success: true, data: { updated: true, id: event._id } });
});

export const getSearchAnalytics = asyncHandler(async (req, res) => {
  const days = Math.min(Number(req.query.days) || 30, 90);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const limit = Math.min(Number(req.query.limit) || 15, 50);

  const [topSearches, noResultSearches, summary] = await Promise.all([
    SearchEvent.aggregate([
      {
        $match: {
          createdAt: { $gte: since },
          normalizedQuery: { $regex: `.{${MIN_TRACKED_SEARCH_LENGTH},}` },
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$normalizedQuery',
          count: { $sum: 1 },
          conversions: { $sum: { $cond: ['$converted', 1, 0] } },
          avgResults: { $avg: '$resultCount' },
          lastQuery: { $first: '$query' },
        },
      },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]),
    SearchEvent.aggregate([
      {
        $match: {
          createdAt: { $gte: since },
          noResults: true,
          normalizedQuery: { $regex: `.{${MIN_TRACKED_SEARCH_LENGTH},}` },
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$normalizedQuery',
          count: { $sum: 1 },
          lastQuery: { $first: '$query' },
          lastSeen: { $max: '$createdAt' },
        },
      },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]),
    SearchEvent.aggregate([
      {
        $match: {
          createdAt: { $gte: since },
          normalizedQuery: { $regex: `.{${MIN_TRACKED_SEARCH_LENGTH},}` },
        },
      },
      {
        $group: {
          _id: null,
          totalSearches: { $sum: 1 },
          noResultCount: { $sum: { $cond: ['$noResults', 1, 0] } },
          conversions: { $sum: { $cond: ['$converted', 1, 0] } },
        },
      },
    ]),
  ]);

  const stats = summary[0] || { totalSearches: 0, noResultCount: 0, conversions: 0 };
  const conversionRate = stats.totalSearches
    ? Math.round((stats.conversions / stats.totalSearches) * 1000) / 10
    : 0;
  const noResultRate = stats.totalSearches
    ? Math.round((stats.noResultCount / stats.totalSearches) * 1000) / 10
    : 0;

  res.json({
    success: true,
    data: {
      periodDays: days,
      summary: {
        totalSearches: stats.totalSearches,
        noResultCount: stats.noResultCount,
        noResultRate,
        conversions: stats.conversions,
        conversionRate,
      },
      topSearches: topSearches.map((s) => ({
        query: s.lastQuery || s._id,
        count: s.count,
        conversions: s.conversions,
        conversionRate: s.count ? Math.round((s.conversions / s.count) * 1000) / 10 : 0,
        avgResults: Math.round(s.avgResults || 0),
      })),
      noResultSearches: noResultSearches.map((s) => ({
        query: s.lastQuery || s._id,
        count: s.count,
        lastSeen: s.lastSeen,
      })),
    },
  });
});
