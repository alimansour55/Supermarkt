import { fetchProductsPaginated, fetchCategories } from './productApi';
import { CATEGORIES, PRODUCTS } from '../data/mockData';
import { filterProductsMock } from '../utils/productHelpers';
import { SEARCH_SUGGESTION_LIMIT, SEARCH_CATEGORY_LIMIT } from '../utils/searchConstants';

function matchCategory(cat, q) {
  const lower = q.toLowerCase();
  return (
    cat.nameAr?.includes(q)
    || cat.nameEn?.toLowerCase().includes(lower)
    || cat.slug?.includes(lower)
  );
}

function filterCategoriesMock(categories, q) {
  return categories.filter((cat) => matchCategory(cat, q)).slice(0, SEARCH_CATEGORY_LIMIT);
}

/**
 * Live search suggestions: products + matching categories.
 */
export async function fetchSearchSuggestions(query) {
  const q = query?.trim();
  if (!q || q.length < 2) {
    return { products: [], categories: [], totalProducts: 0 };
  }

  try {
    const [productRes, categories] = await Promise.all([
      fetchProductsPaginated({ q, page: 1, limit: SEARCH_SUGGESTION_LIMIT }),
      fetchCategories(),
    ]);
    const cats = (categories || CATEGORIES).filter((cat) => matchCategory(cat, q)).slice(0, SEARCH_CATEGORY_LIMIT);
    return {
      products: productRes.data || [],
      categories: cats,
      totalProducts: productRes.pagination?.total ?? productRes.data?.length ?? 0,
    };
  } catch {
    const res = filterProductsMock(PRODUCTS, { q, page: 1, limit: SEARCH_SUGGESTION_LIMIT });
    return {
      products: res.data,
      categories: filterCategoriesMock(CATEGORIES, q),
      totalProducts: res.pagination?.total ?? res.data.length,
    };
  }
}

export function buildSearchResultsUrl(query, category = '') {
  const params = new URLSearchParams();
  if (query?.trim()) params.set('q', query.trim());
  if (category && category !== 'all') params.set('category', category);
  const qs = params.toString();
  return qs ? `/search/results?${qs}` : '/search/results';
}
