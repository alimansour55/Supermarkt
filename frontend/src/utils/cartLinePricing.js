/** Per-line cart totals with promotion rules (2nd-item-off, BOGO paid qty only). */

import { getCartPromoBreakdown } from './cartPromotion';
import {
  getSecondItemQtyBreakdown,
  parseSecondPercentFromProduct,
} from './promotionDisplay';

function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100;
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
    const pct = parseSecondPercentFromProduct(item);
    const breakdown = getSecondItemQtyBreakdown(qty, price, pct);
    return roundMoney(breakdown.total);
  }

  const breakdown = getCartPromoBreakdown(item);
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
