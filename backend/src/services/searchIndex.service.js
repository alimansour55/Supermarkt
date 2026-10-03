/**
 * Product search engine (Meilisearch).
 *
 * Meilisearch answers "which products match this text, best first" — typo tolerant,
 * Arabic-normalized, synonym-aware, ranked by relevance then popularity. MongoDB still
 * applies every other filter (category, brand, price, stock), so the engine only ever
 * returns ranked product ids.
 *
 * Optional: with MEILI_HOST unset (or while the engine is unreachable) every caller
 * falls back to the MongoDB regex search in utils/searchQuery.js.
 */
import mongoose from 'mongoose';
import { Meilisearch } from 'meilisearch';
import { normalizeSearchText } from '../utils/arabicNormalize.js';
import { buildSynonymMap } from '../constants/searchSynonyms.js';

const INDEX_UID = process.env.MEILI_INDEX?.trim() || 'products';
/** Upper bound on ranked ids per query; Mongo filters and paginates within these. */
export const MAX_SEARCH_HITS = 1000;
const BATCH_SIZE = 1000;
const SYNC_DEBOUNCE_MS = 1500;
// Short: mainly dedupes the repeated lookups of one facets request; edits from other
// processes (scripts, other API instances) become visible within this window.
const QUERY_CACHE_TTL_MS = 5_000;
const QUERY_CACHE_MAX = 500;
const FAILURE_COOLDOWN_MS = 30_000;
const PERIODIC_SYNC_MS = Number(process.env.MEILI_FULL_SYNC_HOURS || 6) * 60 * 60 * 1000;

/** Product fields that feed the index — only edits to these trigger a re-index. */
export const SEARCH_INDEXED_FIELDS = [
  'nameAr', 'nameEn', 'brand', 'brandAr', 'brandEn', 'searchKeywordsAr', 'searchKeywordsEn',
  'sku', 'barcode', 'category', 'mainCategory', 'categoryAncestors', 'isActive', 'soldCount', 'rating',
];

const INDEX_SETTINGS = {
  searchableAttributes: ['nameAr', 'nameEn', 'brand', 'keywords', 'category', 'codes'],
  displayedAttributes: ['id'],
  filterableAttributes: ['isActive'],
  sortableAttributes: ['soldCount', 'rating'],
  rankingRules: ['words', 'typo', 'proximity', 'attribute', 'exactness', 'soldCount:desc', 'rating:desc'],
  typoTolerance: {
    enabled: true,
    minWordSizeForTypos: { oneTypo: 4, twoTypos: 8 },
    disableOnAttributes: ['codes'],
  },
  synonyms: buildSynonymMap(),
  pagination: { maxTotalHits: MAX_SEARCH_HITS },
};

const state = {
  client: null,
  ready: false,
  degradedUntil: 0,
  lastFullSyncAt: null,
  lastError: null,
  documents: null,
};

let fullSyncPromise = null;
let flushTimer = null;
let periodicTimer = null;
const pendingIds = new Set();
const queryCache = new Map();

export function isSearchEngineConfigured() {
  return Boolean(process.env.MEILI_HOST?.trim()) && process.env.SEARCH_ENGINE !== 'mongo';
}

function getClient() {
  if (!isSearchEngineConfigured()) return null;
  if (!state.client) {
    state.client = new Meilisearch({
      host: process.env.MEILI_HOST.trim(),
      apiKey: process.env.MEILI_API_KEY?.trim() || undefined,
      timeout: Number(process.env.MEILI_TIMEOUT_MS) || 2000,
    });
  }
  return state.client;
}

function recordFailure(context, error) {
  state.degradedUntil = Date.now() + FAILURE_COOLDOWN_MS;
  state.lastError = `${context}: ${error?.message || error}`;
  console.warn(`[search] ${state.lastError} — using MongoDB search for ${FAILURE_COOLDOWN_MS / 1000}s`);
}

/** True when queries should go to Meilisearch right now. */
export function isSearchEngineActive() {
  return Boolean(getClient()) && state.ready && Date.now() >= state.degradedUntil;
}

export function getSearchEngineStatus() {
  return {
    engine: isSearchEngineActive() ? 'meilisearch' : 'mongodb',
    configured: isSearchEngineConfigured(),
    ready: state.ready,
    index: INDEX_UID,
    documents: state.documents,
    lastFullSyncAt: state.lastFullSyncAt,
    lastError: state.lastError,
  };
}

