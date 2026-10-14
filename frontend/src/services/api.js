import axios from 'axios';
import { Capacitor } from '@capacitor/core';
import { API_URL, STORAGE_KEYS } from '../utils/constants';
import { getAlternateApiBaseUrl, getApiCandidates } from '../utils/resolveApiBaseUrl';

/**
 * Web: the session lives in an httpOnly cookie the page can't read (safe from XSS).
 * Native (Capacitor) apps can't rely on cross-site cookies, so they keep a bearer token.
 */
export const usesBearerToken = Capacitor.isNativePlatform();

function readToken() {
  try {
    const fromLocal = localStorage.getItem(STORAGE_KEYS.TOKEN);
    if (fromLocal) return fromLocal.replace(/^"|"$/g, '');
  } catch {
    // ignore
  }
  try {
    const fromSession = sessionStorage.getItem(STORAGE_KEYS.TOKEN);
    if (fromSession) return fromSession.replace(/^"|"$/g, '');
  } catch {
    // ignore
  }
  return null;
}

const api = axios.create({
  baseURL: API_URL,
  headers: {
    Accept: 'application/json',
    // Required by the API for cookie-authenticated writes (CSRF guard).
    'X-Requested-With': 'XMLHttpRequest',
    'X-Auth-Transport': usesBearerToken ? 'bearer' : 'cookie',
  },
  withCredentials: true,
  timeout: 25_000,
});

api.interceptors.request.use((config) => {
  const isFormData = typeof FormData !== 'undefined' && config.data instanceof FormData;
  if (isFormData) {
    delete config.headers['Content-Type'];
  } else if (!config.headers['Content-Type'] && config.method && config.method.toLowerCase() !== 'get') {
    config.headers['Content-Type'] = 'application/json';
  }

  const token = readToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    const isNetworkError = !error.response && (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error'));

    if (isNetworkError && config && !config.__apiRetry) {
      const tried = config.__triedBases || [api.defaults.baseURL];
      const next = getApiCandidates().find((base) => !tried.includes(base))
        || getAlternateApiBaseUrl(api.defaults.baseURL);

      if (next && !tried.includes(next)) {
        config.__apiRetry = true;
        config.__triedBases = [...tried, next];
        config.baseURL = next;
        api.defaults.baseURL = next;
        return api.request(config);
      }
    }

    if (error.response?.status === 401) {
      try { localStorage.removeItem(STORAGE_KEYS.TOKEN); } catch { /* ignore */ }
      try { sessionStorage.removeItem(STORAGE_KEYS.TOKEN); } catch { /* ignore */ }
      try { localStorage.removeItem(STORAGE_KEYS.SESSION_HINT); } catch { /* ignore */ }
    }
    return Promise.reject(error);
  },
);

export default api;
