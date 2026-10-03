import { TrendingDown, TrendingUp } from 'lucide-react';

const ACCENTS = {
  primary: { bg: 'bg-primary-50', text: 'text-primary-700', ring: 'ring-primary-100' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-100' },
  blue: { bg: 'bg-blue-50', text: 'text-blue-700', ring: 'ring-blue-100' },
  violet: { bg: 'bg-violet-50', text: 'text-violet-700', ring: 'ring-violet-100' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-100' },
};

export default function KpiPeriodCard({ title, value, changePercent, isAr, subtitle, icon: Icon, accent = 'primary' }) {
  const hasComparison = changePercent !== null && changePercent !== undefined;
  const positive = hasComparison && changePercent >= 0;
  const colors = ACCENTS[accent] || ACCENTS.primary;

  return (
    <div className="group rounded-2xl border border-border bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-text-muted">{title}</p>
          {subtitle && <p className="text-xs text-text-muted">{subtitle}</p>}
        </div>
        {Icon && (
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-4 ${colors.bg} ${colors.text} ${colors.ring}`}>
            <Icon className="h-4.5 w-4.5" strokeWidth={2} />
          </span>
        )}
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight text-text">{value}</p>
      {hasComparison ? (
        <p
          className={[
            'mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
            positive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700',
          ].join(' ')}
        >
          {changePercent !== 0 && (positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />)}
          {positive ? '↑' : '↓'}
          {Math.abs(changePercent)}%
        </p>
      ) : (
        <p className="mt-2 text-xs font-medium text-text-muted">
          {isAr ? 'لا توجد بيانات مقارنة' : 'No prior-period data'}
        </p>
      )}
      {hasComparison && (
        <p className="mt-1 text-[11px] text-text-muted">
          {isAr ? 'مقارنة بالأسبوع السابق' : 'vs prior 7 days'}
        </p>
      )}
    </div>
  );
}
