export default function DetailSection({ title, icon: Icon, children, className = '', flush = false }) {
  return (
    <section className={`overflow-hidden rounded-2xl border border-border/60 bg-white shadow-sm ${className}`}>
      {title && (
        <div className="flex items-center gap-2 border-b border-border/50 bg-slate-50/60 px-5 py-3">
          {Icon && <Icon className="h-4 w-4 text-primary-600" strokeWidth={2} aria-hidden />}
          <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">{title}</h3>
        </div>
      )}
      <div className={flush ? undefined : 'p-5'}>{children}</div>
    </section>
  );
}
