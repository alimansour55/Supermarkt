export function resolveRequestLang(source = {}) {
  const raw = source?.lang ?? source?.language;
  return raw === 'en' ? 'en' : 'ar';
}

export function productDisplayName(line, lang = 'ar') {
  if (!line) return lang === 'ar' ? 'المنتج' : 'this product';
  return lang === 'ar'
    ? (line.nameAr || line.nameEn || 'المنتج')
    : (line.nameEn || line.nameAr || 'this product');
}

export function formatInsufficientStockMessage(line, lang = 'ar') {
  const name = productDisplayName(line, lang);
  if (lang === 'en') {
    return `Insufficient stock for ${name}`;
  }
  return `عذرًا، الكمية المتوفرة من المنتج ${name} لا تكفي لإتمام الطلب.`;
}

export function formatGenericInsufficientStock(lang = 'ar') {
  if (lang === 'en') return 'Insufficient stock';
  return 'عذرًا، الكمية المتوفرة لا تكفي لإتمام الطلب.';
}