// ── Documents ──────────────────────────────────────────────────────────────

const PRODUCT_INDEX_SELECT = SEARCH_INDEXED_FIELDS.join(' ');

async function loadCategoryNames() {
  const rows = await mongoose.model('Category').find({}).select('nameAr nameEn').lean();
  return new Map(rows.map((c) => [String(c._id), c]));
}

function joinNormalized(values) {
  const seen = new Set();
  for (const value of values.flat()) {
    const text = normalizeSearchText(value);
    if (text) seen.add(text);
  }
  return [...seen].join(' ');
}

export function toSearchDocument(product, categoryNames = new Map()) {
  const pathIds = product.categoryAncestors?.length
    ? product.categoryAncestors
    : [product.mainCategory, product.category].filter(Boolean);
  const pathCategories = pathIds.map((id) => categoryNames.get(String(id))).filter(Boolean);

  return {
    id: String(product._id),
    nameAr: normalizeSearchText(product.nameAr),
    nameEn: normalizeSearchText(product.nameEn),
    brand: joinNormalized([product.brand, product.brandAr, product.brandEn]),
    keywords: joinNormalized([product.searchKeywordsAr || [], product.searchKeywordsEn || []]),
    category: joinNormalized(pathCategories.map((c) => [c.nameAr, c.nameEn])),
    codes: [product.sku, product.barcode].filter(Boolean).join(' '),
    isActive: product.isActive !== false,
    soldCount: Number(product.soldCount) || 0,
    rating: Number(product.rating) || 0,
  };
}

// ── Full sync (build a fresh index, then atomically swap it in) ──────────────

async function indexExists(client, uid) {
  try {
    await client.getRawIndex(uid);
    return true;
  } catch (error) {
    if (error?.cause?.code === 'index_not_found' || error?.response?.status === 404) return false;
    throw error;
  }
}

async function runFullSync() {
  const client = getClient();
  const Product = mongoose.model('Product');
  const tempUid = `${INDEX_UID}_build_${Date.now()}`;
  const started = Date.now();

  await client.createIndex(tempUid, { primaryKey: 'id' }).waitTask();
  try {
    const tempIndex = client.index(tempUid);
    await tempIndex.updateSettings(INDEX_SETTINGS).waitTask();

    const categoryNames = await loadCategoryNames();
    const cursor = Product.find({}).select(PRODUCT_INDEX_SELECT).lean().cursor({ batchSize: BATCH_SIZE });
    let batch = [];
    let count = 0;
    const tasks = [];
    for await (const product of cursor) {
      batch.push(toSearchDocument(product, categoryNames));
      if (batch.length === BATCH_SIZE) {
        tasks.push(tempIndex.addDocuments(batch));
        count += batch.length;
        batch = [];
      }
    }
    if (batch.length) {
      tasks.push(tempIndex.addDocuments(batch));
      count += batch.length;
    }
    for (const task of tasks) {
      // eslint-disable-next-line no-await-in-loop
      await task.waitTask({ timeout: 120_000 });
    }

    if (!(await indexExists(client, INDEX_UID))) {
      await client.createIndex(INDEX_UID, { primaryKey: 'id' }).waitTask();
    }
    await client.swapIndexes([{ indexes: [INDEX_UID, tempUid] }]).waitTask();

    state.ready = true;
    state.documents = count;
    state.lastFullSyncAt = new Date().toISOString();
    state.lastError = null;
    queryCache.clear();
    console.log(`[search] Indexed ${count} products into "${INDEX_UID}" in ${Date.now() - started}ms`);
    return { documents: count, ms: Date.now() - started };
  } finally {
    // After the swap tempUid holds the previous index; either way it is no longer needed.
    await client.deleteIndexIfExists(tempUid).catch(() => {});
  }
}

/** Rebuild the whole index from MongoDB. Concurrent callers share one run. */
export function fullSync() {
  if (!getClient()) return Promise.resolve(null);
  if (!fullSyncPromise) {
    fullSyncPromise = runFullSync()
      .catch((error) => {
        recordFailure('full sync failed', error);
        // Never built yet (e.g. engine still booting) — keep trying every minute.
        if (!state.ready) setTimeout(() => scheduleFullSync(0), 60_000).unref?.();
        throw error;
      })
      .finally(() => { fullSyncPromise = null; });
  }
  return fullSyncPromise;
}

