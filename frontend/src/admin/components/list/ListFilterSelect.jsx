export default function ListFilterSelect({
  label,
  value,
  onChange,
  options,
  className = '',
  showLabel = false,
}) {
  const select = (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={[
        'min-w-[9.5rem] rounded-xl border border-border bg-white px-3 py-2 text-sm text-text shadow-sm',
        'transition-colors hover:border-orange-200 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100',
        className,
      ].join(' ')}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );

  if (showLabel) {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-bold uppercase tracking-wide text-text-muted">{label}</span>
        {select}
      </div>
    );
  }

  return select;
}
