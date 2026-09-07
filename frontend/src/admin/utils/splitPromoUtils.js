import {
  DEFAULT_SPLIT_PROMO_CONFIG,
  normalizeSplitPromoConfig,
} from '../../utils/splitPromoShared';

export { DEFAULT_SPLIT_PROMO_CONFIG, normalizeSplitPromoConfig };

export const SPLIT_PROMO_LAYOUTS = [
  {
    value: 'balanced',
    labelAr: 'أعمدة متساوية',
    labelEn: 'Equal columns',
    descAr: 'شبكة منتظمة — 2 إلى 4 أعمدة',
    descEn: 'Even grid — 2 to 4 columns',
  },
  {
    value: 'featured-first',
    labelAr: 'بانر بارز (يسار)',
    labelEn: 'Featured first',
    descAr: 'العنصر الأول أكبر — مثالي لعرض رئيسي',
    descEn: 'First tile is larger — great for a hero promo',
  },
  {
    value: 'featured-last',
    labelAr: 'بانر بارز (يمين)',
    labelEn: 'Featured last',
    descAr: 'العنصر الأخير أكبر',
    descEn: 'Last tile is larger',
  },
];

export const SPLIT_PROMO_CARD_STYLES = [
  {
    value: 'overlay',
    labelAr: 'صورة + تدرج',
    labelEn: 'Image overlay',
    descAr: 'صورة خلفية مع نص في الأسفل',
    descEn: 'Background image with bottom text',
  },
  {
    value: 'gradient',
    labelAr: 'تدرج لوني',
    labelEn: 'Gradient',
    descAr: 'بدون صورة — ألوان جاهزة',
    descEn: 'No image — preset color gradients',
  },
  {
    value: 'minimal',
    labelAr: 'بسيط',
    labelEn: 'Minimal',
    descAr: 'خلفية فاتحة مع أيقونة',
    descEn: 'Soft background with icon',
  },
  {
    value: 'bordered',
    labelAr: 'إطار',
    labelEn: 'Bordered',
    descAr: 'بطاقة بيضاء بحدود — نظيف',
    descEn: 'White card with border — clean',
  },
];

export const SPLIT_PROMO_HEIGHTS = [
  { value: 'compact', labelAr: 'منخفض', labelEn: 'Compact' },
  { value: 'medium', labelAr: 'متوسط', labelEn: 'Medium' },
  { value: 'tall', labelAr: 'عالي', labelEn: 'Tall' },
];

export const SPLIT_PROMO_GAPS = [
  { value: 'tight', labelAr: 'ضيق', labelEn: 'Tight' },
  { value: 'normal', labelAr: 'عادي', labelEn: 'Normal' },
  { value: 'wide', labelAr: 'واسع', labelEn: 'Wide' },
];

export const SPLIT_PROMO_ACCENTS = [
  { value: 'primary', labelAr: 'أساسي', labelEn: 'Primary' },
  { value: 'emerald', labelAr: 'أخضر', labelEn: 'Emerald' },
  { value: 'amber', labelAr: 'ذهبي', labelEn: 'Amber' },
  { value: 'rose', labelAr: 'وردي', labelEn: 'Rose' },
  { value: 'sky', labelAr: 'سماوي', labelEn: 'Sky' },
  { value: 'violet', labelAr: 'بنفسجي', labelEn: 'Violet' },
];

