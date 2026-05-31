import { TrendingDown, TrendingUp } from 'lucide-react';

export default function KpiPeriodCard({ title, value, changePercent, isAr, subtitle }) {
  const positive = changePercent >= 0;

  return (
    <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-text-muted">{title}</p>
      {subtitle && <p className="text-xs text-text-muted">{subtitle}</p>}
      <p className="mt-2 text-2xl font-bold tracking-tight text-text">{value}</p>
      <p
        className={[
          'mt-2 flex items-center gap-1 text-xs font-medium',
          positive ? 'text-green-600' : 'text-red-600',
        ].join(' ')}
      >
        {changePercent !== 0 && (positive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />)}
        {positive ? '↑' : '↓'}
        {Math.abs(changePercent)}%
        <span className="font-normal text-text-muted">
          {isAr ? 'مقارنة بالأسبوع السابق' : 'vs prior 7 days'}
        </span>
      </p>
    </div>
  );
}
