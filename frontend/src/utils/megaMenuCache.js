import { buildCategoryPath, buildCategorySlugChain } from './categoryHelpers';
import { fetchProductsPaginated, fetchOffersPaginated } from '../services/productApi';

const PRODUCTS_PER_GROUP = 6;
const PRODUCTS_PER_LEAF = 4;
const OFFERS_LIMIT = 12;

const blockCache = new Map();
const blockInflight = new Map();
let offersCache = null;
let offersInflight = null;

function langKey(isAr) {
  return isAr ? 'ar' : 'en';
}

function blockKey(slug, isAr, categoriesVersion = '') {
  return `${slug}:${langKey(isAr)}:${categoriesVersion}`;
}

function categoriesVersion(categories = []) {
  return categories
    .filter((c) => c.isActive !== false)
    .map((c) => c.slug)
    .sort()
    .join('|');
}

function productLabel(product, isAr) {
  return isAr ? (product.nameAr || product.name || '') : (product.nameEn || product.name || '');
}

function categoryLabel(cat, isAr) {
  return isAr ? (cat.nameAr || cat.name || '') : (cat.nameEn || cat.name || '');
}

export function getCachedMegaBlocks(slug, isAr, categories = []) {
  if (!slug) return null;
  return blockCache.get(blockKey(slug, isAr, categoriesVersion(categories))) ?? null;
}

async function fetchProductsForCategorySlug(slug, limit = PRODUCTS_PER_LEAF) {
  if (!slug) return [];
  try {
    const res = await fetchProductsPaginated({ category: slug, limit, page: 1 });
    return res?.data || [];
  } catch {
    return [];
  }
}

async function fetchProductsAsItems(slug, isAr, limit = PRODUCTS_PER_LEAF) {
  const products = await fetchProductsForCategorySlug(slug, limit);
  return products.map((product) => ({
    key: String(product._id || product.slug),
    label: productLabel(product, isAr),
    href: `/products/${product.slug}`,
    type: 'product',
  }));
}

function categoryLinkItem(cat, categories, isAr, { muted = false } = {}) {
  return {
    key: `cat-${cat.slug}`,
    label: categoryLabel(cat, isAr),
    href: buildCategoryPath(buildCategorySlugChain(cat, categories)),
    muted,
  };
}

async function appendDescendantItems(items, node, categories, getChildren, isAr) {
  const children = getChildren(node.slug);
  for (const child of children) {
    items.push(categoryLinkItem(child, categories, isAr));
    const subChildren = getChildren(child.slug);
    if (!subChildren.length) {
      const productItems = await fetchProductsAsItems(child.slug, isAr, PRODUCTS_PER_LEAF);
      items.push(...productItems);
    } else {
      await appendDescendantItems(items, child, categories, getChildren, isAr);
    }
  }
}

/** Build menu links + product links under a category (supports 2–4 levels). */
async function buildMegaItemsForCategory(cat, categories, getChildren, isAr) {
  const childCategories = getChildren(cat.slug);

  if (!childCategories.length) {
    return fetchProductsAsItems(cat.slug, isAr, PRODUCTS_PER_GROUP);
  }

  const items = [];
  await appendDescendantItems(items, cat, categories, getChildren, isAr);
  return items;
}

export async function buildMegaBlocks(activeCategory, categories, getChildren, isAr) {
  if (!activeCategory?.slug) return [];

  const directChildren = getChildren(activeCategory.slug);

  if (!directChildren.length) {
    const href = buildCategoryPath(buildCategorySlugChain(activeCategory, categories));
    const items = await buildMegaItemsForCategory(activeCategory, categories, getChildren, isAr);
    if (!items.length) return [];
    return [{ category: activeCategory, href, loading: false, items }];
  }

  return Promise.all(directChildren.map(async (child) => {
    const href = buildCategoryPath(buildCategorySlugChain(child, categories));
    const items = await buildMegaItemsForCategory(child, categories, getChildren, isAr);
    return { category: child, href, loading: false, items };
  }));
}

export async function loadMegaBlocks(activeCategory, categories, getChildren, isAr) {
  if (!activeCategory?.slug) return [];

  const key = blockKey(activeCategory.slug, isAr, categoriesVersion(categories));
  const cached = blockCache.get(key);
  if (cached) return cached;

  const pending = blockInflight.get(key);
  if (pending) return pending;

  const promise = buildMegaBlocks(activeCategory, categories, getChildren, isAr)
    .then((blocks) => {
      blockCache.set(key, blocks);
      blockInflight.delete(key);
      return blocks;
    })
    .catch((err) => {
      blockInflight.delete(key);
      throw err;
    });

  blockInflight.set(key, promise);
  return promise;
}

export function prefetchMegaBlocks(categorySlugs, categories, getChildren, isAr) {
  const version = categoriesVersion(categories);
  categorySlugs.forEach((slug) => {
    const cat = categories.find((c) => c.slug === slug);
    const key = blockKey(slug, isAr, version);
    if (!cat || blockCache.has(key) || blockInflight.has(key)) return;
    loadMegaBlocks(cat, categories, getChildren, isAr);
  });
}

export function getCachedOffers() {
  return offersCache;
}

export async function loadOffersForMega(limit = OFFERS_LIMIT) {
  if (offersCache) return offersCache;

  if (offersInflight) return offersInflight;

  offersInflight = fetchOffersPaginated({ limit, page: 1, sort: 'discount' })
    .then((res) => {
      offersCache = res?.data || [];
      offersInflight = null;
      return offersCache;
    })
    .catch(() => {
      offersInflight = null;
      offersCache = [];
      return offersCache;
    });

  return offersInflight;
}

export function prefetchOffersMega() {
  if (!offersCache && !offersInflight) {
    loadOffersForMega();
  }
}

/** Clear cached blocks after catalog changes (optional admin hook). */
export function invalidateMegaMenuCache() {
  blockCache.clear();
  blockInflight.clear();
}
