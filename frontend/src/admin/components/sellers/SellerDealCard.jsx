import { useState } from 'react';
import { CalendarClock, Gift, Percent } from 'lucide-react';
import { formatDate, formatMoneyLatin } from '../../../utils/formatters';
import { RATE_SOURCES } from '../../utils/sellerDeal';

const money = (n, isAr) => `${formatMoneyLatin(n || 0, { maximumFractionDigits: 2 })} ${isAr ? 'ج.م' : 'EGP'}`;

function SourceChip({ source, label, isAr }) {
  const s = RATE_SOURCES[source] || RATE_SOURCES.default;
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.tone}`}>
      {isAr ? s.ar : s.en}{label ? ` · ${label}` : ''}
    </span>
  );
}

/**
 * Overview card: what this seller pays right now — per category, where each rate comes from,
 * fixed fees, payout timing, live campaigns and waiting scheduled changes. Answers "how much do
 * we take from this seller?" without opening the fee setup.
 */
export default function SellerDealCard({ deal, isAr, onEdit }) {
  const [showAll, setShowAll] = useState(false);

  if (!deal) return <section className="h-40 animate-pulse rounded-2xl border border-border bg-white" />;
  if (deal.error) return null;

  const f = deal.fees || {};
  const fixed = [
    f.fixedFeePerItem > 0 && [isAr ? 'لكل قطعة' : 'per item', money(f.fixedFeePerItem, isAr)],
    f.fixedFeePerShipment > 0 && [isAr ? 'لكل شحنة' : 'per shipment', money(f.fixedFeePerShipment, isAr)],
    f.storeFulfillmentFeePerItem > 0 && [isAr ? 'شحن من مخزننا/قطعة' : 'our fulfillment/item', money(f.storeFulfillmentFeePerItem, isAr)],
    f.monthlyFee > 0 && [isAr ? 'اشتراك شهري' : 'monthly', money(f.monthlyFee, isAr)],
    f.minCommissionPerItem > 0 && [isAr ? 'أقل عمولة/قطعة' : 'min/item', money(f.minCommissionPerItem, isAr)],
    f.maxCommissionPerItem > 0 && [isAr ? 'أقصى عمولة/قطعة' : 'max/item', money(f.maxCommissionPerItem, isAr)],
  ].filter(Boolean);
  const rows = deal.categories || [];
  // Categories that differ from the base rate first — they are the interesting ones.
  const sorted = [...rows].sort((a, b) => Number(b.rate !== deal.baseRate.rate) - Number(a.rate !== deal.baseRate.rate));
  const visible = showAll ? sorted : sorted.slice(0, 6);
  const pending = (deal.scheduled || []).filter((d) => d.status === 'pending');

  return (
    <section className="rounded-2xl border border-border bg-white p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-1.5 font-bold"><Percent className="h-4 w-4 text-primary-600" />{isAr ? 'اتفاق العمولة والرسوم' : 'Commission & fee deal'}</h3>
          <p className="mt-0.5 text-xs text-text-muted">
            {deal.plan ? `${isAr ? 'الباقة' : 'Plan'}: ${isAr ? deal.plan.nameAr || deal.plan.nameEn : deal.plan.nameEn || deal.plan.nameAr}` : (isAr ? 'بدون باقة' : 'No plan')}
            {' · '}{isAr ? 'تطبق على الطلبات الجديدة فقط' : 'Applies to new orders only'}
          </p>
        </div>
        {onEdit && <button type="button" onClick={onEdit} className="shrink-0 text-xs font-semibold text-primary-700 hover:underline">{isAr ? 'تغيير الاتفاق' : 'Change deal'}</button>}
      </div>

      {deal.commissionFreeUntil && (
        <p className="mb-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <Gift className="h-4 w-4" />
          {isAr ? 'بدون عمولة حتى ' : 'No commission until '}{formatDate(new Date(new Date(deal.commissionFreeUntil).getTime() - 1), isAr ? 'ar-EG' : 'en-GB')}
        </p>
      )}

      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-3xl font-bold">{deal.baseRate.rate}%</span>
        <SourceChip source={deal.baseRate.source} label={deal.baseRate.label} isAr={isAr} />
        <span className="text-xs text-text-muted">{isAr ? 'على أي قسم بدون نسبة خاصة' : 'on any category without its own rate'}</span>
      </div>

      {rows.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-text-muted">
              <tr>
                <th className="px-3 py-2 text-start font-medium">{isAr ? 'القسم' : 'Category'}</th>
                <th className="px-3 py-2 text-end font-medium">{isAr ? 'العمولة' : 'Commission'}</th>
                <th className="hidden px-3 py-2 text-start font-medium sm:table-cell">{isAr ? 'السبب' : 'Why'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((c) => (
                <tr key={c.category}>
                  <td className="px-3 py-2">{isAr ? c.nameAr || c.nameEn : c.nameEn || c.nameAr}</td>
                  <td className={`px-3 py-2 text-end font-semibold ${c.rate !== deal.baseRate.rate ? 'text-primary-700' : ''}`}>{c.rate}%</td>
                  <td className="hidden px-3 py-2 sm:table-cell"><SourceChip source={c.source} label={c.label} isAr={isAr} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 6 && (
            <button type="button" onClick={() => setShowAll((v) => !v)} className="w-full border-t border-border py-1.5 text-xs font-semibold text-primary-700">
              {showAll ? (isAr ? 'عرض أقل' : 'Show less') : (isAr ? `عرض كل الأقسام (${rows.length})` : `Show all ${rows.length} categories`)}
            </button>
          )}
        </div>
      )}

      <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        <div className="flex justify-between gap-2 border-b border-slate-100 py-1">
          <dt className="text-text-muted">{isAr ? 'رسوم ثابتة' : 'Fixed fees'}</dt>
          <dd className="text-end">{fixed.length ? fixed.map(([k, v]) => `${v} ${k}`).join(' · ') : '—'}</dd>
        </div>
        <div className="flex justify-between gap-2 border-b border-slate-100 py-1">
          <dt className="text-text-muted">{isAr ? 'ضريبة على الرسوم' : 'VAT on fees'}</dt>
          <dd>{f.vatPercent ? `${f.vatPercent}%` : (isAr ? 'معفى / لا يوجد' : 'None')}</dd>
        </div>
        <div className="flex justify-between gap-2 border-b border-slate-100 py-1">
          <dt className="text-text-muted">{isAr ? 'انتظار قبل التحويل' : 'Payout hold'}</dt>
          <dd>{deal.payout.holdDays} {isAr ? 'يوم' : 'days'}</dd>
        </div>
        <div className="flex justify-between gap-2 border-b border-slate-100 py-1">
          <dt className="text-text-muted">{isAr ? 'التحويل التلقائي' : 'Automatic payouts'}</dt>
          <dd>{{ '': isAr ? 'حسب الإعداد العام' : 'Marketplace schedule', manual: isAr ? 'يدوياً فقط' : 'Manual only', weekly: isAr ? 'أسبوعياً' : 'Weekly', biweekly: isAr ? 'كل أسبوعين' : 'Every 2 weeks', monthly: isAr ? 'شهرياً' : 'Monthly' }[deal.payout.frequency || '']}</dd>
        </div>
      </dl>

      {(deal.rules || []).length > 0 && (
        <div className="mt-3 rounded-xl bg-violet-50/60 p-3 text-xs text-violet-900">
          <p className="mb-1 font-semibold">{isAr ? 'قواعد وحملات قد تنطبق' : 'Rules & campaigns that can apply'}</p>
          <ul className="space-y-0.5">
            {deal.rules.map((r, i) => (
              <li key={i}>
                {r.name || (isAr ? 'قاعدة' : 'Rule')}: {r.rate}%
                {r.overridesDeal && ` · ${isAr ? 'تتقدم على الاتفاق الخاص' : 'beats the seller deal'}`}
                {r.conditional && ` · ${isAr ? 'حسب السعر/الشحن' : 'depends on price/shipping'}`}
                {r.endsAt && ` · ${isAr ? 'حتى' : 'until'} ${formatDate(r.endsAt, isAr ? 'ar-EG' : 'en-GB')}`}
              </li>
            ))}
          </ul>
        </div>
      )}

      {pending.length > 0 && (
        <p className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <CalendarClock className="h-4 w-4" />
          {isAr ? `${pending.length} تغيير مجدول — أقربها ` : `${pending.length} scheduled change(s) — next on `}
          {formatDate(pending[0].applyAt, isAr ? 'ar-EG' : 'en-GB')}
        </p>
      )}
    </section>
  );
}
