export const DEFAULT_BRAND_ROW_CONFIG = {
  layout: 'scroll',
  columns: 6,
  tileStyle: 'mixed',
};

export function normalizeBrandRowConfig(config = {}) {
  const tileStyle = ['logo', 'emoji', 'mixed'].includes(config.tileStyle) ? config.tileStyle : 'mixed';
  return {
    layout: config.layout === 'grid' ? 'grid' : 'scroll',
    columns: Math.min(8, Math.max(4, Number(config.columns) || 6)),
    tileStyle,
  };
}
