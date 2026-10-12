import { useMemo, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import { getCategoryBreadcrumb, isLeafCategory } from '../utils/categoryHelpers';

/**
 * Search-as-you-type picker over the marketplace's leaf categories, shown with their full path
 * ("Food › Breakfast › Honey"). Used by the seller product form and the admin listing review.
 */
export default function MarketplaceCategoryPicker({ categories = [], value, onChange, isAr, allowClear = true }) {
  const [q, setQ] = useState('');

  const leaves = useMemo(() => categories
    .filter((c) => c.isActive !== false && isLeafCategory(c, categories))
    .map((c) => ({ id: String(c._id), path: getCategoryBreadcrumb(c, categories, isAr, ' › ') }))
    .sort((a, b) => a.path.localeCompare(b.path, isAr ? 'ar' : 'en')), [categories, isAr]);

  const selected = leaves.find((l) => l.id === String(value || ''));

  const matches = useMemo(() => {
    const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const pool = terms.length
      ? leaves.filter((l) => terms.every((t) => l.path.toLowerCase().includes(t)))
      : leaves;
    return pool.slice(0, 60);
  }, [leaves, q]);

  return (
    <div className="space-y-2">
      {selected && (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-indigo-50 px-3 py-2 text-sm text-indigo-900 ring-1 ring-indigo-200">
          <span className="flex min-w-0 items-center gap-2">
            <Check className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate font-semibold">{selected.path}</span>
          </span>
          {allowClear && (
            <button type="button" onClick={() => onChange('')} className="rounded-lg p-1 hover:bg-indigo-100" aria-label={isAr ? 'إزالة' : 'Clear'}>
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
      <label className="relative block">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={isAr ? 'ابحث عن قسم… مثال: عسل' : 'Search categories… e.g. honey'}
          className="w-full rounded-xl border border-slate-200 bg-white py-2 pe-3 ps-9 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
        />
      </label>
      <ul className="max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white" role="listbox">
        {matches.length === 0 && (
          <li className="px-3 py-3 text-sm text-slate-500">{isAr ? 'لا توجد نتائج' : 'No matching category'}</li>
        )}
        {matches.map((l) => {
          const active = l.id === String(value || '');
          return (
            <li key={l.id}>
              <button
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => onChange(l.id)}
                className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-start text-sm hover:bg-slate-50 ${active ? 'bg-indigo-50 font-semibold text-indigo-800' : ''}`}
              >
                <span className="truncate">{l.path}</span>
                {active && <Check className="h-4 w-4 shrink-0" aria-hidden />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
