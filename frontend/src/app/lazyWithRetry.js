import { lazy } from 'react';

/**
 * `lazy()` wrapper that survives a stale chunk URL. When Vite re-optimizes deps
 * mid-session (dev) or a new build ships while a tab is open (prod), the old
 * hashed chunk 404s/504s and the dynamic import rejects — with no error boundary
 * that blanks the whole app. Here we reload the page once so the browser fetches
 * the current chunk graph; a per-key sessionStorage flag stops a reload loop if
 * the import is genuinely broken.
 */
export function lazyWithRetry(factory, key) {
  return lazy(() =>
    factory().catch((err) => {
      const flag = `chunk-retry:${key}`;
      let alreadyRetried = false;
      try {
        alreadyRetried = sessionStorage.getItem(flag) === '1';
      } catch {
        // sessionStorage unavailable (private mode) — fall through and rethrow.
      }
      if (!alreadyRetried) {
        try {
          sessionStorage.setItem(flag, '1');
        } catch {
          // ignore
        }
        window.location.reload();
        // Return a never-resolving promise so React keeps the fallback shown
        // until the reload takes over.
        return new Promise(() => {});
      }
      throw err;
    }),
  );
}

/** Clear the retry flags once a navigation has loaded cleanly. */
export function clearChunkRetryFlags() {
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i -= 1) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith('chunk-retry:')) sessionStorage.removeItem(k);
    }
  } catch {
    // ignore
  }
}
