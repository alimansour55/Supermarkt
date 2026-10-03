import { useCallback, useRef } from 'react';

/**
 * Lets a page skip client fetches for data the SSR loader already rendered.
 * `seedKey` identifies what the loader fetched (e.g. paramsKey(apiParams)).
 * `isSeeded(key)` is true while `key` still equals it; the first different key
 * (the user changed filters/page) clears the seed for good.
 */
export function useSsrSeed(seedKey) {
  const pending = useRef(seedKey ?? null);
  return useCallback((key) => {
    if (pending.current !== null && pending.current === key) return true;
    pending.current = null;
    return false;
  }, []);
}
