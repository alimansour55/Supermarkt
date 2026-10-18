/**
 * "Trending" chips under the search bar and on the home page.
 *
 * Smart mode (default) = live admin pins first, then automatic trends, then best-sellers
 * so the row is never empty or a lonely single chip.
 *
 * Automatic trends:
 *  - one vote per shopper session (repeat searches and bots typing the same thing don't stack);
 *  - recency-weighted: a session's vote halves every HALF_LIFE_HOURS, so rising terms beat old ones;
 *  - clicks that came *from* the chips or from "recent searches" never count (no feedback loop);
 *  - spelling variants (أ/ا, ة/ه, Latin case…) fold into one term, and terms that land on the
 *    same product merge into one chip with an Arabic and an English label;
 *  - only terms with results whose top product is visible and in stock.
 */
import mongoose from 'mongoose';
import SearchEvent from '../models/SearchEvent.js';
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import StoreSettings from '../models/StoreSettings.js';
import { DEFAULT_TRENDING_CONFIG } from '../constants/storeDefaults.js';
import { normalizeSearchText } from '../utils/arabicNormalize.js';
import { resolveProductSearchFilter, fetchRankedProducts } from '../utils/searchQuery.js';

const TRENDING_MODES = ['smart', 'manual', 'auto'];
export const TRENDING_SETTINGS_VERSION = 2;
/** Search sources that must not feed the ranking (they are clicks on our own suggestions). */
const IGNORED_TREND_SOURCES = ['trending', 'recent'];
const MIN_TREND_TERM_LENGTH = 3;

const WINDOW_DAYS = 14;
const HALF_LIFE_HOURS = 48;
/** Below this many chips, best-sellers top the row up (smart / auto modes). */
const MIN_CHIPS = 4;
const CACHE_TTL_MS = 5 * 60 * 1000;
const CONVERSION_BOOST = 0.5;
const ADMIN_CANDIDATE_LIMIT = 30;
/** Top-ranked terms whose products are looked up per rebuild (bounded work; result is cached). */
const CANDIDATE_POOL = 60;

const IN_STOCK = {
  $or: [
    { stock: { $gt: 0 } },
    { variants: { $elemMatch: { stock: { $gt: 0 } } } },
  ],
};
const PUBLIC_IN_STOCK = { isActive: true, $and: [IN_STOCK] };

// --- config ----------------------------------------------------------------

function clampInt(value, min, max, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(Math.max(Math.round(num), min), max);
}

function toBool(value, fallback) {
  if (value === undefined || value === null) return fallback;
  return value !== false && value !== 'false' && value !== '0' && value !== 0;
}

/** Fold a term the same way the search index does; '' when it is too short to trend. */
function foldTerm(value) {
  return normalizeSearchText(value);
}

function foldList(list, max = 200) {
  return [...new Set(
    (Array.isArray(list) ? list : [])
      .map((entry) => foldTerm(entry))
      .filter(Boolean),
  )].slice(0, max);
}

function plain(value) {
  return value?.toObject?.() || value || {};
}

/** Stored (or posted) trendingConfig merged over the defaults and clamped to safe ranges. */
export function resolveTrendingConfig(rawConfig) {
  const raw = plain(rawConfig);
  const displayLimit = clampInt(raw.displayLimit, 1, 20, DEFAULT_TRENDING_CONFIG.displayLimit);
  return {
    displayLimit,
    maxPinned: clampInt(raw.maxPinned, 0, displayLimit, Math.min(DEFAULT_TRENDING_CONFIG.maxPinned, displayLimit)),
    minSessions: clampInt(raw.minSessions, 1, 1000, DEFAULT_TRENDING_CONFIG.minSessions),
    requireConversion: toBool(raw.requireConversion, DEFAULT_TRENDING_CONFIG.requireConversion),
    dedupeByProduct: toBool(raw.dedupeByProduct, DEFAULT_TRENDING_CONFIG.dedupeByProduct),
    requireApproval: toBool(raw.requireApproval, DEFAULT_TRENDING_CONFIG.requireApproval),
    approvedTerms: foldList(raw.approvedTerms),
    autoBlocklist: foldList(raw.autoBlocklist),
  };
}

