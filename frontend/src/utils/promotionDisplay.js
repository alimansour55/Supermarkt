/** Storefront + cart labels for X+Y quantity promos (1+1 … 5+1, kg, liters). */

export const PROMOTION_UNIT_MODES = [
  {
    value: 'pieces',
    labelAr: 'قطع / عبوات',
    labelEn: 'Pieces (units)',
    shortAr: 'قطع',
    shortEn: 'pcs',
    buyLabelAr: 'اشتري (قطع)',
    buyLabelEn: 'Buy (units)',
    getLabelAr: 'مجاناً (قطع)',
    getLabelEn: 'Free (units)',
  },
  {
    value: 'weight_kg',
    labelAr: 'كيلوجرام',
    labelEn: 'Kilograms (kg)',
    shortAr: 'ك.ل',
    shortEn: 'kg',
    buyLabelAr: 'اشتري (ك.ل)',
    buyLabelEn: 'Buy (kg)',
    getLabelAr: 'مجاناً (ك.ل)',
    getLabelEn: 'Free (kg)',
  },
  {
    value: 'weight_l',
    labelAr: 'لتر',
    labelEn: 'Liters (L)',
    shortAr: 'ل',
    shortEn: 'L',
    buyLabelAr: 'اشتري (لتر)',
    buyLabelEn: 'Buy (liters)',
    getLabelAr: 'مجاناً (لتر)',
    getLabelEn: 'Free (liters)',
  },
];

export const QTY_PROMO_PRESETS = [
  { buy: 1, get: 1 },
  { buy: 2, get: 1 },
  { buy: 3, get: 1 },
  { buy: 4, get: 1 },
  { buy: 5, get: 1 },
];

export const QTY_PROMO_TYPES = new Set(['bogo', 'buy_x_get_y']);

export function getPromoUnitMeta(unit = 'pieces') {
  return PROMOTION_UNIT_MODES.find((u) => u.value === unit) || PROMOTION_UNIT_MODES[0];
}

export function buildQtyPromoBadge(buy, get, unit = 'pieces', isAr = true) {
  const b = Math.max(1, Number(buy) || 1);
  const g = Math.max(1, Number(get) || 1);
  const core = g === 1 ? `${b}+1` : `${b}+${g}`;
  const meta = getPromoUnitMeta(unit);
  if (unit === 'weight_kg') return isAr ? `${core} ${meta.shortAr}` : `${core} ${meta.shortEn}`;
  if (unit === 'weight_l') return isAr ? `${core} ${meta.shortAr}` : `${core} ${meta.shortEn}`;
  return core;
}

export function buildQtyPromoSubtitle(buy, get, unit = 'pieces', isAr = true) {
  const meta = getPromoUnitMeta(unit);
  const b = Math.max(1, Number(buy) || 1);
  const g = Math.max(1, Number(get) || 1);
  const u = isAr ? meta.shortAr : meta.shortEn;

  if (unit === 'pieces') {
    if (b === 1 && g === 1) {
      return isAr ? 'اشتري واحد واحصل على واحد مجاناً' : 'Buy one, get one free';
    }
    return isAr
      ? `اشتري ${b} ${u} واحصل على ${g} مجاناً`
      : `Buy ${b} ${u}, get ${g} free`;
  }

  return isAr
    ? `اشتري ${b} ${meta.shortAr} واحصل على ${g} ${meta.shortAr} مجاناً`
    : `Buy ${b} ${meta.shortEn}, get ${g} ${meta.shortEn} free`;
}

export function buildCartQtyPromoLine({ paidQty, freeQty, totalQty, unit = 'pieces', isAr = true }) {
  const meta = getPromoUnitMeta(unit);
  const u = isAr ? meta.shortAr : meta.shortEn;

  if (isAr) {
    if (unit === 'pieces') {
      return `${paidQty} + ${freeQty} هدية = ${totalQty} قطع`;
    }
    return `${paidQty} ${u} + ${freeQty} هدية = ${totalQty} ${u}`;
  }

  if (unit === 'pieces') {
    return `${paidQty} paid + ${freeQty} free = ${totalQty} units`;
  }
  return `${paidQty} ${u} paid + ${freeQty} ${u} free = ${totalQty} ${u}`;
}

export function badgesForQtyPromoRules(rules = {}) {
  const buy = Math.max(1, Number(rules.buyQty) || 1);
  const get = Math.max(1, Number(rules.getQty) || 1);
  const unit = rules.promotionUnit || 'pieces';
  return {
    badgeAr: buildQtyPromoBadge(buy, get, unit, true),
    badgeEn: buildQtyPromoBadge(buy, get, unit, false),
    type: buy === 1 && get === 1 ? 'bogo' : 'buy_x_get_y',
  };
}

export function qtyPromoFromProduct(product = {}) {
  const buy = product.promotionBuyQty ?? product.rules?.buyQty ?? 1;
  const get = product.promotionGetQty ?? product.rules?.getQty ?? 1;
  const unit = product.promotionUnit ?? product.rules?.promotionUnit ?? 'pieces';
  return { buy, get, unit };
}

export function isQtyPromoType(type) {
  return QTY_PROMO_TYPES.has(type);
}

