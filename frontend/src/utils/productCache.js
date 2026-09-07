const CACHE_TTL_MS = 5 * 60 * 1000;

const cache = new Map();
const inflight = new Map();

function entryKey(slug) {
  return String(slug || '').trim().toLowerCase();
}

function isFresh(entry) {
  return entry && Date.now() - entry.at < CACHE_TTL_MS;
}

export function getCachedProduct(slug) {
  const entry = cache.get(entryKey(slug));
  return isFresh(entry) ? entry.data : null;
}

export function setCachedProduct(slug, data) {
  if (!slug || !data) return;
  cache.set(entryKey(slug), { data, at: Date.now() });
}

export function seedProductCache(product) {
  if (!product?.slug) return;
  const key = entryKey(product.slug);
  const existing = cache.get(key);
  if (!existing || !isFresh(existing)) {
    cache.set(key, { data: product, at: Date.now() });
    return;
  }
  cache.set(key, {
    data: { ...existing.data, ...product },
    at: existing.at,
  });
}

export function seedProductListCache(products = []) {
  products.forEach(seedProductCache);
}

function preloadProductImage(product) {
  const src = product?.images?.[0] || product?.image;
  if (!src || typeof src !== 'string' || !/^https?:\/\//i.test(src)) return;
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
}

export function trackProductInflight(slug, promise) {
  const key = entryKey(slug);
  if (!key) return promise;
  inflight.set(key, promise);
  promise.finally(() => {
    if (inflight.get(key) === promise) inflight.delete(key);
  });
  return promise;
}

export function getInflightProduct(slug) {
  return inflight.get(entryKey(slug)) || null;
}

export function finalizeProductFetch(slug, data) {
  if (data) {
    setCachedProduct(slug, data);
    preloadProductImage(data);
  }
  return data;
}
