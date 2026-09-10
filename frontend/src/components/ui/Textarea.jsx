export default function Textarea({
  label,
  error,
  className = '',
  id,
  rows = 3,
  ...props
}) {
  const inputId = id || props.name;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-text">
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        rows={rows}
        className={[
          'w-full rounded-field border border-border bg-white px-4 py-2.5 text-text',
          'placeholder:text-text-muted transition-colors duration-200',
          'focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200',
          error ? 'border-danger-300 focus:border-danger-300 focus:ring-danger-100' : '',
          className,
        ].join(' ')}
        {...props}
      />
      {error && <p className="mt-1 text-sm text-danger-600">{error}</p>}
    </div>
  );
}
