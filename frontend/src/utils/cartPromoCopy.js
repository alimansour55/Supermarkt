/** Admin-managed cart / checkout offer copy with template variables. */

import { buildQtyPromoBadge, getPromoUnitMeta, getSecondItemQtyBreakdown } from './promotionDisplay';
import { formatPrice } from './formatters';

export const CART_PROMO_VARIABLES = [
  { key: 'paid', labelAr: 'الكمية المدفوعة في السلة', labelEn: 'Paid qty in cart' },
  { key: 'free', labelAr: 'الكمية المجانية (هدية)', labelEn: 'Free gift qty' },
  { key: 'total', labelAr: 'الإجمالي (مدفوع + هدية)', labelEn: 'Total (paid + free)' },
  { key: 'need', labelAr: 'كم ينقص للحصول على الهدية', labelEn: 'Qty still needed for gift' },
  { key: 'buy', labelAr: 'كمية الشراء في العرض', labelEn: 'Buy qty in deal rules' },
  { key: 'get', labelAr: 'كمية الهدية في العرض', labelEn: 'Free qty in deal rules' },
  { key: 'unit', labelAr: 'وحدة مختصرة (ل، ك.ل، قطع)', labelEn: 'Unit short (L, kg, pcs)' },
  { key: 'badge', labelAr: 'شارة العرض (3+1 ل)', labelEn: 'Offer badge (3+1 L)' },
  { key: 'discount', labelAr: 'نسبة الخصم %', labelEn: 'Discount percent' },
  { key: 'secondOff', labelAr: 'خصم القطعة الثانية %', labelEn: '2nd item discount %' },
  { key: 'firstPrice', labelAr: 'سعر القطعة الأولى', labelEn: '1st item price' },
  { key: 'secondPrice', labelAr: 'سعر القطعة الثانية', labelEn: '2nd item price' },
  { key: 'fullQty', labelAr: 'عدد القطع بسعر كامل', labelEn: 'Full-price qty' },
  { key: 'discountQty', labelAr: 'عدد القطع المخفّضة (2، 4، 6…)', labelEn: 'Discounted qty (2nd, 4th…)' },
  { key: 'lineTotal', labelAr: 'إجمالي السطر', labelEn: 'Line total' },
];

export function buildCartPromoVars({
  paid = 0,
  free = 0,
  total = 0,
  need = 0,
  buy = 1,
  get = 1,
  unit = 'pieces',
  badge = '',
  secondOff = 0,
  discount = 0,
  firstPrice = '',
  secondPrice = '',
  fullQty = '',
  discountQty = '',
  lineTotal = '',
  isAr = true,
} = {}) {
  const meta = getPromoUnitMeta(unit);
  const unitShort = isAr ? meta.shortAr : meta.shortEn;
  const pct = secondOff || discount || 0;
  return {
    paid,
    free,
    total,
    need,
    buy,
    get,
    unit: unitShort,
    unitShort,
    badge,
    discount: pct,
    secondOff: pct,
    firstPrice,
    secondPrice,
    fullQty,
    discountQty,
    lineTotal,
  };
}

export function renderCartPromoTemplate(template, vars = {}) {
  if (!template) return '';
  return String(template).replace(/\{(\w+)\}/g, (_, key) => {
    const value = vars[key];
    return value != null && value !== '' ? String(value) : `{${key}}`;
  });
}

/** Default summary line when customer earned free items. */
export function defaultQtyEarnedTemplate(unit = 'pieces', isAr = true) {
  if (isAr) {
    if (unit === 'pieces') return '{paid} + {free} هدية = {total} قطع';
    return '{paid} {unit} + {free} هدية = {total} {unit}';
  }
  if (unit === 'pieces') return 'Bought {paid} + {free} free = {total} pcs';
  return 'Bought {paid} {unit} + {free} free = {total} {unit}';
}

