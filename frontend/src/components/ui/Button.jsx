const variants = {
  primary:
    'bg-primary-600 text-white hover:bg-primary-700 focus-visible:ring-primary-500 shadow-card',
  secondary:
    'bg-white text-primary-600 border border-primary-600/25 hover:bg-primary-50 focus-visible:ring-primary-500',
  accent:
    'bg-accent-500 text-white hover:bg-accent-600 focus-visible:ring-accent-500 shadow-card',
  ghost:
    'bg-transparent text-text hover:bg-primary-50 focus-visible:ring-primary-300',
  outline:
    'bg-transparent text-text border border-border hover:bg-primary-50 focus-visible:ring-primary-300',
  danger:
    'bg-danger-500 text-white hover:bg-danger-600 focus-visible:ring-danger-500',
};

const sizes = {
  sm: 'px-4 py-1.5 text-sm',
  md: 'px-6 py-2.5 text-sm',
  lg: 'px-7 py-3 text-base',
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  loading = false,
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      ].join(' ')}
      {...props}
    >
      {loading && (
        <span
          className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden
        />
      )}
      {children}
    </button>
  );
}
