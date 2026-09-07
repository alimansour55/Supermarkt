import { Link } from 'react-router-dom';
import { Gift } from 'lucide-react';
import Button from '../ui/Button';
import { formatPrice } from '../../utils/formatters';
import {
  calculateMaxRedeemablePoints,
  getCashbackPercent,
  pointsToCashValue,
} from '../../utils/loyaltyHelpers';

export default function CheckoutPointsRedeem({
  language,
  isAuthenticated,
  loyaltyEnabled,
  loyaltyRules,
  pointsToRedeem,
  onPointsChange,
  pointsPreview,
  quotedSubtotal = 0,
  quotedDiscountAmount = 0,
  quotedTotal = 0,
}) {
  const isAr = language === 'ar';
  const rules = loyaltyRules || {};
  const balance = pointsPreview?.balance ?? 0;
  const minRedeem = Number(rules.minRedeemPoints ?? 10);
  const requested = Math.max(0, Math.floor(Number(pointsToRedeem) || 0));
  const maxPoints = calculateMaxRedeemablePoints({
    rules,
    balance,
    subtotal: quotedSubtotal,
    discountAmount: quotedDiscountAmount,
    orderTotal: quotedTotal,
  });
  const applied = pointsPreview?.pointsRedeemed > 0 && pointsPreview?.pointsDiscount > 0;

  if (!loyaltyEnabled) return null;

  if (!isAuthenticated) {
    return (
      <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/60 px-3 py-2.5 text-sm">
        <p className="font-medium text-amber-950">
          {isAr ? 'استبدل نقاطك عند الدفع' : 'Redeem your points at checkout'}
        </p>
        <Link to="/login" state={{ from: '/checkout' }} className="mt-1 inline-block text-xs font-semibold text-primary-700 hover:underline">
          {isAr ? 'سجّل الدخول لاستخدام نقاطك' : 'Log in to use your points'}
        </Link>
      </div>
    );
  }

  if (balance < minRedeem) {
    return (
      <div className="rounded-xl border border-border bg-surface/50 px-3 py-2.5 text-xs text-text-muted">
        <span className="font-semibold text-text">{isAr ? 'نقاطك' : 'Your points'}: </span>
        {balance.toLocaleString()} {isAr ? 'نقطة' : 'pts'}
        {' · '}
        {isAr
          ? `تحتاج ${minRedeem} نقطة على الأقل للاستبدال`
          : `Need at least ${minRedeem} points to redeem`}
      </div>
    );
  }

  if (applied) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 rounded-xl bg-violet-50 px-3 py-2">
          <span className="text-sm font-medium text-violet-900">
            <Gift className="me-1 inline h-4 w-4" aria-hidden />
            {isAr
              ? `${pointsPreview.pointsRedeemed.toLocaleString()} نقطة (−${formatPrice(pointsPreview.pointsDiscount)})`
              : `${pointsPreview.pointsRedeemed.toLocaleString()} pts (−${formatPrice(pointsPreview.pointsDiscount)})`}
          </span>
          <button
            type="button"
            onClick={() => onPointsChange('')}
            className="shrink-0 text-xs font-semibold text-red-600 hover:text-red-700"
          >
            {isAr ? 'إزالة' : 'Remove'}
          </button>
        </div>
      </div>
    );
  }

  const handleApply = () => {
    const value = Math.min(requested || maxPoints, maxPoints);
    if (value >= minRedeem) onPointsChange(String(value));
  };

  const handleUseMax = () => {
    if (maxPoints >= minRedeem) onPointsChange(String(maxPoints));
  };

  const inputError = requested > 0 && requested < minRedeem
    ? (isAr ? `الحد الأدنى ${minRedeem} نقطة` : `Minimum ${minRedeem} points`)
    : requested > balance
      ? (isAr ? 'رصيد غير كافٍ' : 'Insufficient balance')
      : requested > maxPoints && maxPoints > 0
        ? (isAr ? `الحد الأقصى ${maxPoints.toLocaleString()} نقطة لهذا الطلب` : `Max ${maxPoints.toLocaleString()} pts for this order`)
        : '';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-text">
          {isAr ? 'نقاطك' : 'Your points'}
        </span>
        <span className="text-text-muted">
          {balance.toLocaleString()} {isAr ? 'نقطة' : 'pts'}
          {' · '}
          ≈ {formatPrice(pointsToCashValue(balance, rules))}
        </span>
      </div>
      <div className="flex gap-2">
        <input
          type="number"
          min={minRedeem}
          max={Math.min(balance, maxPoints || balance)}
          value={pointsToRedeem}
          onChange={(e) => onPointsChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleApply();
            }
          }}
          placeholder={isAr ? 'عدد النقاط' : 'Points to redeem'}
          className="min-w-0 flex-1 rounded-xl border border-border px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={!maxPoints || maxPoints < minRedeem}
          onClick={handleApply}
        >
          {isAr ? 'تطبيق' : 'Apply'}
        </Button>
      </div>
      {maxPoints >= minRedeem && (
        <button
          type="button"
          onClick={handleUseMax}
          className="text-xs font-semibold text-primary-700 hover:underline"
        >
          {isAr
            ? `استخدم الحد الأقصى (${maxPoints.toLocaleString()} نقطة · −${formatPrice(pointsToCashValue(maxPoints, rules))})`
            : `Use max (${maxPoints.toLocaleString()} pts · −${formatPrice(pointsToCashValue(maxPoints, rules))})`}
        </button>
      )}
      {inputError && <p className="text-xs text-red-600">{inputError}</p>}
      <p className="text-[11px] text-text-muted">
        {isAr
          ? `استرداد ${getCashbackPercent(rules)}% · الحد الأدنى ${minRedeem} نقطة`
          : `${getCashbackPercent(rules)}% cashback · Min ${minRedeem} pts`}
      </p>
    </div>
  );
}
