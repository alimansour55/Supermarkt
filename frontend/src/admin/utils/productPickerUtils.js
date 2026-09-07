import { buildAdminProductListParams } from './adminCategoryFilter';

const RECENT_KEY = 'admin:recent-product-picks';

export const PICKER_BROWSE_PRESETS = [
  {
    id: 'recent',
    icon: '🕐',
    labelAr: 'استخدمتها مؤخراً',
    labelEn: 'Recently used',
    hintAr: 'آخر منتجات أضفتها في الحملات',
    hintEn: 'Products you picked recently',
  },
  {
    id: 'newest',
    icon: '🆕',
    labelAr: 'الأحدث',
    labelEn: 'Newest',
    params: { sort: 'newest', isActive: 'true' },
  },
  {
    id: 'best-selling',
    icon: '🏆',
    labelAr: 'الأكثر مبيعاً',
    labelEn: 'Best sellers',
    params: { sort: 'best-selling', isActive: 'true' },
  },
  {
    id: 'offers',
    icon: '🏷️',
    labelAr: 'عروض حالية',
    labelEn: 'On offer now',
    params: { offers: 'true', isActive: 'true', sort: 'newest' },
  },
];

export function productPickerLabel(product, isAr) {
  if (!product) return '';
  const name = isAr
    ? (product.nameAr || product.nameEn || product.name)
    : (product.nameEn || product.nameAr || product.name);
  const brand = product.brand ? ` · ${product.brand}` : '';
  const price = product.price != null ? ` · ${product.price} EGP` : '';
  return `${name || product._id}${brand}${price}`;
}

export function readRecentProductPicks() {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((p) => p?._id) : [];
  } catch {
    return [];
  }
}

export function rememberProductPick(product) {
  if (!product?._id) return;
  const entry = {
    _id: String(product._id),
    nameAr: product.nameAr || product.name,
    nameEn: product.nameEn,
    brand: product.brand,
    price: product.price,
    image: product.image || product.images?.[0]?.url || product.images?.[0],
  };
  const prev = readRecentProductPicks().filter((p) => String(p._id) !== entry._id);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([entry, ...prev].slice(0, 40)));
  } catch {
    /* ignore quota */
  }
}

export function buildPickerFetchParams({
  presetId,
  categoryId,
  categories = [],
  brand,
  page = 1,
  limit = 12,
}) {
  const preset = PICKER_BROWSE_PRESETS.find((p) => p.id === presetId);
  return buildAdminProductListParams(categories, {
    page,
    limit,
    isActive: 'true',
    ...(preset?.params || { sort: 'newest' }),
    categoryId: categoryId || '',
    ...(brand?.trim() ? { brand: brand.trim() } : {}),
  });
}
