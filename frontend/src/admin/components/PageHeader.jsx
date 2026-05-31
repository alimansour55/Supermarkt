export default function PageHeader({ title, description, action, children, className = '' }) {
  const hasToolbar = title || description || action;

  return (
    <div className={['space-y-4', className].join(' ')}>
      {hasToolbar && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          {(title || description) && (
            <div>
              {title && <h2 className="text-2xl font-bold text-text">{title}</h2>}
              {description && (
                <p className="mt-1 text-sm text-text-muted">{description}</p>
              )}
            </div>
          )}
          {action && (
            <div className={[!title && !description ? 'ms-auto w-full sm:w-auto' : '', 'flex shrink-0 items-center gap-3'].join(' ')}>
              {action}
            </div>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
