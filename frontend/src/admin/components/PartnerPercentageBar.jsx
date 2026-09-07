import { useMemo } from 'react';
import { AlertTriangle, Scale } from 'lucide-react';

const PARTNER_COLORS = [
  'bg-emerald-500',
  'bg-blue-500',
  'bg-amber-500',
  'bg-violet-500',
  'bg-rose-500',
  'bg-cyan-500',
  'bg-orange-500',
  'bg-slate-500',
];

export function partnerColor(index) {
  return PARTNER_COLORS[index % PARTNER_COLORS.length];
}

export function partnerColorHex(index) {
  const hex = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#f43f5e', '#06b6d4', '#f97316', '#6b7280'];
  return hex[index % hex.length];
}

/** Partners in "assignments only" mode don't draw from the shared pool — exclude them from the 100% split. */
function isPoolEligible(p) {
  return p.isActive !== false && (p.revenueRole || 'combined') !== 'assigned_only';
}

export function equalizePercentages(partners = []) {
  const eligible = partners.filter(isPoolEligible);
  if (!eligible.length) return partners;
  const share = Math.round((100 / eligible.length) * 100) / 100;
  let assigned = 0;
  let seen = 0;
  return partners.map((p) => {
    if (!isPoolEligible(p)) return p;
    seen += 1;
    const isLast = seen === eligible.length;
    const pct = isLast ? Math.round((100 - assigned) * 100) / 100 : share;
    assigned += pct;
    return { ...p, fixedSharePercent: pct };
  });
}

export default function PartnerPercentageBar({
  partners = [],
  isAr,
  canEdit,
  onChange,
  reservePercent = 0,
}) {
  const active = useMemo(
    () => partners.filter((p) => p.isActive !== false),
    [partners],
  );

  const poolEligible = useMemo(() => active.filter(isPoolEligible), [active]);
  const assignedOnlyCount = active.length - poolEligible.length;

  const total = useMemo(
    () => poolEligible.reduce((sum, p) => sum + (Number(p.fixedSharePercent) || 0), 0),
    [poolEligible],
  );

  const isValid = Math.abs(total - 100) < 0.05;
  const distributable = 100 - (Number(reservePercent) || 0);

  const handleEqualize = () => {
    if (!canEdit || !onChange) return;
    onChange(equalizePercentages(partners));
  };

  if (!poolEligible.length) return null;

  return (
    <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Scale className="h-5 w-5 text-primary-600" />
          <div>
            <p className="font-bold text-text">
              {isAr ? 'توزيع النسب بين الشركاء' : 'Partner share split'}
            </p>
            <p className="text-xs text-text-muted">
              {isAr
                ? `الإيراد غير المُخصص يُقسّم حسب هذه النسب (${distributable}% بعد احتياطي المنصة)`
                : `Unassigned revenue splits by these shares (${distributable}% after platform reserve)`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-sm font-bold ${isValid ? 'text-emerald-700' : 'text-red-600'}`}>
            {total.toFixed(1)}% / 100%
          </span>
          {canEdit && onChange && (
            <button
              type="button"
              onClick={handleEqualize}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-text-muted hover:bg-slate-50"
            >
              {isAr ? 'توزيع متساوٍ' : 'Split equally'}
            </button>
          )}
        </div>
      </div>

      <div className="mb-3 flex h-4 overflow-hidden rounded-full bg-slate-100">
        {poolEligible.map((p, i) => {
          const pct = Number(p.fixedSharePercent) || 0;
          if (pct <= 0) return null;
          return (
            <div
              key={p._id || p.userId || `p-${i}`}
              className={`${partnerColor(i)} transition-all`}
              style={{ width: `${Math.min(pct, 100)}%` }}
              title={`${isAr ? p.nameAr || p.nameEn : p.nameEn || p.nameAr} — ${pct}%`}
            />
          );
        })}
        {!isValid && total < 100 && (
          <div className="flex-1 bg-slate-200" title={isAr ? 'غير موزّع' : 'Unallocated'} />
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        {poolEligible.map((p, i) => {
          const name = isAr ? (p.nameAr || p.nameEn || `شريك ${i + 1}`) : (p.nameEn || p.nameAr || `Partner ${i + 1}`);
          const pct = Number(p.fixedSharePercent) || 0;
          return (
            <div key={p._id || p.userId || `legend-${i}`} className="flex items-center gap-2 text-sm">
              <span className={`h-3 w-3 rounded-full ${partnerColor(i)}`} />
              <span className="font-medium text-text">{name}</span>
              <span className="font-bold text-text-muted">{pct}%</span>
            </div>
          );
        })}
      </div>

      {assignedOnlyCount > 0 && (
        <p className="mt-3 text-xs text-text-muted">
          {isAr
            ? `${assignedOnlyCount} شريك في وضع «التخصيصات فقط» غير مشمول في هذه النسبة`
            : `${assignedOnlyCount} "assignments only" partner(s) excluded from this pool`}
        </p>
      )}

      {!isValid && (
        <p className="mt-3 flex items-center gap-2 text-sm text-red-600">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {isAr
            ? 'مجموع النسب يجب أن يساوي 100% قبل الحفظ'
            : 'Share percentages must total 100% before saving'}
        </p>
      )}
    </div>
  );
}
