import { useEffect, useState } from 'react';

/**
 * Tracks the browser's geolocation permission state and reacts live when the
 * user flips it from the browser/OS settings — no page reload needed. Only
 * Chromium-based browsers currently fire `PermissionStatus.onchange`; Safari
 * (desktop + iOS) has no Permissions API for geolocation, so it always
 * reports 'unsupported' and callers must fall back to trying the request and
 * reading the error.
 */
export function useGeolocationPermission() {
  const [state, setState] = useState('unsupported');

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) return undefined;

    let status;
    let cancelled = false;

    navigator.permissions.query({ name: 'geolocation' }).then((result) => {
      if (cancelled) return;
      status = result;
      setState(result.state);
      result.onchange = () => setState(result.state);
    }).catch(() => {});

    return () => {
      cancelled = true;
      if (status) status.onchange = null;
    };
  }, []);

  return state;
}
