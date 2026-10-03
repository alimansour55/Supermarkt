/**
 * Listing-page filter defaults/params shared by the pages (browser) and their SSR loaders,
 * so the server fetches exactly what the page would fetch on mount.
 */
import { paramsToProductFilters, productFiltersToApiParams } from './productFilterParams';

/** Stable identity for a set of API params (empty values ignored). */
export function paramsKey(params = {}) {
  return JSON.stringify(
    Object.entries(params)
      .filter(([, value]) => value !== '' && value !== null && value !== undefined)
      .map(([key, value]) => [key, String(value)])
      .sort(([a], [b]) => a.localeCompare(b)),
  );
}

// ── /products ───────────────────────────────────────────────────────────
export function productListingApiParams(searchParams) {
  return productFiltersToApiParams(paramsToProductFilters(searchParams));
}

// ── /offers ─────────────────────────────────────────────────────────────
export const DEFAULT_OFFERS_FILTERS = {
  mainCategory: '',
  subCategory: '',
  brand: '',
  minPrice: '',
  maxPrice: '',
  minRating: '',
  offers: 'true',
  inStock: '',
  sort: 'discount',
  q: '',
  page: 1,
};

export function offersFiltersFromSearch(searchParams) {
  const fromUrl = paramsToProductFilters(searchParams);
  return {
    ...DEFAULT_OFFERS_FILTERS,
    ...fromUrl,
    offers: 'true',
    sort: fromUrl.sort || DEFAULT_OFFERS_FILTERS.sort,
  };
}

export function offersApiParams(filters) {
  return { ...productFiltersToApiParams(filters), offers: 'true' };
}

// ── /today-deals ────────────────────────────────────────────────────────
export const TODAYS_DEALS_DEFAULT_SORT = 'discount';
export const TODAYS_DEALS_PAGE_SIZE = 24;

export function parsePage(value) {
  const page = Number(value) || 1;
  return page < 1 ? 1 : page;
}

export function todaysDealsApiParams({ page = 1, sort = TODAYS_DEALS_DEFAULT_SORT } = {}) {
  return { page, limit: TODAYS_DEALS_PAGE_SIZE, sort, limitedTime: 'true' };
}

// ── /category/* ─────────────────────────────────────────────────────────
export const DEFAULT_CATEGORY_FILTERS = {
  productSource: '',
  brand: '',
  minPrice: '',
  maxPrice: '',
  minRating: '',
  offers: '',
  inStock: '',
  sort: '',
  page: 1,
};

export function categoryFiltersFromSearch(params) {
  return {
    productSource: params.get('productSource') || '',
    brand: params.get('brand') || '',
    minPrice: params.get('minPrice') || '',
    maxPrice: params.get('maxPrice') || '',
    minRating: params.get('minRating') || '',
    offers: params.get('offers') || '',
    inStock: params.get('inStock') || '',
    sort: params.get('sort') || '',
    page: Number(params.get('page')) || 1,
  };
}

/** Normalizes GET /categories/browse/:path (same shape as productApi.fetchCategoryBrowse). */
export function normalizeCategoryBrowse(data) {
  return {
    slugPath: data.slugPath,
    canonicalSlugPath: data.canonicalSlugPath || data.slugPath,
    redirectTo: data.redirectTo || null,
    chain: data.chain || [],
    category: data.category,
    main: data.main,
    children: data.children || [],
    isLeaf: data.isLeaf,
  };
}

export function cleanSlugPath(value) {
  return String(value || '').replace(/^\/+|\/+$/g, '');
}
