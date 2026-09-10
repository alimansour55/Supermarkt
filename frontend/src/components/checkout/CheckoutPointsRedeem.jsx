import { Link } from 'react-router-dom';
import { Gift } from 'lucide-react';
import Button from '../ui/Button';
import { formatPrice } from '../../utils/formatters';
import {
  calculateMaxRedeemablePoints,
  getCashbackPercent,
  pointsToCashValue,
} from '../../utils/loyaltyHelpers';

/** Card shell — module-level so it is NOT recreated on every render (which
 *  would remount the <input> and steal focus after each keystroke). */
function Shell({ isAr, children }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
          <Gift className="h-4 w-4" aria-hidden />
        </span>
        <p className="text-sm font-bold text-amber-950">{isAr ? 'نقاط الولاء' : 'Loyalty points'}</p>
      </div>
      {children}
    </div>
  );
}

/**
 * Loyalty-points block on checkout. Always visible (as a card) when the store's
 * loyalty programme is on and the shopper is signed in.
 */
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
  const balance = Math.max(0, Math.floor(Number(pointsPreview?.balance ?? 0)));
  const minRedeem = Number(rules.minRedeemPoints ?? 10);
  const requested = Math.max(0, Math.floor(Number(pointsToRedeem) || 0));
  const cashbackPercent = getCashbackPercent(rules);
  const maxPoints = calculateMaxRedeemablePoints({
    rules,
    balance,
    subtotal: quotedSubtotal,
    discountAmount: quotedDiscountAmount,
    orderTotal: quotedTotal,
  });
  const applied = pointsPreview?.pointsRedeemed > 0 && pointsPreview?.pointsDiscount > 0;

  if (!loyaltyEnabled) return null;

  // Not signed in
  if (!isAuthenticated) {
    return (
      <Shell isAr={isAr}>
        <p className="text-xs text-amber-900">
          {isAr
            ? `اكسب استرداد ${cashbackPercent}% على هذا الطلب واستبدل نقاطك عند الدفع.`
            : `Earn ${cashbackPercent}% cashback on this order and redeem points at checkout.`}
        </p>
        <Link
          to="/login"
          state={{ from: '/checkout' }}
          className="mt-2 inline-block text-xs font-bold text-primary-700 hover:underline"
        >
          {isAr ? 'سجّل الدخول لاستخدام نقاطك' : 'Sign in to use your points'}
        </Link>
      </Shell>
    );
  }

  // Applied — chip + remove
  if (applied) {
    return (
      <Shell isAr={isAr}>
        <div className="flex items-center justify-between gap-2 rounded-lg bg-violet-100/70 px-3 py-2">
          <span className="text-sm font-semibold text-violet-900">
            {isAr
              ? `تم استخدام ${pointsPreview.pointsRedeemed.toLocaleString()} نقطة (−${formatPrice(pointsPreview.pointsDiscount)})`
              : `${pointsPreview.pointsRedeemed.toLocaleString()} points applied (−${formatPrice(pointsPreview.pointsDiscount)})`}
          </span>
          <button
            type="button"
            onClick={() => onPointsChange('')}
            className="shrink-0 text-xs font-bold text-red-600 hover:text-red-700"
          >
            {isAr ? 'إزالة' : 'Remove'}
          </button>
        </div>
      </Shell>
    );
  }

  const balanceLine = (
    <p className="text-xs text-amber-900">
      <span className="font-bold">{isAr ? 'رصيدك:' : 'Your balance:'}</span>{' '}
      {balance.toLocaleString()} {isAr ? 'نقطة' : 'pts'}
      {balance > 0 && ` ≈ ${formatPrice(pointsToCashValue(balance, rules))}`}
    </p>
  );

  // Signed in but cannot redeem on this order yet
  if (balance < minRedeem || maxPoints < minRedeem) {
    return (
      <Shell isAr={isAr}>
        {balanceLine}
        <p className="mt-1 text-xs text-amber-800">
          {balance < minRedeem
            ? (isAr
              ? `تحتاج ${minRedeem} نقطة على الأقل للاستبدال — ستكسب من هذا الطلب استرداد ${cashbackPercent}%.`
              : `You need at least ${minRedeem} points to redeem — this order earns ${cashbackPercent}% back.`)
            : (isAr
              ? 'قيمة هذا الطلب صغيرة جداً لاستبدال نقاط.'
              : 'This order is too small to redeem points on.')}
        </p>
        <Link to="/my-points" className="mt-1.5 inline-block text-xs font-bold text-primary-700 hover:underline">
          {isAr ? 'عرض نقاطي' : 'View my points'}
        </Link>
      </Shell>
    );
  }

  const setDigits = (raw) => {
    const digits = String(raw).replace(/\D/g, '');
    if (!digits) return onPointsChange('');
    onPointsChange(String(Math.min(Number(digits), maxPoints)));
  };
  const applyTyped = () => {
    const value = Math.min(requested || maxPoints, maxPoints);
    if (value >= minRedeem) onPointsChange(String(value));
  };

  const inputError = requested > 0 && requested < minRedeem
    ? (isAr ? `الحد الأدنى ${minRedeem} نقطة` : `Minimum ${minRedeem} points`)
    : '';

  return (
    <Shell isAr={isAr}>
      {balanceLine}
      <div className="mt-2 flex gap-2">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          value={pointsToRedeem}
          onChange={(e) => setDigits(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyTyped(); } }}
          placeholder={isAr ? `عدد النقاط (حتى ${maxPoints.toLocaleString()})` : `Points to use (up to ${maxPoints.toLocaleString()})`}
          className="min-w-0 flex-1 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm tabular-nums focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
        />
        <Button type="button" variant="secondary" size="sm" onClick={applyTyped}>
          {isAr ? 'استخدم' : 'Apply'}
        </Button>
      </div>
      <button
        type="button"
        onClick={() => onPointsChange(String(maxPoints))}
        className="mt-1.5 text-xs font-bold text-primary-700 hover:underline"
      >
        {isAr
          ? `استخدم كل النقاط: ${maxPoints.toLocaleString()} (−${formatPrice(pointsToCashValue(maxPoints, rules))})`
          : `Use all points: ${maxPoints.toLocaleString()} (−${formatPrice(pointsToCashValue(maxPoints, rules))})`}
      </button>
      {inputError && <p className="mt-1 text-xs text-red-600">{inputError}</p>}
    </Shell>
  );
}
