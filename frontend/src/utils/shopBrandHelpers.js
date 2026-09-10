import { SHOP_BRANDS } from '../data/shopBrands';

export function brandProductHref(query) {
  const q = String(query || '').trim();
  if (!q) return '/products';
  return `/products?brand=${encodeURIComponent(q)}`;
}

/** Arabic alphabet used for the brand A–Z index bar. */
export const AR_ALPHABET = [
  'ا', 'ب', 'ت', 'ث', 'ج', 'ح', 'خ', 'د', 'ذ', 'ر', 'ز', 'س', 'ش', 'ص', 'ض',
  'ط', 'ظ', 'ع', 'غ', 'ف', 'ق', 'ك', 'ل', 'م', 'ن', 'ه', 'و', 'ي',
];

/** English A–Z. */
export const EN_ALPHABET = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

const AR_INDEX_NORMALISE = {
  'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ٱ': 'ا', 'ى': 'ي', 'ة': 'ه', 'ﻻ': 'ل',
};

/**
 * First character of a brand name folded to a single index letter, so e.g.
 * "برسيل" files under "ب" and "Ariel" under "A".
 */
export function brandIndexLetter(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return '';
  const first = Array.from(trimmed)[0];
  return (AR_INDEX_NORMALISE[first] || first).toUpperCase();
}

export function getBrandLabel(brand, isAr) {
  if (isAr) {
    return brand.nameAr || brand.titleAr || brand.nameEn || brand.titleEn || brand.queryValue || brand.query || '';
  }
  return brand.nameEn || brand.titleEn || brand.nameAr || brand.titleAr || brand.queryValue || brand.query || '';
}

function slugify(name) {
  return String(name || 'brand')
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'brand';
}

export function normalizeBrandEntry(entry = {}) {
  const query = entry.queryValue || entry.query || entry.name || entry.nameEn || entry.titleEn || '';
  return {
    slug: entry.slug || slugify(query),
    nameEn: entry.nameEn || entry.titleEn || entry.name || query,
    nameAr: entry.nameAr || entry.titleAr || entry.nameEn || query,
    emoji: entry.emoji || '🏷️',
    image: entry.logo || entry.image || '',
    link: entry.link || brandProductHref(query),
    query,
    count: typeof entry.productCount === 'number' ? entry.productCount : (entry.count ?? null),
    isFeatured: !!entry.isFeatured,
    isActive: entry.isActive !== false,
  };
}

/** Map API brand row for admin / storefront display */
export function formatBrandFromApi(brand) {
  return {
    _id: brand._id,
    slug: brand.slug,
    nameAr: brand.nameAr,
    nameEn: brand.nameEn,
    queryValue: brand.queryValue,
    emoji: brand.emoji || '🏷️',
    logo: brand.logo || null,
    descriptionAr: brand.descriptionAr || '',
    descriptionEn: brand.descriptionEn || '',
    website: brand.website || '',
    sortOrder: brand.sortOrder ?? 0,
    isActive: brand.isActive !== false,
    isFeatured: !!brand.isFeatured,
    productCount: brand.productCount ?? 0,
  };
}

/** Merge CMS/static brands with live catalog brands (with counts). */
export function mergeBrandCatalog(apiBrands = [], staticBrands = SHOP_BRANDS) {
  const map = new Map();

  staticBrands.forEach((row) => {
    const normalized = normalizeBrandEntry(row);
    if (normalized.query) map.set(normalized.query.toLowerCase(), normalized);
  });

  apiBrands.forEach((row) => {
    const key = String(row.queryValue || row.query || row.nameEn || row.name || '').trim().toLowerCase();
    if (!key) return;
    const prev = map.get(key);
    map.set(key, normalizeBrandEntry({
      ...prev,
      ...row,
      queryValue: row.queryValue || row.query || row.nameEn,
      productCount: row.productCount ?? row.count,
    }));
  });

  return Array.from(map.values()).sort((a, b) =>
    getBrandLabel(a, false).localeCompare(getBrandLabel(b, false), undefined, { sensitivity: 'base' }),
  );
}

/** Homepage brand row «view all» — legacy /products opens the brands index. */
export function resolveBrandRowViewAllLink(sectionLink, fallback = '/brands') {
  const link = String(sectionLink || '').trim();
  if (!link || link === '/products') return fallback;
  return link;
}
