export { DEFAULT_BRAND_ROW_CONFIG, normalizeBrandRowConfig } from '../../utils/brandRowShared';

export const BRAND_ROW_LAYOUTS = [
  { value: 'scroll', labelAr: 'تمرير أفقي', labelEn: 'Horizontal scroll' },
  { value: 'grid', labelAr: 'شبكة', labelEn: 'Grid' },
];

export function emptyBrandItem() {
  return {
    titleAr: '',
    titleEn: '',
    image: '',
    link: '/products',
    emoji: '🏷️',
    query: '',
  };
}
