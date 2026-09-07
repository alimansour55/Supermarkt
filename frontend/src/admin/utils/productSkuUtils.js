function cleanPart(str, maxLen = 10) {
  return String(str || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, maxLen);
}

function extractSizeHint(nameEn = '', unit = '') {
  const combined = `${nameEn} ${unit}`;
  const match = combined.match(/(\d+)\s*(ml|g|kg|l|oz|pack|pcs?)?/i);
  return match ? match[1] : '';
}

export function buildLocalSkuCandidates({
  nameEn = '',
  brand = '',
  unit = '',
  slug = '',
  categorySlug = '',
}) {
  const brandPart = cleanPart(brand, 4) || 'GEN';
  const namePart = cleanPart(nameEn, 10) || cleanPart(slug.replace(/-/g, ''), 10) || 'ITEM';
  const catPart = cleanPart(categorySlug.replace(/-/g, ''), 4);
  const size = extractSizeHint(nameEn, unit);
  const slugPart = cleanPart(slug.replace(/-/g, ''), 12);

  const candidates = [];
  if (size) candidates.push(`MP-${brandPart}-${namePart.slice(0, 6)}${size}`);
  candidates.push(`MP-${brandPart}-${namePart}`);
  if (catPart && catPart !== brandPart) candidates.push(`MP-${catPart}-${namePart}`);
  if (slugPart) candidates.push(`MP-${slugPart}`);

  return [...new Set(candidates.filter(Boolean))];
}

export function buildVariantSku(parentSku, valueEn = '', valueAr = '') {
  const suffix = cleanPart(valueEn || valueAr, 8);
  if (!parentSku || !suffix) return '';
  return `${parentSku}-${suffix}`;
}
