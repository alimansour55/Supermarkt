import { Link } from 'react-router-dom';
import { Gift, Sparkles, Clock } from 'lucide-react';
import { formatPrice } from '../../utils/formatters';
import { formatHistoryType, getCashbackPercent, pointsToCashValue } from '../../utils/loyaltyHelpers';

const TYPE_TONE = {
  earn: 'bg-emerald-50 text-emerald-700',
  redeem: 'bg-blue-50 text-blue-700',
  refund: 'bg-amber-50 text-amber-700',
  adjust: 'bg-violet-50 text-violet-700',
  expire: 'bg-slate-100 text-slate-600',
};

function fmtDate(value, isAr) {
  if (!value) return '';
  return new Date(value).toLocaleDateString(isAr ? 'ar-EG' : 'en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function isExpiringSoon(entry) {
  if (entry.type !== 'earn' || !entry.expiresAt) return false;
  const days = (new Date(entry.expiresAt).getTime() - new Date().getTime()) / 86400000;
  return days > 0 && days <= 30;
}

function HistoryRow({ entry, isAr }) {
  const positive = entry.points >= 0;
  const soon = isExpiringSoon(entry);

  return (
    <div className="flex items-start justify-between gap-3 py-3 text-sm">
      <div className="min-w-0">
        <span className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold ${TYPE_TONE[entry.type] || 'bg-slate-100 text-slate-600'}`}>
          {formatHistoryType(entry.type, isAr)}
        </span>
        <p className="mt-1 text-xs text-text-muted">
          {entry.orderNumber
            ? `${isAr ? 'طلب' : 'Order'} #${entry.orderNumber}`
            : (entry.note || '')}
          {(entry.orderNumber || entry.note) && ' · '}
          {fmtDate(entry.createdAt, isAr)}
        </p>
        {entry.expiresAt && entry.type === 'earn' && (
          <p className={`mt-0.5 text-[11px] ${soon ? 'font-semibold text-amber-700' : 'text-text-muted/70'}`}>
            {isAr ? 'تنتهي' : 'Expires'} {fmtDate(entry.expiresAt, isAr)}
          </p>
        )}
      </div>
      <div className="shrink-0 text-end">
        <p className={`font-bold tabular-nums ${positive ? 'text-emerald-700' : 'text-red-600'}`} dir="ltr">
          {positive ? '+' : '−'}{Math.abs(entry.points)}
        </p>
        {entry.cashValue > 0 && (
          <p className="text-[11px] text-text-muted tabular-nums" dir="ltr">{formatPrice(entry.cashValue)}</p>
        )}
      </div>
    </div>
  );
}

export default function LoyaltyPointsPanel({ isAr, loyalty, user, showAllHistory = false }) {
  const pointsBalance = loyalty?.pointsBalance ?? user?.pointsBalance ?? 0;
  const rules = loyalty?.rules || {};
  const cashbackValue = loyalty?.cashbackValue ?? pointsToCashValue(pointsBalance, rules);
  const cashbackPercent = rules.cashbackPercent ?? getCashbackPercent(rules);
  const minRedeem = rules.minRedeemPoints ?? 10;
  const canRedeem = rules.enabled !== false && pointsBalance >= minRedeem;
  const history = showAllHistory ? (loyalty?.history || []) : (loyalty?.history || []).slice(0, 6);

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-white">
      {/* balance */}
      <div className="bg-primary-700 p-6 text-white">
        <p className="flex items-center gap-2 text-sm text-white/80">
          <Gift className="h-4 w-4" aria-hidden />
          {isAr ? 'رصيد نقاطي' : 'My points balance'}
        </p>
        <p className="mt-1 text-4xl font-extrabold tabular-nums">
          {pointsBalance.toLocaleString()}<span className="ms-2 text-base font-medium text-white/70">{isAr ? 'نقطة' : 'pts'}</span>
        </p>
        <p className="mt-1 text-sm font-semibold text-emerald-200">
          ≈ {formatPrice(cashbackValue)} · {isAr ? 'قابلة للاستبدال' : 'redeemable'}
        </p>
        {canRedeem && (
          <Link
            to="/checkout"
            className="mt-4 inline-flex rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur hover:bg-white/25"
          >
            {isAr ? 'استبدل عند الدفع' : 'Redeem at checkout'}
          </Link>
        )}
      </div>

      {/* expiring nudge */}
      {loyalty?.expiringPoints > 0 && loyalty?.nextExpiry && (
        <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-5 py-3 text-xs font-semibold text-amber-900">
          <Clock className="h-4 w-4 shrink-0" aria-hidden />
          {isAr
            ? `${loyalty.expiringPoints} نقطة (≈ ${formatPrice(loyalty.expiringCashValue || 0)}) تنتهي في ${fmtDate(loyalty.nextExpiry, isAr)}`
            : `${loyalty.expiringPoints} points (≈ ${formatPrice(loyalty.expiringCashValue || 0)}) expire on ${fmtDate(loyalty.nextExpiry, isAr)}`}
        </div>
      )}

      {/* how it works */}
      {rules.enabled !== false && (
        <div className="space-y-1.5 border-b border-border px-5 py-4 text-sm">
          <p className="flex items-center gap-2 font-semibold text-text">
            <Sparkles className="h-4 w-4 shrink-0 text-primary-600" aria-hidden />
            {isAr ? `استرداد نقدي ${cashbackPercent}% على كل طلب` : `${cashbackPercent}% cashback on every order`}
          </p>
          {rules.redeemDescription && <p className="text-text-muted">{rules.redeemDescription}</p>}
          {rules.expiryDescription && <p className="text-xs text-text-muted/80">{rules.expiryDescription}</p>}
        </div>
      )}

      {/* history */}
      <div className="px-5 py-2">
        <p className="pt-2 text-xs font-bold text-text">{isAr ? 'سجل النقاط' : 'Points history'}</p>
        <div className="divide-y divide-border">
          {history.map((entry) => <HistoryRow key={entry.id} entry={entry} isAr={isAr} />)}
          {(!loyalty?.history || loyalty.history.length === 0) && (
            <p className="py-4 text-sm text-text-muted">
              {isAr
                ? 'لا توجد حركة نقاط بعد — تظهر نقاط الاسترداد النقدي بعد توصيل أول طلب.'
                : 'No points activity yet — cashback appears after your first order is delivered.'}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
