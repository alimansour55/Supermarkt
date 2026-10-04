import { label } from './sellerLabels';

/** Pill for a seller / listing / document status, styled from the label map's `tone`. */
export default function StatusBadge({ map, value, isAr, className = '' }) {
  const entry = map[value];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${entry?.tone || 'bg-slate-100 text-slate-700'} ${className}`}>
      {label(map, value, isAr)}
    </span>
  );
}
