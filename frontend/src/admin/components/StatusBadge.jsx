import { getOrderStatus } from '../adminConstants';

const STATUS_DOTS = {
  pending: 'bg-amber-500',
  confirmed: 'bg-blue-500',
  preparing: 'bg-blue-500',
  out_for_delivery: 'bg-violet-500',
  delivered: 'bg-emerald-500',
  delivery_failed: 'bg-red-500',
  returned: 'bg-teal-500',
  cancelled: 'bg-slate-400',
};

export default function StatusBadge({ status, language = 'ar', compact = false, variant = 'default' }) {
  const info = getOrderStatus(status);
  const label = language === 'ar' ? info.labelAr : info.labelEn;
  const dot = STATUS_DOTS[status] || STATUS_DOTS.pending;

  if (variant === 'subtle') {
    return (
      <span
        className={[
          'inline-flex items-center gap-1.5 rounded-md bg-slate-100/90 font-medium text-slate-700 ring-1 ring-slate-200/60',
          compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs',
        ].join(' ')}
      >
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} aria-hidden />
        {label}
      </span>
    );
  }

  return (
    <span
      className={[
        'inline-flex rounded-full font-semibold',
        compact ? 'px-1.5 py-0.5 text-[10px] leading-tight' : 'px-2.5 py-1 text-xs',
        info.color,
      ].join(' ')}
    >
      {label}
    </span>
  );
}
