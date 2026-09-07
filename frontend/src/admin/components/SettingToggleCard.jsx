export default function SettingToggleCard({
  checked,
  onChange,
  title,
  description,
  disabled = false,
  accent = 'default',
}) {
  const accents = {
    default: 'border-border bg-slate-50/60',
    emerald: 'border-emerald-200 bg-emerald-50/60',
    violet: 'border-violet-200 bg-violet-50/60',
    amber: 'border-amber-200 bg-amber-50/40',
    sky: 'border-sky-200 bg-sky-50/60',
  };

  return (
    <label className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${accents[accent] || accents.default} ${disabled ? 'opacity-60' : ''}`}>
      <input
        type="checkbox"
        className="mt-1"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className="font-semibold text-text">{title}</span>
        {description ? <span className="mt-1 block text-text-muted">{description}</span> : null}
      </span>
    </label>
  );
}
