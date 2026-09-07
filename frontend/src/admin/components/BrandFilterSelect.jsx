import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';

export default function BrandFilterSelect({
  brands = [],
  value = '',
  onChange,
  isAr = true,
  label,
  placeholder,
  maxOptions = 20,
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const options = useMemo(() => {
    return (Array.isArray(brands) ? brands : []).map((b) => ({
      value: b.queryValue || b.nameEn || b.nameAr || b.slug || '',
      label: isAr ? (b.nameAr || b.nameEn || b.name) : (b.nameEn || b.nameAr || b.name),
    })).filter((o) => o.value);
  }, [brands, isAr]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, maxOptions);
    return options.filter((o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)).slice(0, maxOptions);
  }, [options, query, maxOptions]);

  const selectedLabel = options.find((o) => o.value === value)?.label || (value ? value : undefined);
  const fieldLabel = label ?? (isAr ? 'ماركة (اختياري)' : 'Brand (optional)');
  const emptyLabel = placeholder ?? (isAr ? 'كل الماركات' : 'All brands');

  return (
    <div className="relative">
      <label className="mb-1.5 block text-xs font-semibold text-text">
        {fieldLabel}
      </label>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-xl border border-border bg-white px-3 py-2.5 text-start text-sm hover:border-orange-300"
      >
        <span className={selectedLabel ? 'font-medium text-text' : 'text-text-muted'}>
          {selectedLabel || emptyLabel}
        </span>
        {value ? (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onChange(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onChange(''); } }}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-red-600"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        ) : (
          <span className="text-text-muted">▾</span>
        )}
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-border bg-white shadow-lg">
          <div className="relative border-b border-border p-2">
            <Search className="pointer-events-none absolute start-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isAr ? 'ابحث عن ماركة…' : 'Search brand…'}
              className="w-full rounded-lg border border-border py-2 pe-2 ps-8 text-xs focus:border-orange-400 focus:outline-none"
              autoFocus
            />
          </div>
          <ul className="max-h-48 overflow-y-auto overscroll-y-contain py-1">
            <li>
              <button
                type="button"
                onClick={() => { onChange(''); setOpen(false); setQuery(''); }}
                className="w-full px-3 py-2 text-start text-xs font-medium text-text-muted hover:bg-slate-50"
              >
                {isAr ? '— كل الماركات —' : '— All brands —'}
              </button>
            </li>
            {filtered.map((opt) => (
              <li key={opt.value}>
                <button
                  type="button"
                  onClick={() => { onChange(opt.value); setOpen(false); setQuery(''); }}
                  className={`w-full px-3 py-2 text-start text-xs hover:bg-orange-50 ${
                    value === opt.value ? 'bg-orange-50 font-bold text-orange-800' : 'text-text'
                  }`}
                >
                  {opt.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
