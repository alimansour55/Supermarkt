/** Unified homepage link presets — shopping, account, content, and more. */

import {
  ACCOUNT_PAGE_PRESETS,
  CONTENT_PAGE_PRESETS,
  SPECIAL_PAGE_PRESETS,
} from './navigationHelpers';

export const HOMEPAGE_LINK_GROUPS = [
  {
    id: 'shopping',
    labelAr: 'تسوّق',
    labelEn: 'Shopping',
    items: [
      { path: '/products', labelAr: 'كل المنتجات', labelEn: 'All products' },
      { path: '/categories', labelAr: 'كل الأقسام', labelEn: 'All categories' },
      { path: '/subcategories', labelAr: 'الأقسام الفرعية', labelEn: 'Subcategories' },
      { path: '/brands', labelAr: 'كل العلامات', labelEn: 'All brands' },
      { path: '/offers', labelAr: 'صفحة العروض', labelEn: 'Offers page' },
      { path: '/favorites', labelAr: 'المفضلة', labelEn: 'Favorites' },
      { path: '/cart', labelAr: 'السلة', labelEn: 'Cart' },
      { path: '/search/results', labelAr: 'نتائج البحث', labelEn: 'Search results' },
    ],
  },
  {
    id: 'product-lists',
    labelAr: 'قوائم منتجات',
    labelEn: 'Product lists',
    items: [
      { path: '/products?section=best-sellers&sort=best-selling', labelAr: 'الأكثر مبيعاً', labelEn: 'Best sellers' },
      { path: '/products?section=new-arrivals&sort=newest', labelAr: 'وصل حديثاً', labelEn: 'New arrivals' },
      { path: '/products?section=featured&featured=true', labelAr: 'منتجات مميزة', labelEn: 'Featured products' },
      { path: '/products?section=on-sale&sort=discount', labelAr: 'تخفيضات', labelEn: 'On sale' },
      { path: '/today-deals', labelAr: 'عروض اليوم', labelEn: "Today's deals" },
      { path: '/products?section=daily-offers&sort=discount', labelAr: 'عروض اليوم (قديم)', labelEn: 'Daily offers (legacy)' },
    ],
  },
  {
    id: 'account',
    labelAr: 'حساب العميل',
    labelEn: 'Customer account',
    items: ACCOUNT_PAGE_PRESETS.map((p) => ({
      path: p.path,
      labelAr: p.labelAr,
      labelEn: p.labelEn,
    })),
  },
  {
    id: 'content',
    labelAr: 'صفحات المحتوى',
    labelEn: 'Content pages',
    items: CONTENT_PAGE_PRESETS.map((p) => ({
      path: p.path,
      labelAr: p.labelAr,
      labelEn: p.labelEn,
    })),
  },
  {
    id: 'other',
    labelAr: 'صفحات أخرى',
    labelEn: 'Other pages',
    items: [
      ...SPECIAL_PAGE_PRESETS.filter((p) => p.path !== '/products' && p.path !== '/favorites' && p.path !== '/cart'),
      { path: '/track-order', labelAr: 'تتبع الطلب', labelEn: 'Track order' },
      { path: '/login', labelAr: 'تسجيل الدخول', labelEn: 'Login' },
      { path: '/register', labelAr: 'إنشاء حساب', labelEn: 'Register' },
    ],
  },
];

export function findLinkPreset(path) {
  const normalized = path?.replace(/\/+$/, '') || '';
  for (const group of HOMEPAGE_LINK_GROUPS) {
    const match = group.items.find((item) => item.path.replace(/\/+$/, '') === normalized);
    if (match) return match;
  }
  return null;
}

export function allLinkPresetPaths() {
  return HOMEPAGE_LINK_GROUPS.flatMap((g) => g.items.map((i) => i.path));
}

/** Build link groups including live store categories for pickers. */
export function buildHomepageLinkGroups(categories = []) {
  const groups = HOMEPAGE_LINK_GROUPS.map((group) => ({
    ...group,
    items: [...group.items],
  }));

  const categoryItems = (categories || [])
    .filter((cat) => cat?.slug && cat.isActive !== false)
    .map((cat) => ({
      path: `/category/${cat.slug}`,
      labelAr: cat.nameAr || cat.slug,
      labelEn: cat.nameEn || cat.slug,
      slug: cat.slug,
    }))
    .sort((a, b) => (a.labelAr || '').localeCompare(b.labelAr || '', 'ar'));

  if (categoryItems.length > 0) {
    groups.splice(1, 0, {
      id: 'categories',
      labelAr: 'أقسام المتجر',
      labelEn: 'Store categories',
      items: categoryItems,
    });
  }

  return groups;
}

export function findLinkPresetInGroups(path, groups) {
  const normalized = path?.replace(/\/+$/, '') || '';
  for (const group of groups) {
    const match = group.items.find((item) => item.path.replace(/\/+$/, '') === normalized);
    if (match) return { ...match, groupId: group.id };
  }
  return null;
}
