import Category from '../models/Category.js';
import { getLeafDescendantIds } from './categoryTree.js';

/** Escape special regex characters */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Common keyboard / OCR confusions for typo-tolerant matching */
const SIMILAR_CHARS = {
  a: 'a4@',
  b: 'b8',
  e: 'e3',
  i: 'i1!',
  l: 'l1|',
  o: 'o0',
  s: 's5$',
  t: 't7',
  g: 'g9',
  z: 'z2',
  c: 'c',
  k: 'k',
};

function fuzzyCharPattern(char) {
  const lower = char.toLowerCase();
  const similar = SIMILAR_CHARS[lower];
  if (similar) return `[${similar}]`;
  return escapeRegex(char);
}

/**
 * Build a regex that tolerates single-character typos and insertions.
 * e.g. "mlik" matches "milk", "chiken" matches "chicken"
 */
export function buildFuzzyRegex(term, maxGap = 1) {
  if (!term) return '';
  if (term.length < 2) return escapeRegex(term);

  const chars = [...term].map((c, i) => {
    const pat = fuzzyCharPattern(c);
    return i < term.length - 1 ? `${pat}.{0,${maxGap}}` : pat;
  });
  return chars.join('');
}

export function normalizeSearchQuery(q) {
  return q.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Loosen common Arabic letter variants for matching stored product text. */
export function arabicSearchPattern(word) {
  if (!word) return '';
  return escapeRegex(word)
    .replace(/[آأإ]/g, '[آأإا]')
    .replace(/ا/g, '[آأإا]')
    .replace(/[ى]/g, '[ىي]')
    .replace(/[ة]/g, '[ةه]');
}

function isMostlyLatin(str) {
  return /^[\x00-\x7F\s]+$/.test(str);
}

function categoryTextMatches(text, q) {
  if (!text || !q) return false;
  const pattern = new RegExp(arabicSearchPattern(normalizeSearchQuery(q)), 'i');
  return pattern.test(text);
}

export function categoryMatchesQuery(cat, chain, q) {
  if (categoryTextMatches(cat.nameAr, q)) return true;
  if (categoryTextMatches(cat.nameEn, q)) return true;
  if (categoryTextMatches(cat.slug, q)) return true;

  const pathAr = chain.map((c) => c.nameAr).filter(Boolean).join(' ');
  const pathEn = chain.map((c) => c.nameEn).filter(Boolean).join(' ');
  return categoryTextMatches(pathAr, q) || categoryTextMatches(pathEn, q);
}

function buildChainFromFlat(cat, byId) {
  const chain = [];
  let cursor = cat;
  while (cursor) {
    chain.unshift(cursor);
    if (!cursor.parentCategory) break;
    cursor = byId.get(String(cursor.parentCategory));
  }
  return chain;
}

function buildContainsOrConditions(term) {
  const pattern = arabicSearchPattern(term);
  return [
    { nameAr: { $regex: pattern, $options: 'i' } },
    { nameEn: { $regex: pattern, $options: 'i' } },
    { slug: { $regex: pattern, $options: 'i' } },
    { brand: { $regex: pattern, $options: 'i' } },
    { brandAr: { $regex: pattern, $options: 'i' } },
    { brandEn: { $regex: pattern, $options: 'i' } },
    { searchKeywordsAr: { $regex: pattern, $options: 'i' } },
    { searchKeywordsEn: { $regex: pattern, $options: 'i' } },
    { sku: { $regex: escapeRegex(term), $options: 'i' } },
    { barcode: { $regex: escapeRegex(term), $options: 'i' } },
  ];
}

function buildFuzzyOrConditions(term) {
  const fuzzy = buildFuzzyRegex(term);
  const exact = escapeRegex(term);
  const variants = buildTypoVariants(term);
  const variantPatterns = variants.map((variant) => new RegExp(escapeRegex(variant), 'i'));
  return [
    { nameAr: { $regex: fuzzy, $options: 'i' } },
    { nameEn: { $regex: fuzzy, $options: 'i' } },
    { slug: { $regex: fuzzy, $options: 'i' } },
    { brand: { $regex: fuzzy, $options: 'i' } },
    { brandAr: { $regex: fuzzy, $options: 'i' } },
    { brandEn: { $regex: fuzzy, $options: 'i' } },
    { searchKeywordsAr: { $regex: fuzzy, $options: 'i' } },
    { searchKeywordsEn: { $regex: fuzzy, $options: 'i' } },
    { sku: { $regex: exact, $options: 'i' } },
    { barcode: { $regex: exact, $options: 'i' } },
    ...variantPatterns.flatMap((pattern) => [
      { nameAr: pattern },
      { nameEn: pattern },
      { brand: pattern },
      { searchKeywordsAr: pattern },
      { searchKeywordsEn: pattern },
    ]),
  ];
}

function buildTypoVariants(term) {
  if (!term || term.length < 3) return [];
  const variants = new Set();
  for (let i = 0; i < term.length; i += 1) {
    variants.add(term.slice(0, i) + term.slice(i + 1));
    if (i < term.length - 1) {
      variants.add(`${term.slice(0, i)}${term[i + 1]}${term[i]}${term.slice(i + 2)}`);
    }
  }
  return [...variants].filter((item) => item.length >= 2 && item !== term);
}

function buildCategoryProductConditions(categoryIds) {
  if (!categoryIds?.length) return [];
  return [
    { category: { $in: categoryIds } },
    { subCategory: { $in: categoryIds } },
  ];
}

export async function findMatchingCategoryIds(q, CategoryModel = Category) {
  const trimmed = q?.trim();
  if (!trimmed || trimmed.length < 2) return [];

  const all = await CategoryModel.find({ isActive: true })
    .select('_id slug nameAr nameEn parentCategory')
    .lean();

  const byId = new Map(all.map((c) => [String(c._id), c]));
  const matchingIds = new Set();

  for (const cat of all) {
    const chain = buildChainFromFlat(cat, byId);
    if (!categoryMatchesQuery(cat, chain, trimmed)) continue;

    const leafIds = await getLeafDescendantIds(cat._id);
    leafIds.forEach((id) => matchingIds.add(id));
  }

  return [...matchingIds];
}

export async function findCategorySuggestions(q, limit, CategoryModel = Category) {
  const trimmed = q?.trim();
  if (!trimmed || trimmed.length < 2) return [];

  const all = await CategoryModel.find({ isActive: true })
    .select('slug nameAr nameEn icon image parentCategory sortOrder level')
    .sort({ level: 1, sortOrder: 1 })
    .lean();

  const byId = new Map(all.map((c) => [String(c._id), c]));
  const matched = [];

  for (const cat of all) {
    const chain = buildChainFromFlat(cat, byId);
    if (categoryMatchesQuery(cat, chain, trimmed)) {
      matched.push({ cat, chain });
    }
  }

  matched.sort((a, b) => {
    const normalized = normalizeSearchQuery(trimmed);
    const aExact = normalizeSearchQuery(a.cat.nameAr || '') === normalized
      || normalizeSearchQuery(a.cat.nameEn || '') === normalized ? 0 : 1;
    const bExact = normalizeSearchQuery(b.cat.nameAr || '') === normalized
      || normalizeSearchQuery(b.cat.nameEn || '') === normalized ? 0 : 1;
    if (aExact !== bExact) return aExact - bExact;
    return (a.chain.length - b.chain.length) || (a.cat.sortOrder || 0) - (b.cat.sortOrder || 0);
  });

  return matched.slice(0, limit).map(({ cat, chain }) => ({
    slug: cat.slug,
    nameAr: chain.map((c) => c.nameAr).filter(Boolean).join(' › '),
    nameEn: chain.map((c) => c.nameEn).filter(Boolean).join(' › '),
    icon: cat.icon,
    image: cat.image,
    pathSlugs: chain.map((c) => c.slug),
  }));
}

/**
 * Resolve product filter for a search query.
 * Matches product text (Arabic-aware), category names/paths, and Latin typo tolerance.
 */
export async function resolveProductSearchFilter(baseFilter, q, Product, CategoryModel = Category) {
  const trimmed = q?.trim();
  if (!trimmed) return { filter: baseFilter, useTextScore: false };

  const categoryIds = await findMatchingCategoryIds(trimmed, CategoryModel);
  const categoryConditions = buildCategoryProductConditions(categoryIds);
  const words = trimmed.split(/\s+/).filter(Boolean);

  if (words.length > 1) {
    const productMatch = {
      $and: words.map((word) => ({ $or: buildContainsOrConditions(word) })),
    };
    const orClauses = [productMatch];
    if (categoryConditions.length) {
      orClauses.push({ $or: categoryConditions });
    }
    return {
      filter: { ...baseFilter, $or: orClauses },
      useTextScore: false,
    };
  }

  if (isMostlyLatin(trimmed)) {
    const textFilter = { ...baseFilter, $text: { $search: trimmed } };
    const textCount = await Product.countDocuments(textFilter);
    if (textCount > 0) {
      return { filter: textFilter, useTextScore: true };
    }
  }

  const orClauses = [
    ...buildContainsOrConditions(trimmed),
    ...categoryConditions,
  ];

  if (isMostlyLatin(trimmed)) {
    orClauses.push(...buildFuzzyOrConditions(trimmed));
  }

  return {
    filter: { ...baseFilter, $or: orClauses },
    useTextScore: false,
  };
}