function toDateOrNull(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Clean a searchSettings payload from the admin before it is stored. */
export function normalizeSearchSettings(input = {}) {
  const current = plain(input);
  return {
    trendingMode: TRENDING_MODES.includes(current.trendingMode) ? current.trendingMode : 'smart',
    trendingSearches: (Array.isArray(current.trendingSearches) ? current.trendingSearches : [])
      .map((item, index) => {
        const startsAt = toDateOrNull(item.startsAt);
        let endsAt = toDateOrNull(item.endsAt);
        if (startsAt && endsAt && endsAt <= startsAt) endsAt = null;
        return {
          query: String(item.query || item.labelAr || item.labelEn || '').trim(),
          labelAr: String(item.labelAr || item.query || '').trim(),
          labelEn: String(item.labelEn || item.query || '').trim(),
          productId: mongoose.isValidObjectId(item.productId) ? item.productId : null,
          sortOrder: index,
          isActive: toBool(item.isActive, true),
          startsAt,
          endsAt,
        };
      })
      .filter((item) => item.query)
      .slice(0, 50),
    trendingConfig: resolveTrendingConfig(current.trendingConfig),
    trendingVersion: TRENDING_SETTINGS_VERSION,
  };
}

/** The seed chips older versions inserted automatically — not an admin's choice. */
const LEGACY_SEED_PINS = new Set(['milk|لبن', 'bread|عيش', 'rice|أرز', 'chicken|دجاج', 'eggs|بيض']);

/**
 * v1 → v2: hybrid/manual become smart (manual was only ever the default), the auto-seeded
 * milk/bread/… pins are dropped, the old count-based knobs reset to the new defaults, and
 * blocklist terms are re-folded. Returns null when already current.
 */
export function migrateSearchSettings(stored) {
  const current = plain(stored);
  if (current.trendingVersion === TRENDING_SETTINGS_VERSION) return null;
  const oldConfig = plain(current.trendingConfig);
  return normalizeSearchSettings({
    trendingMode: current.trendingMode === 'auto' ? 'auto' : 'smart',
    trendingSearches: (current.trendingSearches || [])
      .filter((item) => !LEGACY_SEED_PINS.has(`${item.query}|${item.labelAr}`)),
    trendingConfig: {
      displayLimit: oldConfig.displayLimit,
      dedupeByProduct: oldConfig.dedupeByProduct,
      autoBlocklist: oldConfig.autoBlocklist,
    },
  });
}

// --- pins ------------------------------------------------------------------

/** 'live' | 'scheduled' | 'expired' | 'inactive' */
export function pinStatus(pin, now = new Date()) {
  if (pin.isActive === false) return 'inactive';
  if (pin.startsAt && new Date(pin.startsAt) > now) return 'scheduled';
  if (pin.endsAt && new Date(pin.endsAt) <= now) return 'expired';
  return 'live';
}

async function resolvePins(pins, limit, now) {
  const live = pins
    .filter((pin) => pinStatus(pin, now) === 'live' && String(pin.query || '').trim())
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  if (!live.length || limit <= 0) return [];

  const productIds = live.map((pin) => pin.productId).filter(Boolean);
  const products = productIds.length
    ? await Product.find({ _id: { $in: productIds }, ...PUBLIC_IN_STOCK }).select('nameAr nameEn slug').lean()
    : [];
  const byId = new Map(products.map((p) => [String(p._id), p]));

  const out = [];
  for (const pin of live) {
    // A pinned product that went out of stock or offline silently drops out.
    const product = pin.productId ? byId.get(String(pin.productId)) : null;
    if (pin.productId && !product) continue;
    out.push({
      kind: 'pinned',
      query: pin.query,
      labelAr: pin.labelAr || product?.nameAr || pin.query,
      labelEn: pin.labelEn || product?.nameEn || pin.query,
      productId: product ? String(product._id) : null,
      productSlug: product?.slug || null,
      key: foldTerm(pin.query),
    });
    if (out.length === limit) break;
  }
  return out;
}

// --- automatic trends --------------------------------------------------------

const isArabicScript = (text) => /[؀-ۿ]/.test(text);
const titleCase = (text) => text.replace(/(^|\s)(\p{Ll})/gu, (_, gap, ch) => gap + ch.toUpperCase());

/**
 * Raw per-query rows → folded terms. Exported for tests.
 * rows: [{ _id: normalizedQuery, query, sessions, conversions, score }]
 */
export function foldTrendRows(rows) {
  const terms = new Map();
  for (const row of rows) {
    const key = foldTerm(row._id || row.query);
    if (Array.from(key).length < MIN_TREND_TERM_LENGTH || !/[\p{L}\p{N}]/u.test(key)) continue;
    const term = terms.get(key) || { key, sessions: 0, conversions: 0, score: 0, variants: [] };
    term.sessions += row.sessions;
    term.conversions += row.conversions;
    term.score += row.score;
    term.variants.push({ text: String(row.query || row._id).trim(), weight: row.sessions });
    terms.set(key, term);
  }
  return [...terms.values()]
    .map((term) => ({
      ...term,
      rank: term.score * (1 + CONVERSION_BOOST * Math.min(1, term.conversions / Math.max(1, term.sessions))),
    }))
    .sort((a, b) => b.rank - a.rank || a.key.localeCompare(b.key));
}

/** Best Arabic-script and Latin spellings among a chip's variants. Exported for tests. */
export function pickLabels(variants) {
  const sorted = [...variants].sort((a, b) => b.weight - a.weight);
  const ar = sorted.find((v) => isArabicScript(v.text))?.text;
  const en = sorted.find((v) => !isArabicScript(v.text))?.text;
  const top = sorted[0]?.text || '';
  return {
    query: top,
    labelAr: ar || top,
    labelEn: en ? titleCase(en) : top,
  };
}

async function loadTrendRows(now) {
  const since = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  return SearchEvent.aggregate([
    {
      $match: {
        createdAt: { $gte: since },
        noResults: false,
        source: { $nin: IGNORED_TREND_SOURCES },
      },
    },
    // One vote per (term, shopper session); events without a session count alone.
    {
      $group: {
        _id: {
          q: '$normalizedQuery',
          s: { $ifNull: ['$sessionId', { $toString: '$_id' }] },
        },
        last: { $max: '$createdAt' },
        converted: { $max: '$converted' },
        query: { $max: '$query' },
      },
    },
    {
      $group: {
        _id: '$_id.q',
        query: { $max: '$query' },
        sessions: { $sum: 1 },
        conversions: { $sum: { $cond: ['$converted', 1, 0] } },
        score: {
          $sum: {
            $pow: [0.5, { $divide: [{ $subtract: [now, '$last'] }, HALF_LIFE_HOURS * 60 * 60 * 1000] }],
          },
        },
      },
    },
    { $sort: { score: -1 } },
    { $limit: 300 },
  ]).allowDiskUse(true);
}

/** Top visible, in-stock product for a term (search-engine ranked when available). */
async function findTopProduct(query) {
  const { filter, useTextScore, rankedIds } = await resolveProductSearchFilter(
    { ...PUBLIC_IN_STOCK },
    query,
    Product,
    Category,
  );
  if (rankedIds) {
    const { products } = await fetchRankedProducts(Product, filter, rankedIds, { limit: 1, lean: true });
    return products[0] || null;
  }
  return Product.findOne(filter)
    .select('nameAr nameEn slug')
    .sort(useTextScore ? { score: { $meta: 'textScore' }, soldCount: -1 } : { soldCount: -1, rating: -1 })
    .lean();
}

async function mapInBatches(items, size, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += size) {
    // eslint-disable-next-line no-await-in-loop
    out.push(...await Promise.all(items.slice(i, i + size).map(fn)));
  }
  return out;
}

