/** Normalize Arabic text for fuzzy matching (alef/ya/ta marbuta). */
export function normalizeArabicQuery(text) {
  return String(text || '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}

const POI_PREFIX_RE = /^(صيدليه|صيدلية|صيدليه|سوبر\s*ماركت|سوبر|محل|مكتب|مستشفى|مستشفى|عياده|عيادة|كافيه|كافيه|مطعم|بنك|مدرسه|مدرسة|فرع|مركز)\s+/iu;

/** Build alternate search strings (strip POI type words, append country). */
export function buildAddressSearchVariants(input, language = 'ar') {
  const query = String(input || '').trim();
  if (!query) return [];

  const variants = [query];
  const stripped = query.replace(POI_PREFIX_RE, '').trim();
  if (stripped.length >= 2 && stripped !== query) variants.push(stripped);

  if (!/مصر|egypt/i.test(query)) {
    variants.push(language === 'en' ? `${query}, Egypt` : `${query}، مصر`);
    if (stripped.length >= 2) {
      variants.push(language === 'en' ? `${stripped}, Egypt` : `${stripped}، مصر`);
    }
  }

  return [...new Set(variants)];
}

/** Rank suggestions by how closely they match the user query. */
export function rankAddressSuggestions(items, query) {
  const normalizedQuery = normalizeArabicQuery(query);
  if (!normalizedQuery) return items;

  const score = (item) => {
    const hay = normalizeArabicQuery(
      [item.mainText, item.description, item.secondaryText].filter(Boolean).join(' '),
    );
    if (!hay) return 0;
    if (hay.includes(normalizedQuery)) return 100;

    const words = normalizedQuery.split(' ').filter((w) => w.length >= 2);
    if (!words.length) return 0;
    const matched = words.filter((w) => hay.includes(w)).length;
    return (matched / words.length) * 85;
  };

  return [...items].sort((a, b) => score(b) - score(a));
}
