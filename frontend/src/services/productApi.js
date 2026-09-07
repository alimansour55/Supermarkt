import { productService, categoryService } from './apiServices';
import {
  finalizeProductFetch,
  getCachedProduct,
  getInflightProduct,
  seedProductListCache,
  trackProductInflight,
} from '../utils/productCache';
import {
  PRODUCTS,
  CATEGORIES,
  getProductsByCategory as mockProductsByCategory,
  getOfferProducts as mockOffers,
  getProductBySlug as mockBySlug,
  getCategoryBySlug as mockCategoryBySlug,
  getSubcategoriesMock,
  getParentCategoryMock,
} from '../data/mockData';
import { filterProductsMock, buildMockProductFilters } from '../utils/productHelpers';

const useApi = import.meta.env.VITE_USE_API !== 'false';

async function tryApi(fn, fallback) {
  if (!useApi) return fallback();
  try {
    return await fn();
  } catch {
    return fallback();
  }
}

export async function fetchProductFilters(params = {}) {
  return tryApi(
    async () => {
      const { data } = await productService.getFilters(params);
      return data;
    },
    () => buildMockProductFilters(PRODUCTS, CATEGORIES, params),
  );
}

export async function fetchProductsPaginated(params = {}) {
  const res = await tryApi(
    async () => {
      const { data } = await productService.getAll(params);
      return { data: data.data, pagination: data.pagination };
    },
    () => filterProductsMock(PRODUCTS, params),
  );
  seedProductListCache(res.data);
  return res;
}

export async function fetchProductsByIds(ids = []) {
  const normalizedIds = [...new Set((Array.isArray(ids) ? ids : []).map(String).filter(Boolean))];
  if (!normalizedIds.length) return [];

  return tryApi(
    async () => {
      const { data } = await productService.getByIds(normalizedIds);
      const products = data.data || [];
      const order = new Map(normalizedIds.map((id, index) => [id, index]));
      return [...products].sort(
        (a, b) => (order.get(String(a._id)) ?? 0) - (order.get(String(b._id)) ?? 0),
      );
    },
    () => {
      const idSet = new Set(normalizedIds);
      return PRODUCTS.filter((product) => idSet.has(String(product._id)));
    },
  );
}

export async function fetchCategories(params = {}) {
  return tryApi(
    async () => {
      const { data } = await categoryService.getAll(params);
      return data.data;
    },
    () => CATEGORIES,
  );
}

export async function fetchMainCategories() {
  return tryApi(
    async () => {
      const { data } = await categoryService.getMain();
      return data.data;
    },
    () => CATEGORIES.filter((c) => !c.parentSlug),
  );
}

export async function fetchCategoryTree() {
  return tryApi(
    async () => {
      const { data } = await categoryService.getTree();
      return data.data;
    },
    () => {
      const roots = CATEGORIES.filter((c) => !c.parentSlug);
      return roots.map((main) => ({
        ...main,
        level: 1,
        children: CATEGORIES.filter((c) => c.parentSlug === main.slug).map((sub) => ({ ...sub, level: 2 })),
      }));
    },
  );
}

export async function fetchSubcategories(mainSlug) {
  return tryApi(
    async () => {
      const { data } = await categoryService.getSubcategories(mainSlug);
      return { main: data.main, subcategories: data.data };
    },
    () => {
      const main = mockCategoryBySlug(mainSlug);
      return {
        main,
        subcategories: getSubcategoriesMock(mainSlug),
      };
    },
  );
}

export async function fetchCategoryBrowse(slugPath) {
  const path = String(slugPath || '').replace(/^\/+|\/+$/g, '');
  return tryApi(
    async () => {
      const { data } = await categoryService.getBrowse(path);
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
    },
    () => {
      const segments = path.split('/').filter(Boolean);
      const last = segments[segments.length - 1];
      const category = mockCategoryBySlug(last);
      return {
        slugPath: path,
        chain: segments.map((s) => mockCategoryBySlug(s)).filter(Boolean),
        category,
        main: mockCategoryBySlug(segments[0]),
        children: getSubcategoriesMock(last),
        isLeaf: !getSubcategoriesMock(last)?.length,
      };
    },
  );
}

export async function fetchCategorySlugPath(slug) {
  return tryApi(
    async () => {
      const { data } = await categoryService.getSlugPath(slug);
      return { slugPath: data.slugPath, chain: data.chain || [] };
    },
    () => ({ slugPath: slug, chain: [mockCategoryBySlug(slug)].filter(Boolean) }),
  );
}

export async function fetchProductsByCategoryPath(slugPath, params = {}) {
  const path = String(slugPath || '').replace(/^\/+|\/+$/g, '');
  return tryApi(
    async () => {
      const { data } = await productService.getByCategoryPath(path, params);
      return {
        slugPath: data.slugPath,
        chain: data.chain || [],
        mainCategory: data.mainCategory,
        category: data.category,
        parentCategory: data.parentCategory || null,
        subcategories: data.subcategories || [],
        categoryType: data.categoryType || 'leaf',
        products: data.data,
        pagination: data.pagination,
      };
    },
    () => {
      const segments = path.split('/').filter(Boolean);
      const last = segments[segments.length - 1];
      const category = mockCategoryBySlug(last);
      const products = mockProductsByCategory(last);
      const filtered = filterProductsMock(products, params);
      return {
        slugPath: path,
        chain: segments.map((s) => mockCategoryBySlug(s)).filter(Boolean),
        mainCategory: mockCategoryBySlug(segments[0]),
        category,
        parentCategory: segments.length > 1 ? mockCategoryBySlug(segments[segments.length - 2]) : null,
        subcategories: getSubcategoriesMock(segments[segments.length - 2] || segments[0]),
        categoryType: 'leaf',
        products: filtered.data,
        pagination: filtered.pagination,
      };
    },
  );
}

