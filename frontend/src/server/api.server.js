/**
 * Server-only API client used by route loaders during SSR.
 * (`.server` modules are never bundled for the browser.)
 *
 * Env:
 *   API_INTERNAL_URL  base URL of the Express API as seen from the SSR server
 *                     (default http://127.0.0.1:5001/api)
 */
const API_BASE = (process.env.API_INTERNAL_URL || 'http://127.0.0.1:5001/api').replace(/\/$/, '');
const DEFAULT_TIMEOUT_MS = 8000;

/** Short-lived in-process cache for public, non-personal data (settings, category tree…). */
const cache = new Map();
const MAX_CACHE_ENTRIES = 500;

function buildUrl(path, params) {
  const url = new URL(`${API_BASE}${path.startsWith('/') ? path : `/${path}`}`);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    url.searchParams.set(key, String(value));
  });
  return url.toString();
}

/**
 * GET an API path and return the parsed JSON body.
 * Returns `null` on 404 so loaders can turn it into a proper 404 page.
 */
export async function apiGet(path, { params, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const res = await fetch(buildUrl(path, params), {
    headers: { Accept: 'application/json', 'X-Requested-By': 'storefront-ssr' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`API ${res.status} for GET ${path}`);
  }
  return res.json();
}

/**
 * Cached GET for public data. Serves a fresh entry from memory; when it has expired
 * the stale copy is returned immediately and refreshed in the background.
 */
export async function apiGetCached(path, { params, ttlMs = 60_000, timeoutMs } = {}) {
  const key = buildUrl(path, params);
  const entry = cache.get(key);
  const now = Date.now();

  const refresh = () => {
    const pending = apiGet(path, { params, timeoutMs }).then((body) => {
      if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value);
      cache.set(key, { body, at: Date.now(), pending: null });
      return body;
    });
    if (entry) entry.pending = pending;
    return pending;
  };

  if (entry && now - entry.at < ttlMs) return entry.body;
  if (entry) {
    if (!entry.pending) refresh().catch(() => { entry.pending = null; });
    return entry.body;
  }
  return refresh();
}

/** Like apiGet/apiGetCached but never throws — returns `fallback` on any error. */
export async function apiGetSafe(path, { fallback = null, cached = false, ...options } = {}) {
  try {
    const body = cached ? await apiGetCached(path, options) : await apiGet(path, options);
    return body ?? fallback;
  } catch (error) {
    console.error(`[ssr] ${error.message}`);
    return fallback;
  }
}