const roundScore = (value) => Math.round(value * 100) / 100;

/**
 * Turn folded terms into chips.
 *  1. drop hidden / already-pinned terms (cheap checks first);
 *  2. look up each remaining term's top in-stock product;
 *  3. merge terms that land on the same product (their shoppers add up *before* thresholds,
 *     so "aquafina" + "اكوافينا" can qualify together);
 *  4. apply the shopper / sales / approval rules to each merged group.
 * Every examined term gets a `status` so the admin can see why something is (not) shown.
 */
async function rankAutoTerms(terms, {
  config,
  limit,
  reservedKeys,
  reservedProductIds,
}) {
  const blocked = new Set(config.autoBlocklist);
  const approved = new Set(config.approvedTerms);
  const reservedProducts = new Set(reservedProductIds.map(String));
  const examined = [];
  const describe = (term) => ({
    key: term.key,
    ...pickLabels(term.variants),
    sessions: term.sessions,
    conversions: term.conversions,
    score: roundScore(term.rank),
  });

  const pool = [];
  for (const term of terms) {
    if (reservedKeys.has(term.key)) examined.push({ ...describe(term), status: 'pinned' });
    else if (blocked.has(term.key)) examined.push({ ...describe(term), status: 'hidden' });
    else if (pool.length < CANDIDATE_POOL) pool.push(term);
  }

  const withProducts = await mapInBatches(pool, 8, async (term) => ({
    term,
    product: await findTopProduct(pickLabels(term.variants).query),
  }));

  const groups = [];
  const groupByProduct = new Map();
  for (const { term, product } of withProducts) {
    if (!product) {
      examined.push({ ...describe(term), status: 'no-stock' });
      continue;
    }
    const productId = String(product._id);
    const existing = config.dedupeByProduct ? groupByProduct.get(productId) : null;
    if (existing) {
      existing.members.push(term);
      continue;
    }
    const group = { productId, members: [term] };
    groups.push(group);
    groupByProduct.set(productId, group);
  }

  const merged = groups.map((group) => {
    const [lead] = group.members;
    const sum = (field) => group.members.reduce((total, term) => total + term[field], 0);
    return {
      ...group,
      key: lead.key,
      variants: group.members.flatMap((term) => term.variants),
      sessions: sum('sessions'),
      conversions: sum('conversions'),
      rank: sum('rank'),
    };
  }).sort((a, b) => b.rank - a.rank || a.key.localeCompare(b.key));

  const chips = [];
  for (const group of merged) {
    let status = 'shown';
    if (reservedProducts.has(group.productId)) status = 'pinned';
    else if (group.sessions < config.minSessions) status = 'few-shoppers';
    else if (config.requireConversion && group.conversions < 1) status = 'no-sales';
    else if (config.requireApproval && !group.members.some((term) => approved.has(term.key))) status = 'pending';
    else if (chips.length >= limit) status = 'overflow';

    const chip = { ...describe(group), productId: group.productId };
    if (status === 'shown') chips.push({ kind: 'auto', ...chip });
    examined.push({ ...chip, status });
    group.members.slice(1).forEach((term) => {
      examined.push({ ...describe(term), status: 'merged', mergedInto: group.key });
    });
  }

  const order = { shown: 0, pending: 1, overflow: 2, 'few-shoppers': 3, 'no-sales': 4, merged: 5, pinned: 6, 'no-stock': 7, hidden: 8 };
  examined.sort((a, b) => order[a.status] - order[b.status] || b.score - a.score);
  return { chips, examined: examined.slice(0, ADMIN_CANDIDATE_LIMIT) };
}