/** Default line when cart qty is below the deal threshold. */
export function defaultQtyProgressTemplate(_unit = 'pieces', isAr = true) {
  if (isAr) {
    return 'عرض {badge} — أضف {need} {unit} للحصول على {get} مجاناً';
  }
  return '{badge} — add {need} {unit} for {get} free';
}

export function defaultDiscountCartTemplate(isAr = true) {
  return isAr ? 'خصم {discount}% — السعر يشمل العرض' : '{discount}% off — sale price applied';
}

export function defaultGenericCartTemplate(isAr = true) {
  return isAr ? 'عرض {badge} — يُطبّق على هذا المنتج' : '{badge} — applied to this item';
}

export function defaultSecondItemCartTemplate(isAr = true) {
  return isAr
    ? '{fullQty} × {firstPrice} + {discountQty} × {secondPrice} = {lineTotal}'
    : '{fullQty} × {firstPrice} + {discountQty} × {secondPrice} = {lineTotal}';
}

export function defaultSecondItemProgressTemplate(isAr = true) {
  return isAr
    ? 'أضف {unit} — {unit} الثاني {secondPrice} (خصم {secondOff}%)'
    : 'Add {unit} — 2nd {unit} {secondPrice} ({secondOff}% off)';
}

export function defaultQtySubtextTemplate(unit = 'pieces', buy = 1, get = 1, isAr = true) {
  if (unit === 'pieces') {
    if (buy === 1 && get === 1) {
      return isAr ? 'اشتري واحد واحصل على واحد مجاناً' : 'Buy one, get one free';
    }
    return isAr
      ? `اشتري {buy} {unit} واحصل على {get} مجاناً`
      : `Buy {buy} {unit}, get {get} free`;
  }
  return isAr
    ? `اشتري {buy} {unit} واحصل على {get} {unit} مجاناً`
    : `Buy {buy} {unit}, get {get} {unit} free`;
}

export function getCartPromoSuggestions({ type, unit = 'pieces', buy = 1, get = 1, isAr = true }) {
  const earned = defaultQtyEarnedTemplate(unit, isAr);
  const progress = defaultQtyProgressTemplate(unit, isAr);
  const narrative = isAr
    ? 'اشتريت {paid} {unit} واحصلت على {free} مجاناً = {total} {unit}'
    : 'Bought {paid} {unit}, got {free} free = {total} {unit}';
  const compact = isAr ? '{paid}+{free}={total}' : '{paid}+{free}={total}';

  if (type === 'bogo' || type === 'buy_x_get_y') {
    return [
      { id: 'summary', label: isAr ? 'ملخص (موصى به)' : 'Summary (recommended)', line: earned },
      { id: 'narrative', label: isAr ? 'صيغة «اشتريت…»' : '“Bought…” narrative', line: narrative },
      { id: 'compact', label: isAr ? 'مختصر' : 'Compact', line: compact },
      { id: 'progress', label: isAr ? 'قبل اكتمال العرض' : 'Before deal completes', line: progress, field: 'progress' },
      {
        id: 'subtext',
        label: isAr ? 'سطر توضيحي (اختياري)' : 'Optional subtext',
        line: defaultQtySubtextTemplate(unit, buy, get, isAr),
        field: 'subtext',
      },
    ];
  }

  if (type === 'percent_off' || type === 'amount_off' || type === 'fixed_price') {
    return [
      { id: 'discount', label: isAr ? 'خصم %' : 'Percent off', line: defaultDiscountCartTemplate(isAr) },
      { id: 'badge', label: isAr ? 'مع الشارة' : 'With badge', line: isAr ? '{badge} — خصم {discount}%' : '{badge} — {discount}% off' },
    ];
  }

  if (type === 'second_percent_off') {
    return [
      { id: 'second_main', label: isAr ? 'خصم الثانية (موصى به)' : '2nd item off (recommended)', line: defaultSecondItemCartTemplate(isAr) },
      { id: 'second_progress', label: isAr ? 'قبل قطعتين' : 'Before 2 items', line: defaultSecondItemProgressTemplate(isAr), field: 'progress' },
      { id: 'second_badge', label: isAr ? 'مع الشارة' : 'With badge', line: isAr ? '{badge} — الثانية {secondOff}%' : '{badge} — 2nd {secondOff}% off' },
    ];
  }

  return [
    { id: 'generic', label: isAr ? 'عرض عام' : 'Generic offer', line: defaultGenericCartTemplate(isAr) },
    { id: 'badge_only', label: isAr ? 'الشارة فقط' : 'Badge only', line: '{badge}' },
  ];
}

