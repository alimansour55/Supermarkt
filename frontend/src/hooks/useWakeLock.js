import { useEffect, useRef, useState } from 'react';

/**
 * Keep the screen awake while `active` is true (e.g. a driver mid-delivery).
 * Re-acquires the lock when the tab becomes visible again (browsers drop it on hide).
 * Returns whether the Screen Wake Lock API is supported.
 */
export function useWakeLock(active) {
  const [supported] = useState(
    () => typeof navigator !== 'undefined' && 'wakeLock' in navigator,
  );
  const lockRef = useRef(null);

  useEffect(() => {
    if (!supported || !active) return undefined;
    let cancelled = false;

    const request = async () => {
      if (cancelled || lockRef.current) return;
      try {
        lockRef.current = await navigator.wakeLock.request('screen');
        lockRef.current.addEventListener?.('release', () => {
          lockRef.current = null;
        });
      } catch {
        // Denied, low battery, or not allowed — fail silently.
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') request();
    };

    request();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      lockRef.current?.release?.().catch(() => {});
      lockRef.current = null;
    };
  }, [supported, active]);

  return supported;
}
