import api from './api';
import { CATEGORIES, PRODUCTS } from '../data/mockData';
import { filterProductsMock } from '../utils/productHelpers';
import { SEARCH_SUGGESTION_LIMIT, SEARCH_CATEGORY_LIMIT, POPULAR_SEARCHES } from '../utils/searchConstants';
import { getSearchSessionId } from '../utils/searchSession';

const useApi = import.meta.env.VITE_USE_API !== 'false';
const MIN_TRACKED_SEARCH_LENGTH = 3;

function matchCategoryText(text, q) {
  if (!text || !q) return false;
  return text.toLowerCase().includes(q.toLowerCase()) || text.includes(q);
}

function buildMockCategoryPath(cat) {
  const chain = [cat];
  let parentSlug = cat.parentSlug;
  while (parentSlug) {
    const parent = CATEGORIES.find((c) => c.slug === parentSlug);
    if (!parent) break;
    chain.unshift(parent);
    parentSlug = parent.parentSlug;
  }
  return chain;
}

function filterCategoriesMock(categories, q) {
  return categories
    .filter((cat) => {
      const chain = buildMockCategoryPath(cat);
      const pathAr = chain.map((c) => c.nameAr || c.name).filter(Boolean).join(' ');
      const pathEn = chain.map((c) => c.nameEn).filter(Boolean).join(' ');
      return (
        matchCategoryText(cat.nameAr || cat.name, q)
        || matchCategoryText(cat.nameEn, q)
        || matchCategoryText(cat.slug, q)
        || matchCategoryText(pathAr, q)
        || matchCategoryText(pathEn, q)
      );
    })
    .slice(0, SEARCH_CATEGORY_LIMIT)
    .map((cat) => {
      const chain = buildMockCategoryPath(cat);
      return {
        slug: cat.slug,
        nameAr: chain.map((c) => c.nameAr || c.name).filter(Boolean).join(' › '),
        nameEn: chain.map((c) => c.nameEn).filter(Boolean).join(' › '),
        icon: cat.icon,
        image: cat.image,
      };
    });
}

function fuzzyMatch(text, q) {
  if (!text || !q) return false;
  const lower = text.toLowerCase();
  const query = q.toLowerCase();
  if (lower.includes(query)) return true;
  // Simple typo tolerance: allow one missing char in short queries
  if (query.length >= 3) {
    for (let i = 0; i < query.length; i += 1) {
      const partial = query.slice(0, i) + query.slice(i + 1);
      if (partial.length >= 2 && lower.includes(partial)) return true;
    }
  }
  return false;
}

function filterProductsFuzzy(products, q) {
  return products.filter(
    (p) =>
      fuzzyMatch(p.name, q)
      || fuzzyMatch(p.nameEn, q)
      || fuzzyMatch(p.slug, q)
      || fuzzyMatch(p.brand, q),
  );
}

/**
 * Live search suggestions: products + matching categories (typo-tolerant via API).
 */
export async function fetchSearchSuggestions(query, category = '') {
  const q = query?.trim();
  if (!q || q.length < 2) {
    return { products: [], categories: [], totalProducts: 0 };
  }

  if (useApi) {
    try {
      const { data } = await api.get('/search/suggestions', {
        params: {
          q,
          category: category && category !== 'all' ? category : undefined,
          limit: SEARCH_SUGGESTION_LIMIT,
          categoryLimit: SEARCH_CATEGORY_LIMIT,
        },
      });
      return data.data;
    } catch {
      // fall through to mock
    }
  }

  const res = filterProductsMock(PRODUCTS, { q, page: 1, limit: SEARCH_SUGGESTION_LIMIT });
  const fuzzy = filterProductsFuzzy(PRODUCTS, q);
  const merged = [...new Map([...res.data, ...fuzzy].map((p) => [p._id || p.slug, p])).values()]
    .slice(0, SEARCH_SUGGESTION_LIMIT);

  return {
    products: merged.length ? merged : res.data,
    categories: filterCategoriesMock(CATEGORIES, q),
    totalProducts: res.pagination?.total ?? merged.length,
  };
}

export async function fetchTrendingSearches(limit = 8) {
  if (useApi) {
    try {
      const { data } = await api.get('/search/trending', { params: { limit, days: 7 } });
      if (Array.isArray(data.data)) return data.data;
    } catch {
      // fall through
    }
  }
  return POPULAR_SEARCHES.slice(0, limit);
}

export async function trackSearchEvent({ query, resultCount, source = 'search' }) {
  const trimmed = query?.trim();
  if (!trimmed || Array.from(trimmed).length < MIN_TRACKED_SEARCH_LENGTH || !useApi) return null;

  try {
    const { data } = await api.post('/search/track', {
      query: trimmed,
      resultCount,
      sessionId: getSearchSessionId(),
      source,
    });
    return data.data;
  } catch {
    return null;
  }
}

export async function trackSearchConversion(query) {
  if (!useApi) return;
  try {
    await api.post('/search/convert', {
      sessionId: getSearchSessionId(),
      query: query?.trim() || undefined,
    });
  } catch {
    // non-blocking
  }
}

export function buildSearchResultsUrl(query, category = '', extra = {}) {
  const params = new URLSearchParams();
  if (query?.trim()) params.set('q', query.trim());
  if (category && category !== 'all') params.set('category', category);
  Object.entries(extra).forEach(([k, v]) => {
    if (v) params.set(k, String(v));
  });
  const qs = params.toString();
  return qs ? `/search/results?${qs}` : '/search/results';
}

/** Search term used when a customer clicks a trending chip. */
export function resolveTrendingSearchTerm(item, isAr = true) {
  if (!item) return '';
  const query = String(item.query || '').trim();
  if (query) return query;
  const label = isAr
    ? String(item.labelAr || item.labelEn || '').trim()
    : String(item.labelEn || item.labelAr || '').trim();
  return label;
}

export async function fetchSearchAnalytics(params = {}) {
  const { data } = await api.get('/search/admin/analytics', { params });
  return data.data;
}
