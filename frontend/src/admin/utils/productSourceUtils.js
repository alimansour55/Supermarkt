import { buildAdminProductCategoryQuery } from './adminCategoryFilter';

export const PRODUCT_LIMIT_PRESETS = [4, 6, 8, 12, 16, 24];

export const PRODUCT_SOURCE_MODES = [
  {
    value: 'auto',
    labelAr: 'تلقائي',
    labelEn: 'Automatic',
    hintAr: 'ملء القسم من الفلاتر أدناه',
    hintEn: 'Fill the section from filters below',
  },
  {
    value: 'manual',
    labelAr: 'يدوي',
    labelEn: 'Hand-picked',
    hintAr: 'اختر منتجات محددة — تتجاوز الفلاتر',
    hintEn: 'Pick specific products — overrides filters',
  },
];

export function normalizeProductLimit(value, fallback = 12) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(24, Math.max(1, Math.round(n)));
}

export function resolveProductSourceMode(form) {
  return form?.products?.length > 0 ? 'manual' : 'auto';
}

export function buildProductSuggestionParams(productQuery = {}, { categories = [], categoryId = '' } = {}) {
  const limit = normalizeProductLimit(productQuery.limit, 12);
  const params = {
    sort: productQuery.sort || 'newest',
    limit,
    page: 1,
    isActive: 'true',
  };
  if (productQuery.section) params.section = productQuery.section;
  if (productQuery.brand?.trim()) params.brand = productQuery.brand.trim();
  if (productQuery.offers) params.offers = 'true';
  Object.assign(params, buildAdminProductCategoryQuery(categories, categoryId));
  return params;
}

/** Params for section preview — small sample page with full total from pagination. */
export function buildSectionProductPreviewParams(
  productQuery = {},
  { categories = [], categoryId = '', sampleSize = 6 } = {},
) {
  return {
    ...buildProductSuggestionParams(
      { ...productQuery, limit: sampleSize },
      { categories, categoryId },
    ),
    page: 1,
    limit: sampleSize,
  };
}

export function productDisplayName(product, isAr) {
  if (!product) return '';
  return isAr
    ? (product.nameAr || product.name || product.nameEn)
    : (product.nameEn || product.name || product.nameAr);
}
