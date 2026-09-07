export const DEFAULT_CUSTOM_TOOLBAR_ICON = 'layout-grid';

export const HEADER_TOOLBAR_ICON_OPTIONS = [
  { id: 'layout-grid', labelAr: 'شبكة', labelEn: 'Grid' },
  { id: 'grid-2x2', labelAr: 'شبكة ٢×٢', labelEn: 'Grid 2×2' },
  { id: 'layers', labelAr: 'طبقات', labelEn: 'Layers' },
  { id: 'list', labelAr: 'قائمة', labelEn: 'List' },
  { id: 'package', labelAr: 'صندوق', labelEn: 'Package' },
  { id: 'boxes', labelAr: 'منتجات', labelEn: 'Boxes' },
  { id: 'shopping-bag', labelAr: 'حقيبة', labelEn: 'Bag' },
  { id: 'store', labelAr: 'متجر', labelEn: 'Store' },
  { id: 'tag', labelAr: 'Tag', labelEn: 'Tag' },
  { id: 'badge-percent', labelAr: 'خصم %', labelEn: 'Discount' },
  { id: 'sparkles', labelAr: 'تمييز', labelEn: 'Sparkles' },
  { id: 'flame', labelAr: 'عروض ساخنة', labelEn: 'Hot deals' },
  { id: 'star', labelAr: 'نجمة', labelEn: 'Star' },
  { id: 'heart', labelAr: 'قلب', labelEn: 'Heart' },
  { id: 'shopping-cart', labelAr: 'سلة', labelEn: 'Cart' },
  { id: 'gift', labelAr: 'هدية', labelEn: 'Gift' },
  { id: 'truck', labelAr: 'توصيل', labelEn: 'Delivery' },
  { id: 'user', labelAr: 'مستخدم', labelEn: 'User' },
  { id: 'home', labelAr: 'رئيسية', labelEn: 'Home' },
  { id: 'search', labelAr: 'بحث', labelEn: 'Search' },
  { id: 'map-pin', labelAr: 'موقع', labelEn: 'Location' },
  { id: 'phone', labelAr: 'هاتف', labelEn: 'Phone' },
  { id: 'mail', labelAr: 'بريد', labelEn: 'Mail' },
  { id: 'bookmark', labelAr: 'إشارة', labelEn: 'Bookmark' },
  { id: 'link', labelAr: 'رابط', labelEn: 'Link' },
];

export const HEADER_TOOLBAR_STYLE_OPTIONS = [
  {
    id: 'pill',
    labelAr: 'زر بإطار',
    labelEn: 'Bordered button',
    hintAr: 'مثل «كل الأقسام»',
    hintEn: 'Like All Categories',
  },
  {
    id: 'plain',
    labelAr: 'بسيط',
    labelEn: 'Plain',
    hintAr: 'أيقونة + نص فقط',
    hintEn: 'Icon + text only',
  },
];

const VALID_ICON_IDS = new Set(HEADER_TOOLBAR_ICON_OPTIONS.map((o) => o.id));

export function normalizeToolbarIconKey(icon, itemKey) {
  if (itemKey && itemKey !== 'link') return itemKey;
  const key = String(icon || DEFAULT_CUSTOM_TOOLBAR_ICON).trim();
  return VALID_ICON_IDS.has(key) ? key : DEFAULT_CUSTOM_TOOLBAR_ICON;
}

export function normalizeToolbarVariant(variant) {
  return variant === 'plain' ? 'plain' : 'pill';
}

export function getIconOptionLabel(iconId, isAr) {
  const opt = HEADER_TOOLBAR_ICON_OPTIONS.find((o) => o.id === iconId);
  if (!opt) return iconId;
  return isAr ? opt.labelAr : opt.labelEn;
}
