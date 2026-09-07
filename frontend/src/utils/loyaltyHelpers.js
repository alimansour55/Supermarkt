export function getCashbackPercent(rules) {
  if (!rules) return 1;
  return Math.round(Number(rules.earnPointsPerEGP ?? 0.1) * Number(rules.redemptionEGPPerPoint ?? 0.1) * 10000) / 100;
}

export function calculateEarnPoints(total, rules) {
  if (!rules?.enabled) return 0;
  const orderTotal = Number(total || 0);
  if (orderTotal < Number(rules.minOrderToEarn ?? 0)) return 0;
  return Math.max(0, Math.floor(orderTotal * Number(rules.earnPointsPerEGP ?? 0.1)));
}

export function pointsToCashValue(points, rules) {
  return Math.round(Number(points || 0) * Number(rules?.redemptionEGPPerPoint ?? 0.1) * 100) / 100;
}

/** Max points the user can apply on this order (balance, % cap, order total). */
export function calculateMaxRedeemablePoints({
  rules,
  balance = 0,
  subtotal = 0,
  discountAmount = 0,
  orderTotal = 0,
}) {
  if (!rules?.enabled) return 0;
  const redeemValue = Number(rules.redemptionEGPPerPoint ?? 0);
  const maxPercent = Number(rules.maxRedeemPercent ?? 0);
  const minRedeem = Number(rules.minRedeemPoints ?? 10);
  const available = Math.max(0, Math.floor(Number(balance) || 0));
  if (redeemValue <= 0 || available < minRedeem) return 0;

  const redeemableBase = Math.max(0, Number(subtotal) - Number(discountAmount));
  const maxDiscount = Math.round(redeemableBase * (maxPercent / 100) * 100) / 100;
  const cappedDiscount = Math.min(maxDiscount, Number(orderTotal));
  const maxByValue = Math.floor(cappedDiscount / redeemValue);
  const capped = Math.min(available, maxByValue);
  return capped >= minRedeem ? capped : 0;
}

export function formatHistoryType(type, isAr) {
  const map = {
    earn: isAr ? 'استرداد نقدي' : 'Cashback',
    redeem: isAr ? 'استبدال' : 'Redeemed',
    refund: isAr ? 'استرجاع' : 'Refund',
    adjust: isAr ? 'تعديل' : 'Adjustment',
    expire: isAr ? 'انتهاء' : 'Expired',
  };
  return map[type] || type;
}
