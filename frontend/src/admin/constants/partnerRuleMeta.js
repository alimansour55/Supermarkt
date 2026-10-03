/** Frontend mirror of backend/src/constants/partnerRevenueDefaults.js rule meta. */

export const RULE_SCOPES = [
  { value: 'order', labelAr: 'الطلب كامل', labelEn: 'Whole order', descAr: 'شروط على مستوى الطلب', descEn: 'Order-level conditions' },
  { value: 'line', labelAr: 'سطر المنتج', labelEn: 'Per product line', descAr: 'يُقيَّم كل سطر منتج على حدة', descEn: 'Evaluated per matching product line' },
];

export const RULE_BASES = [
  { value: 'orderTotal', labelAr: 'إجمالي الطلب', labelEn: 'Order total', orderOnly: true },
  { value: 'orderSubtotal', labelAr: 'مبيعات الطلب (بدون شحن)', labelEn: 'Order subtotal', orderOnly: true },
  { value: 'orderGrossProfit', labelAr: 'ربح الطلب', labelEn: 'Order gross profit', orderOnly: true },
  { value: 'lineRevenue', labelAr: 'إيراد الأسطر المطابقة', labelEn: 'Matching line revenue', orderOnly: false },
  { value: 'lineGrossProfit', labelAr: 'ربح الأسطر المطابقة', labelEn: 'Matching line gross profit', orderOnly: false },
  { value: 'deliveryFee', labelAr: 'رسوم التوصيل', labelEn: 'Delivery fee', orderOnly: true },
];

export const RULE_RATE_TYPES = [
  { value: 'percent', labelAr: 'نسبة %', labelEn: 'Percentage %' },
  { value: 'fixedPerOrder', labelAr: 'مبلغ ثابت / طلب', labelEn: 'Fixed / order' },
  { value: 'fixedPerUnit', labelAr: 'مبلغ ثابت / قطعة', labelEn: 'Fixed / unit' },
  { value: 'tiered', labelAr: 'شرائح حسب القيمة', labelEn: 'Tiered by value' },
];

export const CUSTOMER_TYPES = [
  { value: 'any', labelAr: 'أي عميل', labelEn: 'Any customer' },
  { value: 'new', labelAr: 'أول طلب فقط', labelEn: 'First order only' },
  { value: 'returning', labelAr: 'عملاء متكررون', labelEn: 'Returning customers' },
];

export const PAYMENT_METHOD_OPTIONS = [
  { value: 'cod', labelAr: 'الدفع عند الاستلام', labelEn: 'Cash on delivery' },
  { value: 'paymob_card', labelAr: 'بطاقة / Apple Pay (Paymob)', labelEn: 'Card / Apple Pay (Paymob)' },
  { value: 'paymob_wallet', labelAr: 'محفظة إلكترونية (Paymob)', labelEn: 'Mobile wallet (Paymob)' },
  { value: 'paymob_valu', labelAr: 'valU (Paymob)', labelEn: 'valU (Paymob)' },
  { value: 'fawry', labelAr: 'فوري', labelEn: 'Fawry' },
  { value: 'stripe', labelAr: 'بطاقة (Stripe)', labelEn: 'Card (Stripe)' },
  { value: 'instapay', labelAr: 'إنستاباي', labelEn: 'InstaPay' },
  { value: 'vodafone_cash', labelAr: 'فودافون كاش', labelEn: 'Vodafone Cash' },
];

export const DELIVERY_METHOD_OPTIONS = [
  { value: 'scheduled', labelAr: 'مجدول', labelEn: 'Scheduled' },
  { value: 'express', labelAr: 'سريع', labelEn: 'Express' },
  { value: 'recurring', labelAr: 'متكرر', labelEn: 'Recurring' },
];

export const WEEKDAYS = [
  { value: 0, labelAr: 'الأحد', labelEn: 'Sun' },
  { value: 1, labelAr: 'الإثنين', labelEn: 'Mon' },
  { value: 2, labelAr: 'الثلاثاء', labelEn: 'Tue' },
  { value: 3, labelAr: 'الأربعاء', labelEn: 'Wed' },
  { value: 4, labelAr: 'الخميس', labelEn: 'Thu' },
  { value: 5, labelAr: 'الجمعة', labelEn: 'Fri' },
  { value: 6, labelAr: 'السبت', labelEn: 'Sat' },
];

export const LEDGER_TYPES = [
  { value: 'bonus', labelAr: 'مكافأة', labelEn: 'Bonus', sign: 1 },
  { value: 'reimbursement', labelAr: 'استرداد مصروف', labelEn: 'Reimbursement', sign: 1 },
  { value: 'correction', labelAr: 'تصحيح', labelEn: 'Correction', sign: 1 },
  { value: 'opening_balance', labelAr: 'رصيد افتتاحي', labelEn: 'Opening balance', sign: 1 },
  { value: 'deduction', labelAr: 'خصم', labelEn: 'Deduction', sign: -1 },
  { value: 'advance', labelAr: 'سلفة', labelEn: 'Advance', sign: -1 },
];

