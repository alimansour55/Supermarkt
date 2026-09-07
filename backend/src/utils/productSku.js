import Product from '../models/Product.js';

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

export function buildSkuCandidates({
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

export async function isSkuAvailable(sku, excludeProductId) {
  if (!sku?.trim()) return false;
  const filter = { sku: sku.trim() };
  if (excludeProductId) filter._id = { $ne: excludeProductId };
  const exists = await Product.exists(filter);
  return !exists;
}

export async function findFirstAvailableSku(candidates = [], excludeProductId) {
  for (const sku of candidates) {
    if (await isSkuAvailable(sku, excludeProductId)) return sku;
  }

  const base = candidates[0] || 'MP-ITEM';
  for (let i = 2; i < 1000; i += 1) {
    const sku = `${base}-${i}`;
    if (await isSkuAvailable(sku, excludeProductId)) return sku;
  }

  return `${base}-${Date.now().toString(36).toUpperCase()}`;
}

export async function resolveProductSku({
  sku,
  nameEn,
  brand,
  unit,
  slug,
  categorySlug,
  excludeProductId,
}) {
  const trimmed = sku?.trim();
  if (trimmed) {
    if (!(await isSkuAvailable(trimmed, excludeProductId))) {
      return findFirstAvailableSku([trimmed], excludeProductId);
    }
    return trimmed;
  }

  const candidates = buildSkuCandidates({ nameEn, brand, unit, slug, categorySlug });
  return findFirstAvailableSku(candidates, excludeProductId);
}

export function buildVariantSku(parentSku, valueEn = '', valueAr = '') {
  const suffix = cleanPart(valueEn || valueAr, 8);
  if (!parentSku || !suffix) return '';
  return `${parentSku}-${suffix}`;
}

export function generateBarcodeFromSeed(seed) {
  let h = 2166136261;
  const str = String(seed);
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const num = Math.abs(h) % 10000000000;
  return `622${String(num).padStart(10, '0')}`;
}
