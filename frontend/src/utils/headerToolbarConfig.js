import {
  DEFAULT_CUSTOM_TOOLBAR_ICON,
  normalizeToolbarIconKey,
  normalizeToolbarVariant,
} from './headerToolbarIcons';

function normalizeHref(href) {
  const trimmed = String(href || '').trim();
  if (!trimmed) return '/';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const path = trimmed.replace(/^\/+/, '');
  return `/${path}`;
}

export const HEADER_BUILTIN_KEYS = ['categories', 'favorites', 'account', 'cart'];

export const HEADER_BUILTIN_META = {
  categories: {
    labelAr: 'كل الأقسام',
    labelEn: 'All Categories',
    descriptionAr: 'قائمة الأقسام المنسدلة',
    descriptionEn: 'Categories dropdown',
  },
  favorites: {
    labelAr: 'المفضلة',
    labelEn: 'Favorites',
    descriptionAr: 'صفحة المفضلة',
    descriptionEn: 'Wishlist page',
  },
  account: {
    labelAr: 'تسجيل الدخول / حسابي',
    labelEn: 'Login / Account',
    descriptionAr: 'تسجيل الدخول أو قائمة الحساب',
    descriptionEn: 'Sign in or account menu',
  },
  cart: {
    labelAr: 'السلة',
    labelEn: 'Cart',
    descriptionAr: 'فتح سلة التسوق',
    descriptionEn: 'Open shopping cart',
  },
};

export const DEFAULT_HEADER_TOOLBAR = [
  { itemKey: 'categories', zone: 'start', sortOrder: 0, isActive: true, showLabel: true },
  { itemKey: 'favorites', zone: 'end', sortOrder: 0, isActive: true, showLabel: true },
  { itemKey: 'account', zone: 'end', sortOrder: 1, isActive: true, showLabel: true },
  { itemKey: 'cart', zone: 'end', sortOrder: 2, isActive: true, showLabel: true },
];

function normalizeZone(zone) {
  return zone === 'start' ? 'start' : 'end';
}

export function normalizeToolbarItem(item = {}, index = 0) {
  const rawKey = String(item.itemKey || 'link').trim();
  const isBuiltin = HEADER_BUILTIN_KEYS.includes(rawKey);
  const itemKey = isBuiltin ? rawKey : 'link';

  return {
    itemKey,
    labelAr: item.labelAr || '',
    labelEn: item.labelEn || '',
    href: normalizeHref(item.href || '/'),
    zone: normalizeZone(item.zone),
    sortOrder: item.sortOrder ?? index,
    isActive: item.isActive !== false,
    isExternal: item.isExternal === true,
    showLabel: item.showLabel !== false,
    icon: normalizeToolbarIconKey(item.icon, itemKey),
    variant: isBuiltin ? 'plain' : normalizeToolbarVariant(item.variant),
  };
}

/** Parse stored navigation into ordered start/end toolbar items. */
export function parseHeaderToolbar(navigation = {}) {
  const raw = navigation?.headerToolbar;
  if (!Array.isArray(raw) || !raw.length) {
    return DEFAULT_HEADER_TOOLBAR.map((item, index) => normalizeToolbarItem(item, index));
  }
  return raw.map((item, index) => normalizeToolbarItem(item, index));
}

export function getHeaderToolbarByZone(navigation = {}) {
  const items = parseHeaderToolbar(navigation)
    .filter((item) => item.isActive !== false)
    .sort((a, b) => {
      if (a.zone !== b.zone) return a.zone === 'start' ? -1 : 1;
      return (a.sortOrder || 0) - (b.sortOrder || 0);
    });

  return {
    start: items.filter((item) => item.zone === 'start'),
    end: items.filter((item) => item.zone === 'end'),
  };
}

export function reindexHeaderToolbar(items = []) {
  const start = items.filter((i) => i.zone === 'start').sort((a, b) => a.sortOrder - b.sortOrder);
  const end = items.filter((i) => i.zone === 'end').sort((a, b) => a.sortOrder - b.sortOrder);

  return [
    ...start.map((item, order) => ({ ...item, zone: 'start', sortOrder: order })),
    ...end.map((item, order) => ({ ...item, zone: 'end', sortOrder: order })),
  ];
}

export function serializeHeaderToolbar(items = []) {
  return reindexHeaderToolbar(items.map((item, index) => normalizeToolbarItem(item, index)));
}

export function emptyCustomToolbarItem(zone = 'start') {
  return normalizeToolbarItem({
    itemKey: 'link',
    labelAr: 'كل المنتجات',
    labelEn: 'All Products',
    href: '/products',
    zone,
    sortOrder: 99,
    isActive: true,
    showLabel: true,
    isExternal: false,
    icon: DEFAULT_CUSTOM_TOOLBAR_ICON,
    variant: 'pill',
  });
}

export function mergeHeaderToolbarIntoNavigation(navigation = {}) {
  return {
    ...navigation,
    headerToolbar: serializeHeaderToolbar(parseHeaderToolbar(navigation)),
  };
}

export { DEFAULT_CUSTOM_TOOLBAR_ICON };