export function resolveQtyCartCopy(item, {
  paidQty,
  freeQty,
  totalQty,
  need,
  buyQty,
  getQty,
  unit,
  badge,
  isAr,
  variant = 'earned',
}) {
  const vars = buildCartPromoVars({
    paid: paidQty,
    free: freeQty,
    total: totalQty,
    need,
    buy: buyQty,
    get: getQty,
    unit,
    badge,
    isAr,
  });

  const customLine = variant === 'progress'
    ? (isAr ? item?.promotionCartProgressAr : item?.promotionCartProgressEn)
    : (isAr ? item?.promotionCartLineAr : item?.promotionCartLineEn);

  const template = customLine || (variant === 'progress'
    ? defaultQtyProgressTemplate(unit, isAr)
    : defaultQtyEarnedTemplate(unit, isAr));

  return renderCartPromoTemplate(template, vars);
}

export function resolveQtyCartSubtext(item, { buyQty, getQty, unit, badge, isAr }) {
  const custom = isAr ? item?.promotionCartSubtextAr : item?.promotionCartSubtextEn;
  if (custom === '') return null;
  if (custom) {
    return renderCartPromoTemplate(custom, buildCartPromoVars({ buy: buyQty, get: getQty, unit, badge, isAr }));
  }
  return null;
}

export function resolveDiscountCartCopy(item, discount, isAr) {
  const custom = isAr ? item?.promotionCartLineAr : item?.promotionCartLineEn;
  const badge = isAr ? (item?.offerBadgeAr || item?.offerBadgeEn) : (item?.offerBadgeEn || item?.offerBadgeAr);
  const vars = buildCartPromoVars({ discount, badge, isAr });
  const template = custom || defaultDiscountCartTemplate(isAr);
  return renderCartPromoTemplate(template, vars);
}

export function resolveGenericCartCopy(item, isAr) {
  const custom = isAr ? item?.promotionCartLineAr : item?.promotionCartLineEn;
  const badge = isAr
    ? (item?.offerBadgeAr || item?.offerBadgeEn || 'عرض')
    : (item?.offerBadgeEn || item?.offerBadgeAr || 'Offer');
  const vars = buildCartPromoVars({ badge, isAr });
  const template = custom || defaultGenericCartTemplate(isAr);
  return renderCartPromoTemplate(template, vars);
}

export function resolveSecondItemCartCopy(item, secondOff, quantity, isAr) {
  const pct = Math.max(1, Math.min(100, Math.round(Number(secondOff) || 50)));
  const qty = Math.max(0, Number(quantity) || 0);
  const firstRaw = Number(item?.price) || 0;
  const breakdown = getSecondItemQtyBreakdown(qty, firstRaw, pct);
  const unit = item?.promotionUnit || 'pieces';
  const meta = getPromoUnitMeta(unit);
  const badge = isAr
    ? (item?.offerBadgeAr || item?.offerBadgeEn || `الثاني -${pct}%`)
    : (item?.offerBadgeEn || item?.offerBadgeAr || `2nd -${pct}%`);
  const vars = buildCartPromoVars({
    badge,
    secondOff: pct,
    discount: pct,
    unit: isAr ? meta.shortAr : meta.shortEn,
    firstPrice: formatPrice(firstRaw),
    secondPrice: formatPrice(breakdown.discountedUnitPrice),
    fullQty: breakdown.fullQty,
    discountQty: breakdown.discountQty,
    lineTotal: formatPrice(breakdown.total),
    isAr,
  });

  if (qty >= 2) {
    const custom = isAr ? item?.promotionCartLineAr : item?.promotionCartLineEn;
    const customSupportsMultiQty = custom && /\{(fullQty|discountQty|lineTotal)\}/.test(custom);
    const template = custom && (qty === 2 || customSupportsMultiQty)
      ? custom
      : (customSupportsMultiQty ? custom : defaultSecondItemCartTemplate(isAr));
    return renderCartPromoTemplate(template, vars);
  }

  const customProgress = isAr ? item?.promotionCartProgressAr : item?.promotionCartProgressEn;
  const template = customProgress || defaultSecondItemProgressTemplate(isAr);
  return renderCartPromoTemplate(template, vars);
}

