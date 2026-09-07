export const DEFAULT_BROWSE_CONFIG = {
  variant: 'split',
  subcategoryCount: 7,
  showProducts: true,
  showSubcategories: true,
  productsLink: '/products',
  subcategoriesLink: '/subcategories',
};

export function normalizeBrowseConfig(config = {}) {
  const variant = ['split', 'products', 'subcategories', 'banner'].includes(config.variant)
    ? config.variant
    : 'split';
  return {
    variant,
    subcategoryCount: Math.min(12, Math.max(4, Number(config.subcategoryCount) || 7)),
    showProducts: config.showProducts !== false,
    showSubcategories: config.showSubcategories !== false,
    productsLink: config.productsLink || '/products',
    subcategoriesLink: config.subcategoriesLink || '/subcategories',
  };
}
