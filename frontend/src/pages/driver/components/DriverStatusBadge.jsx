const STYLES = {
  out_for_delivery: 'bg-violet-100 text-violet-800 ring-1 ring-violet-200',
  delivered: 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200',
  delivery_failed: 'bg-red-100 text-red-800 ring-1 ring-red-200',
};

const LABELS = {
  out_for_delivery: { ar: 'في الطريق', en: 'Out for delivery' },
  delivered: { ar: 'تم التسليم', en: 'Delivered' },
  delivery_failed: { ar: 'فشل التسليم', en: 'Failed' },
};

export default function DriverStatusBadge({ status, isAr, size = 'md' }) {
  const label = LABELS[status]?.[isAr ? 'ar' : 'en'] || status;
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';

  return (
    <span className={`inline-flex shrink-0 items-center rounded-full font-semibold ${sizeClass} ${STYLES[status] || 'bg-slate-100 text-slate-700'}`}>
      {status === 'out_for_delivery' && (
        <span className="relative me-1.5 flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-500 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-600" />
        </span>
      )}
      {label}
    </span>
  );
}