export async function fetchCategory(slug) {
  return tryApi(
    async () => {
      const { data } = await categoryService.getBySlug(slug);
      return data.data;
    },
    () => mockCategoryBySlug(slug),
  );
}

export async function fetchProducts(params = {}) {
  const res = await fetchProductsPaginated(params);
  return res.data;
}

async function loadProductFromNetwork(slug) {
  return tryApi(
    async () => {
      const { data } = await productService.getBySlug(slug);
      return data.data;
    },
    () => mockBySlug(slug),
  );
}

export async function fetchProduct(slug, { revalidate = false } = {}) {
  if (!slug) return null;

  const cached = getCachedProduct(slug);
  if (cached && !revalidate) return cached;

  const inflightReq = getInflightProduct(slug);
  if (inflightReq) return inflightReq;

  if (cached && revalidate) {
    trackProductInflight(
      slug,
      loadProductFromNetwork(slug)
        .then((data) => finalizeProductFetch(slug, data))
        .catch(() => cached),
    );
    return cached;
  }

  return trackProductInflight(
    slug,
    loadProductFromNetwork(slug).then((data) => finalizeProductFetch(slug, data)),
  );
}

export function prefetchProduct(slug) {
  if (!slug || getCachedProduct(slug) || getInflightProduct(slug)) return;
  fetchProduct(slug).catch(() => {});
}

export async function fetchProductsByMainSub(mainSlug, subSlug, params = {}) {
  return tryApi(
    async () => {
      const { data } = await productService.getByMainSub(mainSlug, subSlug, params);
      return {
        mainCategory: data.mainCategory,
        category: data.category,
        parentCategory: data.parentCategory || null,
        subcategories: data.subcategories || [],
        categoryType: 'sub',
        products: data.data,
        pagination: data.pagination,
      };
    },
    () => {
      const category = mockCategoryBySlug(subSlug);
      const products = mockProductsByCategory(subSlug);
      const filtered = filterProductsMock(products, params);
      return {
        mainCategory: getParentCategoryMock(subSlug) || mockCategoryBySlug(mainSlug),
        category,
        parentCategory: getParentCategoryMock(subSlug),
        subcategories: getSubcategoriesMock(mainSlug),
        categoryType: 'sub',
        products: filtered.data,
        pagination: filtered.pagination,
      };
    },
  );
}

export async function fetchProductsByCategory(slug, params = {}) {
  return tryApi(
    async () => {
      const { data } = await productService.getByCategory(slug, params);
      return {
        category: data.category,
        parentCategory: data.parentCategory || null,
        subcategories: data.subcategories || [],
        categoryType: data.categoryType || null,
        products: data.data,
        pagination: data.pagination,
      };
    },
    () => {
      const category = mockCategoryBySlug(slug);
      const products = mockProductsByCategory(slug);
      const filtered = filterProductsMock(products, params);
      return {
        category,
        parentCategory: getParentCategoryMock(slug),
        subcategories: getSubcategoriesMock(slug),
        categoryType: getSubcategoriesMock(slug).length && !getParentCategoryMock(slug) ? 'main' : 'sub',
        products: filtered.data,
        pagination: filtered.pagination,
      };
    },
  );
}

export async function fetchOffersPaginated(params = {}) {
  const res = await tryApi(
    async () => {
      const { data } = await productService.getOffers(params);
      return {
        data: data.data,
        pagination: data.pagination,
        meta: data.meta || null,
      };
    },
    () => filterProductsMock(mockOffers(), { ...params, offers: 'true' }),
  );
  seedProductListCache(res.data);
  return res;
}

/** @deprecated prefer fetchOffersPaginated for list pages */
export async function fetchOffers(params = {}) {
  const res = await fetchOffersPaginated(params);
  return res.data;
}

export async function searchProducts(query, categorySlug) {
  return fetchProductsPaginated({
    q: query,
    category: categorySlug !== 'all' ? categorySlug : undefined,
  }).then((r) => r.data);
}

export async function fetchSectionProducts(sectionKey) {
  if (['fruits-vegetables', 'beverages', 'baby', 'electronics'].includes(sectionKey)) {
    return fetchProductsByCategory(sectionKey).then((r) => r.products);
  }
  return fetchProducts({ section: sectionKey });
}

export async function fetchTodaysDeals(limit = 8) {
  const res = await fetchOffersPaginated({
    limit,
    page: 1,
    sort: 'discount',
    limitedTime: 'true',
  });
  return {
    products: res.data,
    countdownEnd: res.meta?.countdownEnd ? new Date(res.meta.countdownEnd) : null,
  };
}

export async function fetchTodaysDealsPaginated({ page = 1, limit = 24, sort = 'discount' } = {}) {
  return fetchOffersPaginated({
    page,
    limit,
    sort,
    limitedTime: 'true',
  });
}

export async function fetchBestSellers(limit = 8) {
  return tryApi(
    async () => {
      const res = await fetchProductsPaginated({ sort: 'best-selling', limit, page: 1 });
      return res.data;
    },
    () => [...PRODUCTS]
      .sort((a, b) => (b.soldCount || 0) - (a.soldCount || 0))
      .slice(0, limit),
  );
}

export async function fetchNewArrivals(limit = 8) {
  return tryApi(
    async () => {
      const res = await fetchProductsPaginated({ section: 'new-arrivals', sort: 'newest', limit, page: 1 });
      return res.data.length ? res.data : PRODUCTS.filter((p) => p.isNew).slice(0, limit);
    },
    () => PRODUCTS.filter((p) => p.isNew).slice(0, limit),
  );
}
