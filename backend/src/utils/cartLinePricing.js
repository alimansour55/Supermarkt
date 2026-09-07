/** Per-line cart totals with promotion rules (2nd-item-off, BOGO paid qty only). */

const QTY_PROMO_TYPES = new Set(['bogo', 'buy_x_get_y']);

function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100;
}

function parseSecondPercent(item) {
  const stored = Number(item?.promotionSecondPercentOff);
  if (stored > 0) return Math.round(stored);
  const raw = `${item?.offerBadgeAr || ''} ${item?.offerBadgeEn || ''}`;
  const m = raw.match(/(\d+)\s*%/);
  if (m) return Math.min(100, Math.max(1, Number(m[1])));
  return 50;
}

function getSecondItemQtyBreakdown(qty, price, percent) {
  const quantity = Math.max(0, Number(qty) || 0);
  const unitPrice = Number(price) || 0;
  const pct = Math.max(0, Math.min(100, Number(percent) || 0));
  const discountQty = Math.floor(quantity / 2);
  const fullQty = quantity - discountQty;
  const discountedUnitPrice = Math.round(unitPrice * (1 - pct / 100) * 100) / 100;
  const total = Math.round((fullQty * unitPrice + discountQty * discountedUnitPrice) * 100) / 100;
  return { fullQty, discountQty, total };
}

function getQtyPromoBreakdown(item) {
  const type = item?.promotionType;
  if (!type || !QTY_PROMO_TYPES.has(type)) return null;
  const paidQty = Math.max(0, Number(item.quantity) || 0);
  if (paidQty <= 0) return null;
  const buyQty = Math.max(1, Number(item.promotionBuyQty) || 1);
  const getQty = Math.max(1, Number(item.promotionGetQty) || 1);
  const sets = Math.floor(paidQty / buyQty);
  const freeQty = sets * getQty;
  return { paidQty, freeQty };
}

export function calculateListLineTotal(item) {
  const price = Number(item?.price) || 0;
  const qty = Math.max(0, Number(item?.quantity) || 0);
  return roundMoney(price * qty);
}

export function calculatePromotedLineTotal(item) {
  const price = Number(item?.price) || 0;
  const qty = Math.max(0, Number(item?.quantity) || 0);
  if (!price || !qty) return 0;

  if (item?.promotionType === 'second_percent_off') {
    const pct = parseSecondPercent(item);
    const breakdown = getSecondItemQtyBreakdown(qty, price, pct);
    return roundMoney(breakdown.total);
  }

  const breakdown = getQtyPromoBreakdown(item);
  if (breakdown?.freeQty > 0) {
    return roundMoney(price * breakdown.paidQty);
  }

  return roundMoney(price * qty);
}

export function calculateItemsSubtotal(items = []) {
  return roundMoney(
    (Array.isArray(items) ? items : []).reduce(
      (sum, item) => sum + calculatePromotedLineTotal(item),
      0,
    ),
  );
}

export function calculatePromotionSavings(items = []) {
  const list = (Array.isArray(items) ? items : []).reduce(
    (sum, item) => sum + calculateListLineTotal(item),
    0,
  );
  const promo = calculateItemsSubtotal(items);
  return roundMoney(Math.max(0, list - promo));
}
