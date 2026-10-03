export const PRODUCT_UNITS = [
  { value: 'piece', ar: 'قطعة', en: 'Piece' },
  { value: 'kg', ar: 'كيلوغرام', en: 'Kilogram' },
  { value: 'g', ar: 'جرام', en: 'Gram' },
  { value: 'l', ar: 'لتر', en: 'Liter' },
  { value: 'ml', ar: 'ملليلتر', en: 'Milliliter' },
  { value: 'pack', ar: 'عبوة', en: 'Pack' },
  { value: 'box', ar: 'كرتونة', en: 'Box' },
  { value: 'dozen', ar: 'دستة', en: 'Dozen' },
  { value: 'bottle', ar: 'زجاجة', en: 'Bottle' },
  { value: 'can', ar: 'علبة', en: 'Can' },
];

export const CUSTOM_UNIT_VALUE = '__custom__';

export function findUnitOption(value) {
  return PRODUCT_UNITS.find((u) => u.value === value);
}

/** Localized unit label for display — falls back to whatever raw string is stored. */
export function getUnitLabel(product, isAr) {
  if (!product) return '';
  const localized = isAr ? product.unitAr : product.unitEn;
  if (localized) return localized;
  const option = findUnitOption(product.unit);
  if (option) return isAr ? option.ar : option.en;
  return product.unit || '';
}
