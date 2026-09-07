import { Link } from 'react-router-dom';
import { Gift, Sparkles } from 'lucide-react';
import { formatPrice } from '../../utils/formatters';
import {
  calculateEarnPoints,
  formatHistoryType,
  getCashbackPercent,
  pointsToCashValue,
} from '../../utils/loyaltyHelpers';

export default function LoyaltyPointsPanel({ isAr, loyalty, user, showAllHistory = false }) {
  const pointsBalance = loyalty?.pointsBalance ?? user?.pointsBalance ?? 0;
  const rules = loyalty?.rules || {};
  const cashbackValue = loyalty?.cashbackValue ?? pointsToCashValue(pointsBalance, rules);
  const cashbackPercent = rules.cashbackPercent ?? getCashbackPercent(rules);
  const history = showAllHistory
    ? (loyalty?.history || [])
    : (loyalty?.history || []).slice(0, 5);

  return (
    <section className="rounded-2xl border border-border bg-white p-6">
      <div className="mb-4 flex items-start gap-3">
        <div className="rounded-xl bg-amber-100 p-2.5 text-amber-700">
          <Gift className="h-5 w-5" aria-hidden />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-text-muted">{isAr ? 'نقاطي — استرداد نقدي' : 'My points — cashback'}</p>
          <h2 className="mt-1 text-3xl font-bold text-primary-700">
            {pointsBalance.toLocaleString()} {isAr ? 'نقطة' : 'pts'}
          </h2>
          <p className="mt-1 text-sm font-semibold text-emerald-700">
            ≈ {formatPrice(cashbackValue)} {isAr ? 'قيمة استرداد' : 'redeemable value'}
          </p>
        </div>
      </div>

      {rules.enabled !== false && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm">
          <p className="flex items-center gap-2 font-semibold text-amber-900">
            <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
            {isAr
              ? `استرداد نقدي ${cashbackPercent}% على كل طلب`
              : `${cashbackPercent}% cashback on every order`}
          </p>
          <p className="mt-1 text-amber-800">
            {rules.earnDescription || (isAr
              ? `مثال: طلب بـ ${formatPrice(500)} = ${calculateEarnPoints(500, rules)} نقطة (${formatPrice(pointsToCashValue(calculateEarnPoints(500, rules), rules))})`
              : `Example: ${formatPrice(500)} order = ${calculateEarnPoints(500, rules)} points (${formatPrice(pointsToCashValue(calculateEarnPoints(500, rules), rules))})`)}
          </p>
          <p className="mt-1 text-xs text-amber-700">
            {rules.redeemDescription || (isAr
              ? `استبدل نقاطك عند الدفع — الحد الأدنى ${rules.minRedeemPoints ?? 10} نقطة`
              : `Redeem at checkout — minimum ${rules.minRedeemPoints ?? 10} points`)}
          </p>
        </div>
      )}

      {rules.enabled !== false && (
        <Link
          to="/checkout"
          className="mb-5 inline-flex rounded-xl bg-primary-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-primary-700"
        >
          {isAr ? 'استبدل عند الدفع' : 'Redeem at checkout'}
        </Link>
      )}

      <div className="divide-y divide-border">
        {history.map((entry) => (
          <div key={entry.id} className="flex items-center justify-between py-3 text-sm">
            <div>
              <p className="font-medium">{entry.note || formatHistoryType(entry.type, isAr)}</p>
              <p className="text-xs text-text-muted">
                {entry.createdAt ? new Date(entry.createdAt).toLocaleDateString(isAr ? 'ar-EG' : 'en-GB') : ''}
                {entry.amount ? ` · ${formatPrice(entry.amount)}` : ''}
              </p>
            </div>
            <span className={entry.points >= 0 ? 'font-semibold text-primary-700' : 'font-semibold text-red-600'}>
              {entry.points >= 0 ? '+' : ''}{entry.points}
            </span>
          </div>
        ))}
        {(!loyalty?.history || loyalty.history.length === 0) && (
          <p className="py-3 text-sm text-text-muted">
            {isAr
              ? 'لا توجد حركة نقاط بعد. ستظهر نقاط الاسترداد النقدي بعد إتمام طلبك.'
              : 'No points activity yet. Cashback appears after you place an order.'}
          </p>
        )}
      </div>
    </section>
  );
}
