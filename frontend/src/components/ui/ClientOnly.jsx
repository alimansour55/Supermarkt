import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/** True once running in the browser after hydration; false during SSR and the hydration pass. */
export function useHydrated() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

/**
 * Renders `children` only in the browser. Use for widgets that touch `window`
 * at import or render time (maps, geolocation…). `children` may be a function
 * so the browser-only tree isn't even created on the server.
 */
export default function ClientOnly({ children, fallback = null }) {
  const hydrated = useHydrated();
  if (!hydrated) return fallback;
  return typeof children === 'function' ? children() : children;
}
