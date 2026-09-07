import { AlertTriangle, ArrowLeft, ArrowRight } from 'lucide-react';
import Button from '../../../components/ui/Button';

export default function StockAlertsAttentionBanner({
  isAr,
  count,
  threshold,
  activeView,
  onViewAlerts,
  onDismiss,
}) {
  if (!count || count <= 0 || activeView === 'below') return null;

  const Arrow = isAr ? ArrowLeft : ArrowRight;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50/80 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
          <AlertTriangle className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <p className="font-semibold text-amber-950">
            {isAr
              ? `${count} منتج${count === 1 ? '' : 'ات'} تحتاج انتباهك`
              : `${count} product${count === 1 ? '' : 's'} need your attention`}
          </p>
          <p className="mt-0.5 text-sm text-amber-900/80">
            {isAr
              ? `مخزونها ≤ ${threshold} — قد ينفد قريباً أو غير متاح على الموقع`
              : `Stock ≤ ${threshold} — may run out soon or be unavailable on the storefront`}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button size="sm" onClick={onViewAlerts}>
          {isAr ? 'عرض كل التنبيهات' : 'View all alerts'}
          <Arrow className="h-4 w-4" />
        </Button>
        {onDismiss && (
          <Button variant="ghost" size="sm" onClick={onDismiss} className="text-amber-800">
            {isAr ? 'إخفاء' : 'Dismiss'}
          </Button>
        )}
      </div>
    </div>
  );
}
