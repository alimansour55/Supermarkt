export const DEFAULT_CATEGORY_NAV_CONFIG = {
  layout: 'scroll',
  columns: 4,
  showTitle: true,
  showViewAll: true,
  viewAllLink: '/categories',
};

export function normalizeCategoryNavConfig(config = {}) {
  return {
    layout: config.layout === 'grid' ? 'grid' : 'scroll',
    columns: Math.min(6, Math.max(3, Number(config.columns) || 4)),
    showTitle: config.showTitle !== false,
    showViewAll: config.showViewAll !== false,
    viewAllLink: config.viewAllLink || '/categories',
  };
}
