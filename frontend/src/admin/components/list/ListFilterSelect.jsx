export default function ListFilterSelect({
  label,
  value,
  onChange,
  options,
  className = '',
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={[
        'rounded-xl border border-border bg-white px-3 py-2 text-sm text-text',
        className,
      ].join(' ')}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}
