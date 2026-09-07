import { normalizeTileColumns } from '../../utils/tileGridShared';

export const PRODUCT_SHOWCASE_LAYOUTS = [
  { value: 'scroll', labelAr: 'شريط أفقي', labelEn: 'Horizontal scroll', hintAr: 'تمرير أفقي — بطاقات منتجات كاملة', hintEn: 'Horizontal scroll — full compact cards' },
  { value: 'grid', labelAr: 'شبكة', labelEn: 'Grid', hintAr: 'بطاقات منتجات عادية في أعمدة', hintEn: 'Normal product cards in columns' },
];

export const DEFAULT_PRODUCT_SHOWCASE_CONFIG = {
  layout: 'scroll',
  columns: 4,
  showViewAll: true,
};

export function normalizeProductShowcaseConfig(config = {}, section = {}) {
  const layout = config.layout
    || section.layout
    || (section.type === 'product_grid' ? 'grid' : 'scroll');
  const normalizedLayout = layout === 'grid' ? 'grid' : 'scroll';
  return {
    ...DEFAULT_PRODUCT_SHOWCASE_CONFIG,
    ...config,
    layout: normalizedLayout,
    columns: normalizeTileColumns(config.columns, 6),
    showViewAll: config.showViewAll !== false,
  };
}

export function isProductShowcaseType(type) {
  return ['product_grid', 'product_carousel', 'top_rated'].includes(type);
}

export function resolveProductShowcaseLayout(section) {
  return normalizeProductShowcaseConfig(section?.productShowcaseConfig || {}, section).layout;
}
