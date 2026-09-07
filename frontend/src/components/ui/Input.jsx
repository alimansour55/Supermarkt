export default function Input({
  label,
  error,
  className = '',
  labelClassName = '',
  inputClassName = '',
  id,
  ...props
}) {
  const inputId = id || props.name;

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label htmlFor={inputId} className={`mb-1.5 block text-sm font-medium text-text ${labelClassName}`}>
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={[
          'w-full rounded-xl border bg-slate-50 px-4 py-2.5 text-text',
          'placeholder:text-slate-400 transition-colors duration-200',
          'focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-200',
          error ? 'border-red-400 focus:border-red-400 focus:ring-red-100' : 'border-slate-200',
          inputClassName,
        ].join(' ')}
        {...props}
      />
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
