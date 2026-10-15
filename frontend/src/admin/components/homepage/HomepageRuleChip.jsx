const TONES = {
  green: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  slate: 'bg-slate-100 text-slate-700 ring-slate-200',
  blue: 'bg-sky-50 text-sky-800 ring-sky-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  violet: 'bg-violet-50 text-violet-800 ring-violet-200',
  red: 'bg-red-50 text-red-800 ring-red-200',
};

/** A small rule/status pill: { tone, label }. */
export function RuleChip({ chip, className = '' }) {
  return (
    <span className={`inline-flex max-w-full items-center truncate rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${TONES[chip.tone] || TONES.slate} ${className}`}>
      {chip.label}
    </span>
  );
}
