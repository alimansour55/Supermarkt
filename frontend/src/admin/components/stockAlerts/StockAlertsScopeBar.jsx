import { Filter, PackageX } from 'lucide-react';

export default function StockAlertsScopeBar({
  isAr,
  threshold,
  activeView,
  totalMatching,
  outOfStock,
  onShowAllAlerts,
}) {
  if (activeView === 'below') {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-orange-200 bg-gradient-to-r from-orange-50/90 to-amber-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-orange-700">
            <Filter className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold text-orange-950">
              {isAr
                ? `القائمة تعرض تلقائياً: مخزون ≤ ${threshold}`
                : `List shows automatically: stock ≤ ${threshold}`}
            </p>
            <p className="mt-0.5 text-xs text-orange-900/85">
              {isAr
                ? `يشمل ${outOfStock} نافد + ${Math.max(0, totalMatching - outOfStock)} منخفض — ${totalMatching} منتج${totalMatching === 1 ? '' : 'ات'} إجمالاً`
                : `Includes ${outOfStock} out of stock + ${Math.max(0, totalMatching - outOfStock)} low — ${totalMatching} product${totalMatching === 1 ? '' : 's'} total`}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface-muted/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-text-muted">
        {activeView === 'out' && (isAr ? 'عرض: نفد فقط (0)' : 'Viewing: out of stock only (0)')}
        {activeView === 'low' && (isAr ? `عرض: منخفض فقط (1–${threshold})` : `Viewing: low only (1–${threshold})`)}
        {activeView === 'in' && (isAr ? `عرض: متوفر (>${threshold})` : `Viewing: well stocked (>${threshold})`)}
      </p>
      {onShowAllAlerts && totalMatching > 0 && (
        <button
          type="button"
          onClick={onShowAllAlerts}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:underline"
        >
          <PackageX className="h-3.5 w-3.5" />
          {isAr ? `العودة للتنبيهات (≤ ${threshold})` : `Back to all alerts (≤ ${threshold})`}
        </button>
      )}
    </div>
  );
}
