import { useEffect } from 'react';

/**
 * Warns before a reload / tab close while `when` is true.
 * In-app navigation is not covered: the app uses <BrowserRouter>, which has no
 * navigation blocker — guard explicit exits (e.g. Cancel) with a confirm instead.
 */
export function useUnsavedChangesGuard(when) {
  useEffect(() => {
    if (!when) return undefined;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [when]);
}
