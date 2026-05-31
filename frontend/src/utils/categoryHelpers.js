/** Resolve parent category object from API or mock shape. */
export function getParentCategory(category, allCategories = []) {
  if (category?.parentCategory?.slug) return category.parentCategory;
  if (category?.parentSlug) {
    return allCategories.find((c) => c.slug === category.parentSlug) || null;
  }
  return null;
}

/** Child categories for chips (API subcategories or mock parentSlug). */
export function getSubcategories(category, allCategories = [], apiSubcategories = []) {
  if (apiSubcategories?.length) return apiSubcategories;
  if (category?.subcategories?.length) return category.subcategories;
  return allCategories.filter(
    (c) => c.parentSlug === category?.slug || c.parentCategory?.slug === category?.slug,
  );
}

export function categoryLabel(cat, isAr) {
  if (!cat) return '';
  return isAr ? (cat.nameAr || cat.name) : cat.nameEn;
}
