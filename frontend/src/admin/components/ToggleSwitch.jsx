export default function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
  ariaLabel,
  id,
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        'relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
        checked ? 'bg-primary-600' : 'bg-slate-200',
      ].join(' ')}
    >
      <span
        aria-hidden
        className={[
          'pointer-events-none absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all duration-200',
          checked ? 'inset-inline-start-[calc(100%-1.375rem)]' : 'inset-inline-start-0.5',
        ].join(' ')}
      />
    </button>
  );
}
