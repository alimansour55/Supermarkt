import { Link } from '../../../app/router';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const TONES = {
  amber: 'border-s-amber-500 bg-amber-50/60 text-amber-700',
  rose: 'border-s-rose-500 bg-rose-50/60 text-rose-700',
  violet: 'border-s-violet-500 bg-violet-50/60 text-violet-700',
  blue: 'border-s-blue-500 bg-blue-50/60 text-blue-700',
};

export default function NeedsAttentionGrid({ items, isAr }) {
  const visible = items.filter((item) => (item.count ?? 0) > 0);
  if (!visible.length) return null;

  const Chevron = isAr ? ChevronLeft : ChevronRight;

  return (
    <section>
      <h2 className="mb-3 text-sm font-bold text-text">
        {isAr ? 'يحتاج انتباهك' : 'Needs your attention'}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {visible.map(({ key, count, labelAr, labelEn, to, icon: Icon, tone }) => (
          <Link
            key={key}
            to={to}
            className={`group flex items-center justify-between gap-3 rounded-xl border border-border border-s-4 bg-white p-4 shadow-sm transition-shadow hover:shadow-md ${TONES[tone] || TONES.blue}`}
          >
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-black/5">
                <Icon className="h-4.5 w-4.5" />
              </span>
              <div>
                <p className="text-lg font-bold leading-none text-text">{count}</p>
                <p className="mt-1 text-xs font-medium text-text-muted">{isAr ? labelAr : labelEn}</p>
              </div>
            </div>
            <Chevron className="h-4 w-4 shrink-0 text-text-muted opacity-0 transition-opacity group-hover:opacity-100" />
          </Link>
        ))}
      </div>
    </section>
  );
}
