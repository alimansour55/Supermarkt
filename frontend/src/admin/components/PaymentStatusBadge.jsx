import { getPaymentStatus } from '../adminConstants';

const PAYMENT_DOTS = {
  pending: 'bg-amber-500',
  paid: 'bg-emerald-500',
  failed: 'bg-red-500',
  refunded: 'bg-slate-400',
};

export default function PaymentStatusBadge({ status, language = 'ar', compact = false, variant = 'default' }) {
  const info = getPaymentStatus(status);
  const label = language === 'ar' ? info.labelAr : info.labelEn;
  const dot = PAYMENT_DOTS[status] || PAYMENT_DOTS.pending;

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
        'inline-flex rounded-full font-medium',
        compact ? 'px-1.5 py-0.5 text-[10px] leading-tight' : 'px-2.5 py-0.5 text-xs',
        info.color,
      ].join(' ')}
    >
      {label}
    </span>
  );
}
