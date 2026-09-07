import {
  getRootSlugForCategory,
  isRootCategory,
} from '../../utils/categoryHelpers';

/**
 * Map a picked category to storefront-aligned API params (mainCategory + subCategory).
 * Matches applyProductCategoryQueryToFilter on the backend.
 */
export function toStorefrontCategoryFilter(categories, categoryId) {
  if (!categoryId) {
    return { mainCategory: '', subCategory: '' };
  }

  const cat = categories.find((c) => String(c._id) === String(categoryId));
  if (!cat) {
    return { mainCategory: '', subCategory: '' };
  }

  if (isRootCategory(cat)) {
    return { mainCategory: cat.slug, subCategory: '' };
  }

  const rootSlug = getRootSlugForCategory(cat, categories);
  const root = categories.find((c) => c.slug === rootSlug);
  return {
    mainCategory: root?.slug || '',
    subCategory: cat.slug,
  };
}

/** Decode list filters back to a category id for the browse picker. */
export function fromStorefrontCategoryFilter(categories, { mainCategory = '', subCategory = '' } = {}) {
  if (subCategory) {
    const cat = categories.find((c) => c.slug === subCategory);
    return cat?._id ? String(cat._id) : '';
  }
  if (mainCategory) {
    const cat = categories.find((c) => c.slug === mainCategory);
    return cat?._id ? String(cat._id) : '';
  }
  return '';
}

/** Normalize API path labels to admin breadcrumb style (Baby Care > Diapers). */
export function formatAdminCategoryPath(path) {
  if (!path) return '';
  return path.replace(/\s*›\s*/g, ' > ').trim();
}

/**
 * Storefront-aligned product list params for a picked category id.
 * Matches applyProductCategoryQueryToFilter (mainCategory / subCategory slugs).
 */
export function buildAdminProductCategoryQuery(categories, categoryId) {
  if (!categoryId) return {};
  return toStorefrontCategoryFilter(categories, categoryId);
}

/** Merge category filter params into admin product API query params. */
export function buildAdminProductListParams(categories, { categoryId, ...rest } = {}) {
  return {
    ...rest,
    ...buildAdminProductCategoryQuery(categories, categoryId),
  };
}
