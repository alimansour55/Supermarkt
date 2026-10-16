/** Small form pieces shared by the seller fee screens. */

export const inputCls = 'w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:bg-slate-50';

export function NumberField({ label, hint, value, onChange, min = 0, max, step = 0.5, placeholder, suffix, disabled }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      <span className="relative block">
        <input
          type="number" min={min} max={max} step={step} className={`${inputCls} ${suffix ? 'pr-12' : ''}`}
          value={value} placeholder={placeholder} disabled={disabled} dir="ltr"
          onChange={(e) => onChange(e.target.value)}
        />
        {suffix && <span className="pointer-events-none absolute right-3 top-2 text-xs text-text-muted">{suffix}</span>}
      </span>
      {hint && <span className="mt-1 block text-xs text-text-muted">{hint}</span>}
    </label>
  );
}

export function Toggle({ label, hint, checked, onChange, disabled }) {
  return (
    <label className="flex items-start gap-3 rounded-xl border border-border p-3 text-sm">
      <input type="checkbox" className="mt-0.5 h-4 w-4" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="block font-medium">{label}</span>
        {hint && <span className="block text-xs text-text-muted">{hint}</span>}
      </span>
    </label>
  );
}

export function Section({ id, title, description, action, children }) {
  return (
    <section id={id} className="scroll-mt-24 rounded-2xl border border-border bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-bold">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-text-muted">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Pick several ids from a list, shown as removable chips. */
export function MultiPick({ options, value, onChange, placeholder, emptyLabel }) {
  const byId = new Map(options.map((o) => [o.value, o.label]));
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {value.map((id) => (
          <span key={id} className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-800">
            {(byId.get(id) || id).replace(/^(— )+/, '')}
            <button type="button" className="text-primary-700 hover:text-red-600" onClick={() => onChange(value.filter((v) => v !== id))} aria-label="×">×</button>
          </span>
        ))}
        {!value.length && emptyLabel && <span className="text-xs text-text-muted">{emptyLabel}</span>}
      </div>
      <select className={inputCls} value="" onChange={(e) => e.target.value && onChange([...value, e.target.value])}>
        <option value="">{placeholder}</option>
        {options.filter((o) => !value.includes(o.value)).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