/** Second-item-% promos (الثاني أرخص). */
export function buildSecondItemBadge(percent, isAr = true, unit = 'pieces') {
  const p = Math.max(1, Math.min(100, Math.round(Number(percent) || 50)));
  const core = isAr ? `الثاني -${p}%` : `2nd -${p}%`;
  if (unit === 'pieces') return core;
  const meta = getPromoUnitMeta(unit);
  return isAr ? `${core} ${meta.shortAr}` : `${core} ${meta.shortEn}`;
}

export function buildSecondItemSubtitle(percent, unit = 'pieces', isAr = true) {
  const p = Math.max(1, Math.min(100, Math.round(Number(percent) || 50)));
  const meta = getPromoUnitMeta(unit);
  if (unit === 'pieces') {
    return isAr ? `القطعة الثانية خصم ${p}%` : `${p}% off the 2nd item`;
  }
  return isAr
    ? `${meta.shortAr} الثاني خصم ${p}%`
    : `${p}% off 2nd ${meta.shortEn}`;
}

export function getSecondItemUnitLabels(unit = 'pieces', isAr = true) {
  const meta = getPromoUnitMeta(unit);
  if (unit === 'pieces') {
    return isAr
      ? { first: 'الأولى', second: 'الثانية' }
      : { first: '1st', second: '2nd' };
  }
  return isAr
    ? { first: `أول ${meta.shortAr}`, second: `${meta.shortAr} الثاني` }
    : { first: `1st ${meta.shortEn}`, second: `2nd ${meta.shortEn}` };
}

export function parseSecondPercentFromProduct(item = {}) {
  const stored = Number(item.promotionSecondPercentOff);
  if (stored > 0) return Math.round(stored);
  const raw = `${item?.offerBadgeAr || ''} ${item?.offerBadgeEn || ''}`;
  const m = raw.match(/(\d+)\s*%/);
  if (m) return Math.min(100, Math.max(1, Number(m[1])));
  return 50;
}

export function secondItemPromoFromProduct(product = {}) {
  return parseSecondPercentFromProduct(product);
}

export function calculateSecondPiecePrice(price, percent) {
  const base = Number(price) || 0;
  const pct = Math.max(0, Math.min(100, Number(percent) || 0));
  return Math.round(base * (1 - pct / 100) * 100) / 100;
}

/** Every 2nd, 4th, 6th… unit gets the discount (not just the first pair). */
export function getSecondItemQtyBreakdown(qty, price, percent) {
  const quantity = Math.max(0, Number(qty) || 0);
  const unitPrice = Number(price) || 0;
  const pct = Math.max(0, Math.min(100, Number(percent) || 0));
  const discountQty = Math.floor(quantity / 2);
  const fullQty = quantity - discountQty;
  const discountedUnitPrice = calculateSecondPiecePrice(unitPrice, pct);
  const fullTotal = fullQty * unitPrice;
  const discountTotal = discountQty * discountedUnitPrice;
  const total = Math.round((fullTotal + discountTotal) * 100) / 100;
  const savings = Math.round((quantity * unitPrice - total) * 100) / 100;
  return {
    qty: quantity,
    fullQty,
    discountQty,
    unitPrice,
    discountedUnitPrice,
    percent: pct,
    total,
    savings,
  };
}

export function buildSecondItemCartSummary(item, isAr = true) {
  const qty = Math.max(0, Number(item?.quantity) || 0);
  const price = Number(item?.price) || 0;
  const percent = parseSecondPercentFromProduct(item);
  const unit = item?.promotionUnit || 'pieces';
  const meta = getPromoUnitMeta(unit);
  const u = isAr ? meta.shortAr : meta.shortEn;
  const breakdown = getSecondItemQtyBreakdown(qty, price, percent);

  if (!qty || !price) return null;

  const fp = breakdown.unitPrice.toFixed(2);
  const sp = breakdown.discountedUnitPrice.toFixed(2);
  const total = breakdown.total.toFixed(2);

  if (qty === 1) {
    return isAr
      ? `أضف ${u} آخر — ${u} الثاني ${sp} EGP (خصم ${percent}%)`
      : `Add another — 2nd ${u} EGP ${sp} (${percent}% off)`;
  }

  if (qty === 2) {
    return isAr
      ? `${fp} + ${sp} = ${total} EGP`
      : `EGP ${fp} + EGP ${sp} = EGP ${total}`;
  }

  const { fullQty, discountQty } = breakdown;
  if (unit === 'pieces') {
    return isAr
      ? `${fullQty} × ${fp} + ${discountQty} × ${sp} = ${total} EGP (${discountQty} بخصم ${percent}%)`
      : `${fullQty} × EGP ${fp} + ${discountQty} × EGP ${sp} = EGP ${total}`;
  }

  return isAr
    ? `${fullQty} ${u} × ${fp} + ${discountQty} ${u} × ${sp} = ${total} EGP`
    : `${fullQty} ${u} × EGP ${fp} + ${discountQty} ${u} × EGP ${sp} = EGP ${total}`;
}

export function isSecondItemPromo(item = {}) {
  return item?.promotionType === 'second_percent_off';
}

export function getSecondItemPriceInfo(item = {}) {
  if (!isSecondItemPromo(item)) return null;
  const firstPrice = Number(item.price) || 0;
  if (firstPrice <= 0) return null;
  const percent = parseSecondPercentFromProduct(item);
  const secondPrice = calculateSecondPiecePrice(firstPrice, percent);
  return { firstPrice, secondPrice, percent };
}
