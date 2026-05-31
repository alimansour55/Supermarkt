import { parseLocalPhone } from '../../utils/phoneHelpers';

/**
 * Egypt mobile input — flag + fixed grey +20 prefix, user enters local number only.
 */
export default function PhoneInput({
  label,
  value,
  onChange,
  error,
  disabled = false,
  required = false,
  className = '',
  labelClassName = '',
  id,
  name,
}) {
  const inputId = id || name || 'phone';

  const handleChange = (e) => {
    onChange(parseLocalPhone(e.target.value));
  };

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label htmlFor={inputId} className={`mb-1.5 block text-sm font-medium text-text ${labelClassName}`}>
          {label}
        </label>
      )}
      <div
        className={[
          'flex overflow-hidden rounded-xl border bg-white transition-colors',
          disabled ? 'border-border bg-slate-50 opacity-80' : 'border-border focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-200',
          error ? 'border-red-400 focus-within:border-red-400 focus-within:ring-red-100' : '',
        ].join(' ')}
      >
        <div
          className="flex shrink-0 items-center gap-2 border-e border-border bg-slate-100 px-3 py-2.5 select-none"
          aria-hidden
        >
          <span className="text-xl leading-none" title="Egypt">
            🇪🇬
          </span>
          <span className="text-sm font-semibold text-text-muted">+20</span>
        </div>
        <input
          id={inputId}
          name={name}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          disabled={disabled}
          required={required}
          maxLength={10}
          value={value}
          onChange={handleChange}
          placeholder="1012345678"
          className="min-w-0 flex-1 bg-transparent px-4 py-2.5 text-text placeholder:text-text-muted focus:outline-none disabled:cursor-not-allowed"
        />
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
