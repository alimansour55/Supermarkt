import { AlertTriangle, Package, PackageX, TrendingDown } from 'lucide-react';

const TABS = [
  {
    id: 'below',
    labelAr: 'كل التنبيهات',
    labelEn: 'All alerts',
    shortAr: 'تنبيهات',
    shortEn: 'Alerts',
    icon: AlertTriangle,
    countKey: 'belowThreshold',
    tone: 'warning',
    primary: true,
  },
  {
    id: 'out',
    labelAr: 'نفد فقط',
    labelEn: 'Out of stock only',
    shortAr: 'نفد',
    shortEn: 'Out',
    icon: PackageX,
    countKey: 'outOfStock',
    tone: 'danger',
  },
  {
    id: 'low',
    labelAr: 'منخفض فقط',
    labelEn: 'Low only',
    shortAr: 'منخفض',
    shortEn: 'Low',
    icon: TrendingDown,
    countKey: 'lowStock',
    tone: 'amber',
  },
  {
    id: 'in',
    labelAr: 'متوفر',
    labelEn: 'Well stocked',
    shortAr: 'متوفر',
    shortEn: 'OK',
    icon: Package,
    countKey: 'wellStocked',
    tone: 'success',
  },
];

const toneStyles = {
  danger: {
    active: 'border-red-300 bg-red-50 text-red-900 ring-red-200',
    badge: 'bg-red-100 text-red-800',
    icon: 'text-red-600',
  },
  warning: {
    active: 'border-amber-300 bg-amber-50 text-amber-900 ring-amber-200',
    badge: 'bg-amber-100 text-amber-800',
    icon: 'text-amber-600',
  },
  amber: {
    active: 'border-orange-300 bg-orange-50 text-orange-900 ring-orange-200',
    badge: 'bg-orange-100 text-orange-800',
    icon: 'text-orange-600',
  },
  success: {
    active: 'border-emerald-300 bg-emerald-50 text-emerald-900 ring-emerald-200',
    badge: 'bg-emerald-100 text-emerald-800',
    icon: 'text-emerald-600',
  },
};

export default function StockAlertsViewTabs({
  isAr,
  active,
  onChange,
  summary,
  threshold,
  loading,
}) {
  return (
    <div
      className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4"
      role="tablist"
      aria-label={isAr ? 'عرض المخزون' : 'Stock views'}
    >
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const styles = toneStyles[tab.tone] || toneStyles.warning;
        const isActive = active === tab.id;
        const count = loading ? '…' : (summary?.[tab.countKey] ?? 0);
        const label = isAr ? tab.labelAr : tab.labelEn;
        const sublabel = tab.id === 'below'
          ? (isAr ? `0 – ${threshold} (افتراضي)` : `0 – ${threshold} (default)`)
          : tab.id === 'low'
            ? (isAr ? `1 – ${threshold}` : `1 – ${threshold}`)
            : tab.id === 'in'
              ? (isAr ? `> ${threshold}` : `> ${threshold}`)
              : tab.id === 'out'
                ? '= 0'
                : null;

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={[
              'flex items-start gap-3 rounded-2xl border p-4 text-start shadow-sm transition-all',
              isActive
                ? `ring-2 ring-offset-1 ${styles.active}`
                : 'border-border bg-white text-text hover:border-orange-200 hover:shadow-md',
            ].join(' ')}
          >
            <span className={`mt-0.5 shrink-0 ${isActive ? styles.icon : 'text-text-muted'}`}>
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold leading-tight">{label}</span>
                {tab.primary && !isActive && (
                  <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-orange-800">
                    {isAr ? 'افتراضي' : 'Default'}
                  </span>
                )}
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${isActive ? styles.badge : 'bg-slate-100 text-slate-700'}`}>
                  {count}
                </span>
              </span>
              {sublabel && (
                <span className="mt-1 block text-[11px] text-text-muted">{sublabel}</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export { TABS as STOCK_ALERT_VIEW_TABS };
