export default function StockLevelMeter({ stock, threshold, isAr }) {
  const qty = Math.max(0, Number(stock) || 0);
  const max = Math.max(threshold, 1);
  const pct = Math.min(100, Math.round((qty / max) * 100));

  let barClass = 'bg-emerald-500';
  let labelClass = 'text-emerald-700';
  if (qty <= 0) {
    barClass = 'bg-red-500';
    labelClass = 'text-red-600';
  } else if (qty <= threshold) {
    barClass = 'bg-amber-500';
    labelClass = 'text-amber-700';
  }

  return (
    <div className="min-w-[5.5rem]">
      <div className="flex items-baseline justify-between gap-1">
        <span className={`text-sm font-bold tabular-nums ${labelClass}`}>{qty}</span>
        <span className="text-[10px] text-text-muted">/ {threshold}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all ${barClass}`}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={qty}
          aria-valuemin={0}
          aria-valuemax={threshold}
          aria-label={isAr ? 'مستوى المخزون' : 'Stock level'}
        />
      </div>
    </div>
  );
}
