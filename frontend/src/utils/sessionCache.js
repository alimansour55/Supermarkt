const DEFAULT_TTL_MS = 5 * 60 * 1000;

export function readSessionCache(key, ttlMs = DEFAULT_TTL_MS) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (!entry?.data || Date.now() - entry.at > ttlMs) {
      sessionStorage.removeItem(key);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

export function writeSessionCache(key, data) {
  if (typeof window === 'undefined' || data == null) return;
  try {
    sessionStorage.setItem(key, JSON.stringify({ data, at: Date.now() }));
  } catch {
    // quota exceeded — ignore
  }
}

export function clearSessionCache(key) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}
