import { STORAGE_KEYS } from './constants';
import { MAX_RECENT_SEARCHES } from './searchConstants';

export function getRecentSearches() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.RECENT_SEARCHES);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((s) => typeof s === 'string' && s.trim()) : [];
  } catch {
    return [];
  }
}

export function addRecentSearch(query) {
  const trimmed = query?.trim();
  if (!trimmed || trimmed.length < 2) return;
  const prev = getRecentSearches().filter((s) => s.toLowerCase() !== trimmed.toLowerCase());
  const next = [trimmed, ...prev].slice(0, MAX_RECENT_SEARCHES);
  localStorage.setItem(STORAGE_KEYS.RECENT_SEARCHES, JSON.stringify(next));
}

export function clearRecentSearches() {
  localStorage.removeItem(STORAGE_KEYS.RECENT_SEARCHES);
}
