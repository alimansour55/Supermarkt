import { productService, categoryService } from './apiServices';
import {
  PRODUCTS,
  CATEGORIES,
  getProductsByCategory as mockProductsByCategory,
  getProductsBySection as mockBySection,
  getOfferProducts as mockOffers,
  searchProducts as mockSearch,
  getProductBySlug as mockBySlug,
  getCategoryBySlug as mockCategoryBySlug,
  getSubcategoriesMock,
  getParentCategoryMock,
} from '../data/mockData';
import { filterProductsMock } from '../utils/productHelpers';

const useApi = import.meta.env.VITE_USE_API !== 'false';

async function tryApi(fn, fallback) {
  if (!useApi) return fallback();
  try {
    return await fn();
  } catch {
    return fallback();
  }
}

const MOCK_BRANDS = [...new Set(PRODUCTS.map((p) => p.brand).filter(Boolean))];

export async function fetchProductFilters() {
  return tryApi(
    async () => {
      const { data } = await productService.getFilters();
      return data;
    },
    () => ({
      categories: CATEGORIES,
      brands: MOCK_BRANDS.length ? MOCK_BRANDS : ['MarketPlus', 'Juhayna', 'Coca-Cola', 'Pampers'],
      priceRange: { minPrice: 8, maxPrice: 400 },
    }),
  );
}

export async function fetchProductsPaginated(params = {}) {
  return tryApi(
    async () => {
      const { data } = await productService.getAll(params);
      return { data: data.data, pagination: data.pagination };
    },
    () => filterProductsMock(PRODUCTS, params),
  );
}

export async function fetchCategories() {
  return tryApi(
    async () => {
      const { data } = await categoryService.getAll();
      return data.data;
    },
    () => CATEGORIES,
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

export async function fetchProduct(slug) {
  return tryApi(
    async () => {
      const { data } = await productService.getBySlug(slug);
      return data.data;
    },
    () => mockBySlug(slug),
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
        products: filtered.data,
        pagination: filtered.pagination,
      };
    },
  );
}

export async function fetchOffers(params = {}) {
  return fetchProductsPaginated({ ...params, offers: 'true' }).then((r) => r.data);
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
  return fetchOffers({ limit, page: 1 });
}

export async function fetchBestSellers(limit = 8) {
  return tryApi(
    async () => {
      const res = await fetchProductsPaginated({ sort: 'best-selling', limit, page: 1 });
      return res.data;
    },
    () => PRODUCTS.filter((p) => p.isBestSeller).slice(0, limit),
  );
}

export async function fetchNewArrivals(limit = 8) {
  return tryApi(
    async () => {
      const res = await fetchProductsPaginated({ sort: 'newest', limit, page: 1 });
      return res.data.length ? res.data : PRODUCTS.filter((p) => p.isNew).slice(0, limit);
    },
    () => PRODUCTS.filter((p) => p.isNew).slice(0, limit),
  );
}
