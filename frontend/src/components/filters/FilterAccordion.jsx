/** Shared accordion + filter rows (storefront & admin). */

/** Square checkbox style used across product filter options. */
export const FILTER_CHECKBOX_CLASS =
  'h-4 w-4 shrink-0 rounded-sm border-2 border-border bg-white text-primary-600 accent-primary-600 focus:ring-2 focus:ring-primary-100 focus:ring-offset-0 disabled:opacity-50';

export function FilterSection({ title, children, defaultOpen = true }) {
  return (
    <details open={defaultOpen} className="group border-b border-border pb-4 last:border-0">
      <summary className="mb-3 cursor-pointer list-none text-sm font-semibold text-text marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="flex items-center justify-between">
          {title}
          <span className="text-xs text-text-muted transition-transform group-open:rotate-180">▼</span>
        </span>
      </summary>
      {children}
    </details>
  );
}

export function CountBadge({ count, active }) {
  if (count == null) return null;
  return (
    <span
      className={`ms-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
        active ? 'bg-primary-600 text-white' : 'bg-surface text-text-muted'
      }`}
    >
      {count}
    </span>
  );
}

export function RadioRow({
  checked,
  onChange,
  label,
  count,
  leading,
  disabled,
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-2 rounded-xl px-2 py-2 text-sm transition-colors ${
        disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-surface'
      } ${checked ? 'bg-primary-50 font-medium text-primary-800' : 'text-text'}`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className={FILTER_CHECKBOX_CLASS}
      />
      {leading}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <CountBadge count={count} active={checked} />
    </label>
  );
}

/** Alias — filter options use square checkboxes, not round radios. */
export const FilterCheckboxRow = RadioRow;
