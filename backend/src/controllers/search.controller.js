import SearchEvent from '../models/SearchEvent.js';
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import StoreSettings from '../models/StoreSettings.js';
import { DEFAULT_TRENDING_SEARCHES, DEFAULT_TRENDING_CONFIG } from '../constants/storeDefaults.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { formatProduct } from '../utils/formatters.js';
import {
  normalizeSearchQuery,
  resolveProductSearchFilter,
  findCategorySuggestions,
  fetchRankedProducts,
} from '../utils/searchQuery.js';
import { resolveCategoryProductFilter } from '../utils/categoryTree.js';
import { fullSync, getSearchEngineStatus, isSearchEngineConfigured } from '../services/searchIndex.service.js';
import { AppError } from '../utils/AppError.js';

async function getStoreSearchSettings() {
  const settings = await StoreSettings.findOne({ key: 'main' }).select('searchSettings');
  return settings?.searchSettings || {};
}

const MIN_TRACKED_SEARCH_LENGTH = 3;

function clampNumber(value, min, max, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(Math.max(num, min), max);
}

/** Merge stored trendingConfig over the defaults, clamped to safe ranges. */
function resolveTrendingConfig(searchSettings = {}) {
  const raw = searchSettings.trendingConfig?.toObject?.()
    || searchSettings.trendingConfig
    || {};
  return {
    displayLimit: clampNumber(raw.displayLimit, 1, 20, DEFAULT_TRENDING_CONFIG.displayLimit),
    autoLookbackDays: clampNumber(raw.autoLookbackDays, 1, 30, DEFAULT_TRENDING_CONFIG.autoLookbackDays),
    autoMinCount: clampNumber(raw.autoMinCount, 1, 1000, DEFAULT_TRENDING_CONFIG.autoMinCount),
    requireConversion: raw.requireConversion === true,
    dedupeByProduct: raw.dedupeByProduct !== false,
    autoBlocklist: Array.isArray(raw.autoBlocklist)
      ? raw.autoBlocklist.map((entry) => normalizeSearchQuery(String(entry || ''))).filter(Boolean)
      : [],
  };
}

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

function getConfiguredManualItems(searchSettings, limit) {
  return (searchSettings.trendingSearches || [])
    .filter((item) => item.isActive !== false && (String(item.query || '').trim() || item.productId))
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    .slice(0, limit);
}

async function getManualTrendingSearches(limit, searchSettings) {
  const settings = searchSettings || await getStoreSearchSettings();
  const configured = getConfiguredManualItems(settings, limit);
  if (!configured.length) return null;

  const enriched = await enrichTrendingItems(configured);
  return enriched.length ? enriched : null;
}

