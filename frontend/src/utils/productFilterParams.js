export const DEFAULT_PRODUCT_FILTERS = {
  mainCategory: '',
  subCategory: '',
  productSource: '',
  brand: '',
  minPrice: '',
  maxPrice: '',
  minRating: '',
  minDiscount: '',
  offers: '',
  inStock: '',
  sort: '',
  q: '',
  page: 1,
};

export function paramsToProductFilters(params) {
  let mainCategory = params.get('mainCategory') || params.get('main') || '';
  let subCategory = params.get('subCategory') || params.get('sub') || '';
  const legacyCategory = params.get('category') || '';

  if (legacyCategory && !subCategory) {
    subCategory = legacyCategory;
  }

  return {
    mainCategory,
    subCategory,
    productSource: params.get('productSource') || '',
    brand: params.get('brand') || '',
    minPrice: params.get('minPrice') || '',
    maxPrice: params.get('maxPrice') || '',
    minRating: params.get('minRating') || '',
    minDiscount: params.get('minDiscount') || '',
    offers: params.get('offers') || '',
    inStock: params.get('inStock') || '',
    sort: params.get('sort') || '',
    q: params.get('q') || '',
    page: Number(params.get('page')) || 1,
  };
}

export function productFiltersToParams(filters) {
  const p = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (!v && v !== 0) return;
    if (k === 'page' && Number(v) === 1) return;
    p.set(k, String(v));
  });
  return p;
}

export function productFiltersToApiParams(filters) {
  const { page, ...rest } = filters;
  const params = { ...rest, page };
  if (rest.category) delete params.category;
  return params;
}

export function countActiveProductFilters(filters, { excludeKeys = ['sort', 'page', 'q'] } = {}) {
  return Object.entries(filters).filter(([k, v]) => {
    if (excludeKeys.includes(k)) return false;
    return Boolean(v);
  }).length;
}
