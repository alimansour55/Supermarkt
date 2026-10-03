/**
 * Hydration flag shared by hooks that read browser storage.
 *
 * During SSR and the first (hydration) render in the browser, components must render
 * exactly what the server rendered — so they start from defaults / loader data and only
 * read localStorage/sessionStorage in an effect afterwards. Once the root has hydrated,
 * components mounted later (client navigations) can read storage synchronously.
 */
let hydrated = false;

export function isHydrating() {
  return typeof window === 'undefined' || !hydrated;
}

export function markHydrated() {
  hydrated = true;
}