export const SPLIT_PROMO_PRESETS = [
  {
    id: 'dual-grocery',
    labelAr: 'عمودين — بقالة وتنظيف',
    labelEn: '2 cols — grocery & cleaning',
    config: { columns: 2, layout: 'balanced', cardStyle: 'overlay', tileHeight: 'medium', gap: 'normal', showTitle: false },
    items: [
      { titleAr: 'عروض البقالة', titleEn: 'Grocery deals', subtitleAr: 'خصومات يومية', subtitleEn: 'Daily savings', emoji: '🛒', link: '/offers', accent: 'primary', ctaAr: 'تسوق الآن', ctaEn: 'Shop now' },
      { titleAr: 'منتجات التنظيف', titleEn: 'Cleaning essentials', subtitleAr: 'أفضل الأسعار', subtitleEn: 'Best prices', emoji: '✨', link: '/products', accent: 'emerald', ctaAr: 'اكتشف', ctaEn: 'Discover' },
    ],
  },
  {
    id: 'triple-categories',
    labelAr: '3 أعمدة — أقسام',
    labelEn: '3 cols — categories',
    config: { columns: 3, layout: 'balanced', cardStyle: 'gradient', tileHeight: 'medium', gap: 'normal', showTitle: true },
    items: [
      { titleAr: 'فواكه وخضروات', titleEn: 'Fresh produce', emoji: '🥬', link: '/products', accent: 'emerald', ctaAr: 'تسوق', ctaEn: 'Shop' },
      { titleAr: 'ألبان ومشتقات', titleEn: 'Dairy', emoji: '🥛', link: '/products', accent: 'sky', ctaAr: 'تسوق', ctaEn: 'Shop' },
      { titleAr: 'مخبوزات', titleEn: 'Bakery', emoji: '🍞', link: '/products', accent: 'amber', ctaAr: 'تسوق', ctaEn: 'Shop' },
    ],
    titleAr: 'تسوق حسب القسم',
    titleEn: 'Shop by aisle',
  },
  {
    id: 'featured-sale',
    labelAr: 'بارز + جانبي',
    labelEn: 'Featured + side tiles',
    config: { columns: 2, layout: 'featured-first', cardStyle: 'overlay', tileHeight: 'tall', gap: 'normal', showTitle: false },
    items: [
      { titleAr: 'خصومات حتى 40%', titleEn: 'Up to 40% off', subtitleAr: 'لفترة محدودة', subtitleEn: 'Limited time', emoji: '🏷️', link: '/offers', accent: 'rose', ctaAr: 'تسوق العروض', ctaEn: 'Shop offers' },
      { titleAr: 'توصيل مجاني', titleEn: 'Free delivery', subtitleAr: 'فوق 500 ج.م', subtitleEn: 'Over EGP 500', emoji: '🚚', link: '/products', accent: 'primary', ctaAr: 'اطلب الآن', ctaEn: 'Order now' },
      { titleAr: 'منتجات جديدة', titleEn: 'New arrivals', subtitleAr: 'وصل للتو', subtitleEn: 'Just in', emoji: '✨', link: '/products?sort=newest', accent: 'violet', ctaAr: 'اكتشف', ctaEn: 'Explore' },
    ],
  },
  {
    id: 'quad-minimal',
    labelAr: '4 بطاقات بسيطة',
    labelEn: '4 minimal cards',
    config: { columns: 4, layout: 'balanced', cardStyle: 'minimal', tileHeight: 'compact', gap: 'tight', showTitle: false },
    items: [
      { titleAr: 'العروض', titleEn: 'Offers', emoji: '🏷️', link: '/offers', accent: 'rose' },
      { titleAr: 'الأكثر مبيعاً', titleEn: 'Best sellers', emoji: '🔥', link: '/products?sort=best-selling', accent: 'amber' },
      { titleAr: 'جديد', titleEn: 'New', emoji: '✨', link: '/products?sort=newest', accent: 'sky' },
      { titleAr: 'المفضلة', titleEn: 'Favorites', emoji: '❤️', link: '/account/favorites', accent: 'primary' },
    ],
  },
];

export function emptySplitPromoItem() {
  return {
    titleAr: '',
    titleEn: '',
    subtitleAr: '',
    subtitleEn: '',
    image: '',
    link: '/products',
    emoji: '',
    query: '',
    ctaAr: '',
    ctaEn: '',
    accent: '',
  };
}

export function formatSplitPromoSummary(section, isAr) {
  const config = normalizeSplitPromoConfig(section.splitPromoConfig || {});
  const count = (section.items || []).filter((i) => i.titleAr || i.titleEn).length;
  const layout = SPLIT_PROMO_LAYOUTS.find((l) => l.value === config.layout);
  const style = SPLIT_PROMO_CARD_STYLES.find((s) => s.value === config.cardStyle);
  const layoutLabel = isAr ? layout?.labelAr : layout?.labelEn;
  const styleLabel = isAr ? style?.labelAr : style?.labelEn;
  return { count, config, layoutLabel, styleLabel };
}
