const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * How much wallet balance can actually be applied to an order right now.
 * `payableTotal` = order total after coupon + points, before wallet.
 */
export function calculateMaxWalletSpend({
  settings,
  balance = 0,
  payableTotal = 0,
}) {
  const rules = settings || {};
  if (rules.enabled === false || rules.allowCheckoutSpend === false) return 0;
  const available = Math.max(0, round2(balance));
  const total = Math.max(0, round2(payableTotal));
  if (available <= 0 || total <= 0) return 0;
  const percent = Number(rules.maxCheckoutPercent ?? 100);
  const percentCap = percent > 0 ? round2(total * (percent / 100)) : total;
  return round2(Math.min(available, total, percentCap));
}

export function walletTypeLabel(type, isAr) {
  const map = {
    topup: isAr ? 'شحن رصيد' : 'Top-up',
    spend: isAr ? 'دفع طلب' : 'Order payment',
    refund: isAr ? 'استرداد' : 'Refund',
    adjust: isAr ? 'تعديل إداري' : 'Admin adjustment',
    reversal: isAr ? 'عكس عملية' : 'Reversal',
  };
  return map[type] || type;
}

export function walletTopUpStatusLabel(status, isAr) {
  const map = {
    pending: isAr ? 'قيد المراجعة' : 'Under review',
    approved: isAr ? 'مقبول' : 'Approved',
    rejected: isAr ? 'مرفوض' : 'Rejected',
  };
  return map[status] || status;
}

export const WALLET_TYPE_TONE = {
  topup: 'bg-emerald-50 text-emerald-700',
  refund: 'bg-emerald-50 text-emerald-700',
  spend: 'bg-blue-50 text-blue-700',
  adjust: 'bg-violet-50 text-violet-700',
  reversal: 'bg-amber-50 text-amber-700',
};
