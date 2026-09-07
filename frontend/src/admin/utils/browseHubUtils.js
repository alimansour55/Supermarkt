export {
  DEFAULT_BROWSE_CONFIG,
  normalizeBrowseConfig,
} from '../../utils/browseHubShared';

import { DEFAULT_BROWSE_CONFIG } from '../../utils/browseHubShared';

export const BROWSE_VARIANTS = [
  {
    value: 'split',
    labelAr: 'عمودين (منتجات + فرعية)',
    labelEn: 'Split (products + subcategories)',
    descAr: 'الوضع الكامل — كل المنتجات والأقسام الفرعية',
    descEn: 'Full hub — all products & subcategories side by side',
  },
  {
    value: 'products',
    labelAr: 'بطاقة كل المنتجات',
    labelEn: 'All products card',
    descAr: 'يربط بكتalog المنتجات — يغني عن «بطاقة كل المنتجات»',
    descEn: 'Links to catalog — replaces All products card',
  },
  {
    value: 'subcategories',
    labelAr: 'شريط الأقسام الفرعية',
    labelEn: 'Subcategories strip',
    descAr: 'تمرير أفقي للأقسام الفرعية فقط',
    descEn: 'Horizontal subcategory scroll only',
  },
  {
    value: 'banner',
    labelAr: 'بانر الأقسام الفرعية',
    labelEn: 'Subcategories banner',
    descAr: 'بطاقة CTA مع عينة — يغني عن «معاينة الأقسام»',
    descEn: 'CTA banner with chips — replaces subcategories preview',
  },
];

export const BROWSE_PRESETS = [
  {
    id: 'default-split',
    labelAr: 'افتراضي — عمودين',
    labelEn: 'Default split',
    config: DEFAULT_BROWSE_CONFIG,
  },
  {
    id: 'products-only',
    labelAr: 'كل المنتجات فقط',
    labelEn: 'All products only',
    config: { ...DEFAULT_BROWSE_CONFIG, variant: 'products', showSubcategories: false, showProducts: true },
  },
  {
    id: 'subs-banner',
    labelAr: 'بانر الأقسام الفرعية',
    labelEn: 'Subcategories banner',
    config: { ...DEFAULT_BROWSE_CONFIG, variant: 'banner', showProducts: false, showSubcategories: true },
  },
];
