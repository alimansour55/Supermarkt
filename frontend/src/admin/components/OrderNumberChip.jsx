import { formatOrderNumber, formatOrderNumberShort } from '../../utils/formatters';

const SIZES = {
  sm: 'px-2 py-1 text-xs',
  md: 'px-2.5 py-1.5 text-sm',
  lg: 'px-3.5 py-2 text-xl sm:text-2xl',
};

export default function OrderNumberChip({ orderNumber, size = 'md', short = false, className = '' }) {
  const full = formatOrderNumber(orderNumber);
  const display = short ? formatOrderNumberShort(orderNumber) : full;

  return (
    <span
      dir="ltr"
      title={short ? `#${full}` : undefined}
      className={[
        'inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 font-mono font-bold tabular-nums tracking-tight text-text',
        SIZES[size] || SIZES.md,
        className,
      ].join(' ')}
    >
      #{display}
    </span>
  );
}
