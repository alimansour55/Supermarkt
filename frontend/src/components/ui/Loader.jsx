export default function Loader({ size = 'md', className = '' }) {
  const sizeClasses = {
    sm: 'h-5 w-5 border-2',
    md: 'h-8 w-8 border-[3px]',
    lg: 'h-12 w-12 border-4',
  };

  return (
    <div className={`flex items-center justify-center ${className}`} role="status">
      <div
        className={[
          'animate-spin rounded-full border-primary-200 border-t-primary-600',
          sizeClasses[size],
        ].join(' ')}
      />
      <span className="sr-only">Loading...</span>
    </div>
  );
}