/** Preview helper for admin editor. */
export function previewCartCopyTemplates(form, isAr) {
  const rules = form?.rules || {};
  const unit = rules.promotionUnit || 'pieces';
  const buy = Math.max(1, Number(rules.buyQty) || 1);
  const get = Math.max(1, Number(rules.getQty) || 1);
  const badge = buildQtyPromoBadge(buy, get, unit, isAr);
  const paid = buy;
  const free = get;
  const total = paid + free;
  const need = buy - 1;

  const item = {
    promotionCartLineAr: form.cartLineAr,
    promotionCartLineEn: form.cartLineEn,
    promotionCartProgressAr: form.cartProgressAr,
    promotionCartProgressEn: form.cartProgressEn,
    promotionCartSubtextAr: form.cartSubtextAr,
    promotionCartSubtextEn: form.cartSubtextEn,
    offerBadgeAr: form.badgeAr,
    offerBadgeEn: form.badgeEn,
  };

  return {
    earned: resolveQtyCartCopy(item, {
      paidQty: paid,
      freeQty: free,
      totalQty: total,
      need,
      buyQty: buy,
      getQty: get,
      unit,
      badge,
      isAr,
      variant: 'earned',
    }),
    progress: resolveQtyCartCopy(item, {
      paidQty: 1,
      freeQty: 0,
      totalQty: 1,
      need,
      buyQty: buy,
      getQty: get,
      unit,
      badge,
      isAr,
      variant: 'progress',
    }),
    subtext: resolveQtyCartSubtext(item, { buyQty: buy, getQty: get, unit, badge, isAr }),
  };
}

export function suggestedCartCopyFields(form, _isAr) {
  const rules = form?.rules || {};
  const unit = rules.promotionUnit || 'pieces';
  const type = form?.type || 'bogo';

  if (type === 'bogo' || type === 'buy_x_get_y') {
    return {
      cartLineAr: defaultQtyEarnedTemplate(unit, true),
      cartLineEn: defaultQtyEarnedTemplate(unit, false),
      cartProgressAr: defaultQtyProgressTemplate(unit, true),
      cartProgressEn: defaultQtyProgressTemplate(unit, false),
      cartSubtextAr: '',
      cartSubtextEn: '',
    };
  }

  if (['percent_off', 'amount_off', 'fixed_price'].includes(type)) {
    return {
      cartLineAr: defaultDiscountCartTemplate(true),
      cartLineEn: defaultDiscountCartTemplate(false),
      cartProgressAr: '',
      cartProgressEn: '',
      cartSubtextAr: '',
      cartSubtextEn: '',
    };
  }

  if (type === 'second_percent_off') {
    return {
      cartLineAr: defaultSecondItemCartTemplate(true),
      cartLineEn: defaultSecondItemCartTemplate(false),
      cartProgressAr: defaultSecondItemProgressTemplate(true),
      cartProgressEn: defaultSecondItemProgressTemplate(false),
      cartSubtextAr: '',
      cartSubtextEn: '',
    };
  }

  return {
    cartLineAr: defaultGenericCartTemplate(true),
    cartLineEn: defaultGenericCartTemplate(false),
    cartProgressAr: '',
    cartProgressEn: '',
    cartSubtextAr: '',
    cartSubtextEn: '',
  };
}