// ── Incremental sync (debounced, batched) ───────────────────────────────────

async function flushPendingIds() {
  flushTimer = null;
  const client = getClient();
  if (!client || !pendingIds.size) return;
  if (fullSyncPromise) await fullSyncPromise.catch(() => {});

  const ids = [...pendingIds];
  pendingIds.clear();
  try {
    const Product = mongoose.model('Product');
    const [products, categoryNames] = await Promise.all([
      Product.find({ _id: { $in: ids } }).select(PRODUCT_INDEX_SELECT).lean(),
      loadCategoryNames(),
    ]);
    const index = client.index(INDEX_UID);
    const found = new Set(products.map((p) => String(p._id)));
    const removed = ids.filter((id) => !found.has(id));

    if (products.length) await index.addDocuments(products.map((p) => toSearchDocument(p, categoryNames)));
    if (removed.length) await index.deleteDocuments(removed);
    queryCache.clear();
  } catch (error) {
    ids.forEach((id) => pendingIds.add(id));
    recordFailure('incremental sync failed', error);
    scheduleFlush(FAILURE_COOLDOWN_MS);
  }
}

function scheduleFlush(delay = SYNC_DEBOUNCE_MS) {
  if (flushTimer) return;
  flushTimer = setTimeout(() => { flushPendingIds().catch(() => {}); }, delay);
  flushTimer.unref?.();
}

/** Queue products for re-indexing (created, edited or deleted). */
export function scheduleProductSync(ids) {
  if (!isSearchEngineConfigured()) return;
  for (const id of [].concat(ids || [])) {
    if (id) pendingIds.add(String(id));
  }
  if (pendingIds.size) scheduleFlush();
}

let fullSyncTimer = null;
/** Bulk writes with no cheap id list (updateMany, deleteMany, category renames). */
export function scheduleFullSync(delay = 5000) {
  if (!isSearchEngineConfigured() || fullSyncTimer) return;
  fullSyncTimer = setTimeout(() => {
    fullSyncTimer = null;
    fullSync().catch(() => {});
  }, delay);
  fullSyncTimer.unref?.();
}

// ── Query ───────────────────────────────────────────────────────────────────

/**
 * Ranked ObjectIds of active products matching `q`, best first; `null` when the engine
 * is off or failing so callers fall back to MongoDB.
 */
export async function searchProductIds(q) {
  if (!isSearchEngineActive()) return null;
  const normalized = normalizeSearchText(q);
  if (!normalized) return null;

  const cached = queryCache.get(normalized);
  if (cached && Date.now() - cached.at < QUERY_CACHE_TTL_MS) return cached.ids;

  try {
    const result = await getClient().index(INDEX_UID).search(normalized, {
      filter: 'isActive = true',
      limit: MAX_SEARCH_HITS,
      attributesToRetrieve: ['id'],
    });
    // ObjectIds, not strings: aggregate() $match does not cast like find() does.
    const ids = result.hits.map((hit) => new mongoose.Types.ObjectId(hit.id));
    if (queryCache.size >= QUERY_CACHE_MAX) queryCache.delete(queryCache.keys().next().value);
    queryCache.set(normalized, { ids, at: Date.now() });
    return ids;
  } catch (error) {
    recordFailure('query failed', error);
    return null;
  }
}

// ── Startup ─────────────────────────────────────────────────────────────────

/** Connect, serve the existing index immediately if it has data, and rebuild in the background. */
export async function startSearchIndexing() {
  const client = getClient();
  if (!client) {
    console.log('[search] MEILI_HOST not set — product search uses MongoDB');
    return;
  }
  try {
    await client.health();
    if (await indexExists(client, INDEX_UID)) {
      const stats = await client.index(INDEX_UID).getStats();
      state.documents = stats.numberOfDocuments;
      state.ready = stats.numberOfDocuments > 0;
    }
    console.log(`[search] Meilisearch connected (${state.documents ?? 0} products indexed) — rebuilding index`);
  } catch (error) {
    recordFailure('Meilisearch unreachable at startup', error);
  }

  fullSync().catch(() => {});
  if (PERIODIC_SYNC_MS > 0 && !periodicTimer) {
    periodicTimer = setInterval(() => { fullSync().catch(() => {}); }, PERIODIC_SYNC_MS);
    periodicTimer.unref?.();
  }
}
