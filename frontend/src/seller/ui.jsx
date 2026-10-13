import { Link } from '../app/router';
import { TrendingDown, TrendingUp } from 'lucide-react';

/** Shared building blocks for Seller Center pages. */

export function PageHeader({ title, description, actions, icon: Icon }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          {Icon && <Icon className="h-6 w-6 text-indigo-600" aria-hidden />}
          {title}
        </h1>
        {description && <p className="mt-1 max-w-3xl text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, action, children, className = '', bodyClassName = 'p-5' }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
          {title && <h2 className="font-bold">{title}</h2>}
          {action}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

/** A change vs the previous period: green up, red down, grey when unknown. */
export function Delta({ value, isAr, invert = false }) {
  if (value == null) return <span className="text-xs text-slate-400">{isAr ? 'لا توجد مقارنة' : 'no comparison'}</span>;
  const up = value >= 0;
  const good = invert ? !up : up;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${value === 0 ? 'text-slate-500' : good ? 'text-emerald-600' : 'text-red-600'}`} dir="ltr">
      <Icon className="h-3.5 w-3.5" aria-hidden />{up ? '+' : ''}{value}%
    </span>
  );
}

export function KpiCard({ label, value, icon: Icon, tone = 'text-indigo-600 bg-indigo-50', delta, isAr, hint, to }) {
  const body = (
    <article className="h-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-slate-500">{label}</p>
        {Icon && <span className={`rounded-xl p-2 ${tone}`}><Icon className="h-5 w-5" aria-hidden /></span>}
      </div>
      <p className="mt-2 text-2xl font-extrabold tabular-nums">{value}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        {delta !== undefined && <Delta value={delta} isAr={isAr} />}
        {hint && <span className="text-xs text-slate-500">{hint}</span>}
      </div>
    </article>
  );
  return to ? <Link to={to} className="block h-full">{body}</Link> : body;
}

export function EmptyState({ icon: Icon, title, text, action }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      {Icon && <Icon className="h-10 w-10 text-slate-300" aria-hidden />}
      <p className="font-semibold text-slate-700">{title}</p>
      {text && <p className="max-w-sm text-sm text-slate-500">{text}</p>}
      {action}
    </div>
  );
}

/** Segmented control (period pickers, tabs). */
export function Segmented({ options, value, onChange }) {
  return (
    <div className="inline-flex rounded-xl bg-slate-100 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${value === o.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Grey placeholder blocks while a page loads — keeps the layout steady instead of a spinner. */
export function Skeleton({ className = '' }) {
  return <span className={`block animate-pulse rounded-lg bg-slate-200/80 ${className}`} aria-hidden />;
}

export function TableSkeleton({ rows = 6 }) {
  return (
    <div className="divide-y divide-slate-100" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4">
          <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="hidden h-6 w-20 rounded-full sm:block" />
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading">
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white"><TableSkeleton rows={5} /></div>
    </div>
  );
}