export const PARTNER_STATUS_OPTIONS = [
  { value: 'active', labelAr: 'نشط', labelEn: 'Active' },
  { value: 'paused', labelAr: 'موقوف مؤقتاً', labelEn: 'Paused' },
  { value: 'archived', labelAr: 'مؤرشف', labelEn: 'Archived' },
];

export const EMPTY_RULE_CONDITIONS = {
  customers: [],
  customerType: 'any',
  minCustomerOrderCount: null,
  maxCustomerOrderCount: null,
  deliveryZones: [],
  cities: [],
  governorates: [],
  fulfillmentLocations: [],
  products: [],
  categories: [],
  brands: [],
  promotions: [],
  couponCodes: [],
  paymentMethods: [],
  deliveryMethods: [],
  minOrderValue: null,
  maxOrderValue: null,
  weekdays: [],
  dateFromKey: '',
  dateToKey: '',
};

export function emptyRule(partnerKey = '') {
  return {
    _id: null,
    name: '',
    description: '',
    enabled: true,
    priority: 100,
    source: 'manual',
    sourcePartnerKey: '',
    scope: 'order',
    basis: 'lineRevenue',
    rate: { type: 'percent', value: 15, tiers: [] },
    stackable: false,
    beneficiaries: partnerKey ? [{ partnerKey, sharePercent: 100 }] : [],
    conditions: { ...EMPTY_RULE_CONDITIONS },
  };
}

export function conditionCount(conditions = {}) {
  let n = 0;
  for (const [k, v] of Object.entries(conditions)) {
    if (k === 'customerType') { if (v && v !== 'any') n += 1; continue; }
    if (Array.isArray(v)) n += v.length ? 1 : 0;
    else if (v != null && v !== '') n += 1;
  }
  return n;
}

export function summarizeRule(rule, isAr) {
  const c = rule.conditions || {};
  const parts = [];
  const push = (ar, en) => parts.push(isAr ? ar : en);
  if (c.customers?.length) push(`${c.customers.length} عميل`, `${c.customers.length} customer(s)`);
  if (c.customerType && c.customerType !== 'any') {
    const t = CUSTOMER_TYPES.find((x) => x.value === c.customerType);
    push(t?.labelAr, t?.labelEn);
  }
  if (c.deliveryZones?.length) push(`${c.deliveryZones.length} منطقة`, `${c.deliveryZones.length} zone(s)`);
  if (c.cities?.length) push(`مدن: ${c.cities.join(', ')}`, `cities: ${c.cities.join(', ')}`);
  if (c.governorates?.length) push(`محافظات: ${c.governorates.join(', ')}`, `gov: ${c.governorates.join(', ')}`);
  if (c.fulfillmentLocations?.length) push(`${c.fulfillmentLocations.length} موقع شحن`, `${c.fulfillmentLocations.length} location(s)`);
  if (c.products?.length) push(`${c.products.length} منتج`, `${c.products.length} product(s)`);
  if (c.categories?.length) push(`${c.categories.length} قسم`, `${c.categories.length} categor(y/ies)`);
  if (c.brands?.length) push(`${c.brands.length} علامة`, `${c.brands.length} brand(s)`);
  if (c.promotions?.length) push(`${c.promotions.length} عرض`, `${c.promotions.length} promo(s)`);
  if (c.couponCodes?.length) push(`كوبونات: ${c.couponCodes.join(', ')}`, `coupons: ${c.couponCodes.join(', ')}`);
  if (c.paymentMethods?.length) push(`دفع: ${c.paymentMethods.join(', ')}`, `payment: ${c.paymentMethods.join(', ')}`);
  if (c.deliveryMethods?.length) push(`توصيل: ${c.deliveryMethods.join(', ')}`, `delivery: ${c.deliveryMethods.join(', ')}`);
  if (c.minOrderValue != null) push(`≥ ${c.minOrderValue}`, `≥ ${c.minOrderValue}`);
  if (c.maxOrderValue != null) push(`≤ ${c.maxOrderValue}`, `≤ ${c.maxOrderValue}`);
  if (c.weekdays?.length) push(`أيام: ${c.weekdays.length}`, `${c.weekdays.length} weekday(s)`);
  if (c.dateFromKey || c.dateToKey) push(`${c.dateFromKey || '…'} → ${c.dateToKey || '…'}`, `${c.dateFromKey || '…'} → ${c.dateToKey || '…'}`);
  if (!parts.length) push('كل الطلبات', 'every order');
  return parts.join(' • ');
}

export function describeRate(rule, isAr) {
  const { type, value } = rule.rate || {};
  const basis = RULE_BASES.find((b) => b.value === rule.basis);
  const basisLabel = isAr ? basis?.labelAr : basis?.labelEn;
  if (type === 'fixedPerOrder') return isAr ? `${value} لكل طلب` : `${value} per order`;
  if (type === 'fixedPerUnit') return isAr ? `${value} لكل قطعة` : `${value} per unit`;
  if (type === 'tiered') return isAr ? `شرائح على ${basisLabel}` : `tiered on ${basisLabel}`;
  return isAr ? `${value}% من ${basisLabel}` : `${value}% of ${basisLabel}`;
}
