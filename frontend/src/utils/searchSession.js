const SESSION_KEY = 'search_session_id';
const LAST_QUERY_KEY = 'search_last_query';

function randomId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getSearchSessionId() {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = randomId();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return randomId();
  }
}

export function setLastSearchQuery(query) {
  const trimmed = query?.trim();
  if (!trimmed) return;
  try {
    sessionStorage.setItem(LAST_QUERY_KEY, trimmed);
  } catch {
    // ignore
  }
}

export function getLastSearchQuery() {
  try {
    return sessionStorage.getItem(LAST_QUERY_KEY) || '';
  } catch {
    return '';
  }
}

export function clearLastSearchQuery() {
  try {
    sessionStorage.removeItem(LAST_QUERY_KEY);
  } catch {
    // ignore
  }
}

/** Re-export recent searches from localStorage */
export { getRecentSearches, addRecentSearch, clearRecentSearches } from './searchStorage';
