export default function PromotionFormSection({
  step,
  title,
  hint,
  children,
  className = '',
  optional = false,
  isAr,
}) {
  return (
    <section className={`rounded-2xl border border-border bg-white p-5 shadow-sm ${className}`}>
      <div className="mb-4 flex items-start gap-3">
        {step != null && (
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-100 text-sm font-bold text-orange-800"
            aria-hidden
          >
            {step}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-text">{title}</h3>
            {optional && (
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                {isAr ? 'اختياري' : 'Optional'}
              </span>
            )}
          </div>
          {hint && <p className="mt-0.5 text-xs leading-relaxed text-text-muted">{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}