async function getAnalyticsTrendingSearches(limit, opts = {}) {
  if (limit <= 0) return null;

  const {
    days = DEFAULT_TRENDING_CONFIG.autoLookbackDays,
    minCount = DEFAULT_TRENDING_CONFIG.autoMinCount,
    requireConversion = false,
    dedupeByProduct = true,
    blocklist = [],
    excludeProductIds = [],
    excludeNormalizedQueries = [],
  } = opts;

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const skipQueries = new Set([
    ...blocklist,
    ...excludeNormalizedQueries,
  ].map((q) => normalizeSearchQuery(String(q || ''))).filter(Boolean));
  const seenProductIds = new Set(excludeProductIds.map(String));

  const candidateLimit = Math.min(Math.max(limit * 3, 15), 40);
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
        conversions: { $sum: { $cond: ['$converted', 1, 0] } },
        lastQuery: { $first: '$query' },
      },
    },
    { $match: { count: { $gte: minCount } } },
    { $sort: { count: -1, _id: 1 } },
    { $limit: candidateLimit },
  ]);

  if (!trending.length) return null;

  const results = [];

  for (const item of trending) {
    if (skipQueries.has(item._id)) continue;
    if (requireConversion && !(item.conversions > 0)) continue;

    const query = item.lastQuery || item._id;
    if (!isTrackableSearchQuery(query)) continue;

    const { filter, useTextScore, rankedIds } = await resolveProductSearchFilter(
      { isActive: true },
      query,
      Product,
      Category,
    );
    let product;
    if (rankedIds) {
      ({ products: [product] } = await fetchRankedProducts(Product, filter, rankedIds, { limit: 1, lean: true }));
    } else {
      const productQuery = Product.findOne(filter).select('nameAr nameEn slug images soldCount rating');
      productQuery.sort(
        useTextScore
          ? { score: { $meta: 'textScore' }, soldCount: -1, rating: -1 }
          : { soldCount: -1, rating: -1 },
      );
      product = await productQuery.lean();
    }

    if (!product) continue;
    if (dedupeByProduct && seenProductIds.has(String(product._id))) continue;
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
      filter.$and = [...(filter.$and || []), { category: categoryFilter }];
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
  const { filter, useTextScore, rankedIds } = await resolveProductSearchFilter(baseFilter, q, Product, Category);

  let productsPromise;
  if (rankedIds) {
    productsPromise = fetchRankedProducts(Product, filter, rankedIds, {
      limit,
      populate: ['category', 'slug nameAr nameEn'],
    });
  } else {
    const productQuery = Product.find(filter)
      .populate('category', 'slug nameAr nameEn')
      .limit(limit);
    productQuery.sort(useTextScore ? { score: { $meta: 'textScore' } } : { soldCount: -1, rating: -1 });
    productsPromise = Promise.all([productQuery, Product.countDocuments(filter)])
      .then(([products, total]) => ({ products, total }));
  }

  const [{ products, total: totalProducts }, matchedCategories] = await Promise.all([
    productsPromise,
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

const TRENDING_MODES = ['manual', 'auto', 'hybrid'];

export const getTrendingSearches = asyncHandler(async (req, res) => {
  const searchSettings = await getStoreSearchSettings();
  const config = resolveTrendingConfig(searchSettings);
  const mode = TRENDING_MODES.includes(searchSettings.trendingMode)
    ? searchSettings.trendingMode
    : 'manual';

  const limit = req.query.limit != null
    ? clampNumber(req.query.limit, 1, 20, config.displayLimit)
    : config.displayLimit;
  const days = req.query.days != null
    ? clampNumber(req.query.days, 1, 30, config.autoLookbackDays)
    : config.autoLookbackDays;

  const autoOpts = {
    days,
    minCount: config.autoMinCount,
    requireConversion: config.requireConversion,
    dedupeByProduct: config.dedupeByProduct,
    blocklist: config.autoBlocklist,
  };

  let results = [];
  if (mode === 'manual') {
    results = await getManualTrendingSearches(limit, searchSettings) || [];
  } else if (mode === 'auto') {
    results = await getAnalyticsTrendingSearches(limit, autoOpts) || [];
  } else {
    const manual = await getManualTrendingSearches(limit, searchSettings) || [];
    results = [...manual];
    if (results.length < limit) {
      const fill = await getAnalyticsTrendingSearches(limit - results.length, {
        ...autoOpts,
        excludeProductIds: manual.map((item) => item.productId).filter(Boolean),
        excludeNormalizedQueries: manual.map((item) => item.query).filter(Boolean),
      }) || [];
      results = [...results, ...fill];
    }
  }

  if (!results.length) {
    results = DEFAULT_TRENDING_SEARCHES.slice(0, limit).map((item) => formatTrendingItem(item));
  }

  res.json({ success: true, data: results.slice(0, limit), mode });
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

/** Admin: which engine is serving search, index size, last rebuild. */
export const getSearchEngineInfo = asyncHandler(async (_req, res) => {
  res.json({ success: true, data: getSearchEngineStatus() });
});

/** Admin: rebuild the search index from MongoDB now. */
export const rebuildSearchIndex = asyncHandler(async (_req, res) => {
  if (!isSearchEngineConfigured()) {
    throw new AppError('Search engine is not configured (set MEILI_HOST)', 400);
  }
  const result = await fullSync();
  res.json({ success: true, data: { ...result, status: getSearchEngineStatus() } });
});