async function bestSellerChips(limit, excludeProductIds) {
  if (limit <= 0) return [];
  const products = await Product.find({
    ...PUBLIC_IN_STOCK,
    _id: { $nin: [...excludeProductIds].filter(mongoose.isValidObjectId) },
  })
    .select('nameAr nameEn slug')
    .sort({ soldCount: -1, rating: -1, _id: 1 })
    .limit(limit)
    .lean();
  return products.map((product) => ({
    kind: 'fallback',
    query: product.nameAr || product.nameEn,
    labelAr: product.nameAr || product.nameEn,
    labelEn: product.nameEn || product.nameAr,
    productId: String(product._id),
    productSlug: product.slug,
    key: foldTerm(product.nameAr || product.nameEn),
  }));
}

// --- assembly ------------------------------------------------------------------

async function loadSearchSettings() {
  const doc = await StoreSettings.findOne({ key: 'main' }).select('searchSettings').lean();
  return doc?.searchSettings || {};
}

/**
 * Build the chip row from scratch.
 * `withDiagnostics` (admin) also examines every candidate term and reports its status.
 */
export async function buildTrending({ searchSettings, now = new Date(), withDiagnostics = false } = {}) {
  const settings = searchSettings || await loadSearchSettings();
  const config = resolveTrendingConfig(settings.trendingConfig);
  const mode = TRENDING_MODES.includes(settings.trendingMode) ? settings.trendingMode : 'smart';
  const limit = config.displayLimit;

  const pinLimit = mode === 'auto' ? 0 : (mode === 'manual' ? limit : config.maxPinned);
  const pins = await resolvePins(settings.trendingSearches || [], pinLimit, now);
  const items = [...pins];

  let examined = [];
  if (mode !== 'manual') {
    const terms = foldTrendRows(await loadTrendRows(now));
    const ranked = await rankAutoTerms(terms, {
      config,
      limit: limit - items.length,
      reservedKeys: new Set(pins.map((pin) => pin.key)),
      reservedProductIds: pins.map((pin) => pin.productId).filter(Boolean),
    });
    items.push(...ranked.chips);
    examined = ranked.examined;
  }

  // Never leave the row empty or nearly empty. Manual mode respects "only my list"
  // unless that list has nothing live at all.
  const wantsFallback = mode === 'manual' ? items.length === 0 : items.length < MIN_CHIPS;
  if (wantsFallback) {
    const used = new Set(items.map((item) => item.productId).filter(Boolean));
    items.push(...await bestSellerChips(Math.min(limit, MIN_CHIPS) - items.length, used));
  }

  const chips = items.slice(0, limit).map(({ key, ...chip }) => (withDiagnostics ? { key, ...chip } : {
    kind: chip.kind,
    query: chip.query,
    labelAr: chip.labelAr,
    labelEn: chip.labelEn,
    productSlug: chip.kind === 'auto' ? null : chip.productSlug || null,
  }));

  return withDiagnostics ? { mode, config, chips, candidates: examined } : chips;
}

let cache = { at: 0, chips: null, pending: null };

export function invalidateTrendingCache() {
  cache = { at: 0, chips: null, pending: null };
}

/** Customer-facing chips, cached for a few minutes (one computation in flight at a time). */
export async function getTrendingChips() {
  if (cache.chips && Date.now() - cache.at < CACHE_TTL_MS) return cache.chips;
  if (!cache.pending) {
    const pending = buildTrending()
      .then((chips) => {
        if (cache.pending === pending) cache = { at: Date.now(), chips, pending: null };
        return chips;
      })
      .catch((error) => {
        if (cache.pending === pending) cache.pending = null;
        throw error;
      });
    cache.pending = pending;
  }
  return cache.pending;
}
