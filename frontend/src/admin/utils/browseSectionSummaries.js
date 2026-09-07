import { BROWSE_VARIANTS } from './browseHubUtils';
import { CATEGORY_NAV_LAYOUTS } from './categoryNavUtils';
import { BRAND_ROW_LAYOUTS } from './brandRowUtils';

export function formatBrowseHubSummary(section, isAr) {
  const config = section.browseConfig || {};
  const variant = BROWSE_VARIANTS.find((v) => v.value === config.variant);
  const label = variant ? (isAr ? variant.labelAr : variant.labelEn) : config.variant || 'split';
  return { label, subCount: config.subcategoryCount || 7 };
}

export function formatCategoryNavSummary(section, isAr) {
  const config = section.categoryNavConfig || {};
  const layout = CATEGORY_NAV_LAYOUTS.find((l) => l.value === (config.layout || section.layout || 'scroll'));
  const layoutLabel = layout ? (isAr ? layout.labelAr : layout.labelEn) : config.layout;
  return {
    layoutLabel,
    columns: config.columns || 4,
    showTitle: config.showTitle !== false,
  };
}

export function formatBrandRowSummary(section, isAr) {
  const config = section.brandRowConfig || {};
  const layout = BRAND_ROW_LAYOUTS.find((l) => l.value === (config.layout || 'scroll'));
  const layoutLabel = layout ? (isAr ? layout.labelAr : layout.labelEn) : config.layout;
  const count = (section.items || []).filter((i) => i.titleAr || i.titleEn).length;
  return { layoutLabel, count, columns: config.columns || 6 };
}
