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

export function buildQtyPromoBadge(buy, get, unit = 'pieces', { lang = 'ar' } = {}) {
  const b = Math.max(1, Number(buy) || 1);
  const g = Math.max(1, Number(get) || 1);
  const core = g === 1 ? `${b}+1` : `${b}+${g}`;
  const meta = getPromoUnitMeta(unit);
  if (unit === 'weight_kg') return lang === 'ar' ? `${core} ${meta.shortAr}` : `${core} ${meta.shortEn}`;
  if (unit === 'weight_l') return lang === 'ar' ? `${core} ${meta.shortAr}` : `${core} ${meta.shortEn}`;
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
  const suffix = unit === 'pieces' ? (isAr ? ' قطع' : ' units') : ` ${u}`;

  if (isAr) {
    if (unit === 'pieces') {
      return `${paidQty} + ${freeQty} هدية = ${totalQty}${suffix}`;
    }
    return `${paidQty} ${u} + ${freeQty} هدية = ${totalQty} ${u}`;
  }

  if (unit === 'pieces') {
    return `${paidQty} paid + ${freeQty} free = ${totalQty}${suffix}`;
  }
  return `${paidQty} ${u} paid + ${freeQty} ${u} free = ${totalQty} ${u}`;
}

export function resolveQtyPromoType(buyQty, getQty) {
  const b = Math.max(1, Number(buyQty) || 1);
  const g = Math.max(1, Number(getQty) || 1);
  return b === 1 && g === 1 ? 'bogo' : 'buy_x_get_y';
}

export function badgesForQtyPromoRules(rules = {}, { lang = 'both' } = {}) {
  const buy = Math.max(1, Number(rules.buyQty) || 1);
  const get = Math.max(1, Number(rules.getQty) || 1);
  const unit = rules.promotionUnit || 'pieces';
  return {
    badgeAr: buildQtyPromoBadge(buy, get, unit, { lang: 'ar' }),
    badgeEn: buildQtyPromoBadge(buy, get, unit, { lang: 'en' }),
    type: resolveQtyPromoType(buy, get),
  };
}
