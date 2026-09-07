import api from '../services/api';
import { probeApiBaseUrl } from './resolveApiBaseUrl';

let initPromise = null;

/** Detect working API route before the app loads (mobile LAN / proxy fallback). */
export function initApiConnection() {
  if (typeof window === 'undefined') return Promise.resolve(null);

  const shouldProbe = import.meta.env.DEV
    || /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(window.location.hostname);

  if (!shouldProbe) return Promise.resolve(api.defaults.baseURL);

  if (!initPromise) {
    initPromise = probeApiBaseUrl().then((baseUrl) => {
      api.defaults.baseURL = baseUrl;
      return baseUrl;
    });
  }

  return initPromise;
}
