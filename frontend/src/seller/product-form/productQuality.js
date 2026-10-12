/**
 * Listing quality checklist — each item says what's missing and jumps to its step.
 * Returns [{ id, done, section, ar, en }].
 */
export function qualityChecks(form) {
  const descLen = (form.descriptionAr.trim().length + form.descriptionEn.trim().length) / 2;
  const images = form.media.filter((m) => m.type !== 'video').length;
  const stock = form.variants.length
    ? form.variants.reduce((s, v) => s + (Number(v.stock) || 0), 0)
    : Number(form.stock) || 0;
  return [
    { id: 'names', section: 'basics', done: Boolean(form.nameAr.trim() && form.nameEn.trim()), ar: 'الاسم بالعربية والإنجليزية', en: 'Arabic & English name' },
    { id: 'desc', section: 'basics', done: descLen >= 60, ar: 'وصف مفصّل (60 حرفاً على الأقل)', en: 'A detailed description (60+ chars)' },
    { id: 'brand', section: 'basics', done: Boolean(form.brand.trim()), ar: 'العلامة التجارية', en: 'Brand' },
    { id: 'photo', section: 'media', done: images >= 1, ar: 'صورة رئيسية', en: 'A main photo' },
    { id: 'photos', section: 'media', done: images >= 3, ar: '3 صور أو أكثر', en: '3 or more photos' },
    { id: 'price', section: 'pricing', done: Number(form.price) > 0, ar: 'السعر', en: 'Price' },
    { id: 'stock', section: form.variants.length ? 'variants' : 'pricing', done: stock > 0 || form.fulfilledBy === 'store', ar: 'مخزون متاح', en: 'Stock available' },
    { id: 'section', section: 'categories', done: form.sellerCategories.length > 0, ar: 'قسم في متجرك', en: 'One of your store sections' },
    { id: 'category', section: 'categories', done: Boolean(form.category), ar: 'قسم المنصة', en: 'Marketplace category' },
    { id: 'specs', section: 'details', done: form.specs.filter((s) => (s.valueAr || s.valueEn)).length >= 2, ar: 'مواصفتان على الأقل', en: 'At least 2 specifications' },
  ];
}
