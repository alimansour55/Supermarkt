export const PROMOTION_TYPES = [
  {
    value: 'percent_off',
    labelAr: 'خصم نسبة مئوية',
    labelEn: 'Percentage off',
    hintAr: 'مثال: خصم 20% على السعر الحالي',
    hintEn: 'e.g. 20% off current price',
    priceEffect: true,
  },
  {
    value: 'amount_off',
    labelAr: 'خصم مبلغ ثابت',
    labelEn: 'Fixed amount off',
    hintAr: 'مثال: خصم 50 جنيه من السعر',
    hintEn: 'e.g. 50 EGP off',
    priceEffect: true,
  },
  {
    value: 'fixed_price',
    labelAr: 'سعر عرض ثابت',
    labelEn: 'Fixed sale price',
    hintAr: 'تحديد سعر العرض مباشرة',
    hintEn: 'Set an exact sale price',
    priceEffect: true,
  },
  {
    value: 'bogo',
    labelAr: 'اشتري واحد واحصل على واحد',
    labelEn: 'Buy one get one (BOGO)',
    hintAr: '1+1 — يُطبّق في السلة',
    hintEn: '1+1 — applied at checkout',
    priceEffect: false,
  },
  {
    value: 'buy_x_get_y',
    labelAr: 'اشتري X واحصل على Y',
    labelEn: 'Buy X get Y free',
    hintAr: 'مثال: اشتري 2 واحصل على 1 مجاناً',
    hintEn: 'e.g. buy 2 get 1 free',
    priceEffect: false,
  },
  {
    value: 'second_percent_off',
    labelAr: 'خصم على القطعة الثانية',
    labelEn: 'Second item % off',
    hintAr: 'مثال: الثاني بنصف السعر (50%)',
    hintEn: 'e.g. 50% off 2nd item',
    priceEffect: false,
  },
  {
    value: 'bundle',
    labelAr: 'باقة بسعر خاص',
    labelEn: 'Bundle deal',
    hintAr: 'مجموعة منتجات بسعر واحد',
    hintEn: 'Multiple products at one bundle price',
    priceEffect: false,
  },
];

export const PROMOTION_TARGET_MODES = [
  { value: 'all', labelAr: 'كل المنتجات', labelEn: 'All products' },
  { value: 'products', labelAr: 'منتجات محددة', labelEn: 'Selected products' },
  { value: 'categories', labelAr: 'أقسام', labelEn: 'Categories' },
  { value: 'brands', labelAr: 'ماركات', labelEn: 'Brands' },
];

export const PRICE_EFFECT_TYPES = PROMOTION_TYPES.filter((t) => t.priceEffect).map((t) => t.value);

export function getPromotionTypeMeta(type) {
  return PROMOTION_TYPES.find((t) => t.value === type) || PROMOTION_TYPES[0];
}
