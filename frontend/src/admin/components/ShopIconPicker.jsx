import { useEffect, useMemo, useRef, useState } from 'react';
import { Ban, ChevronDown, Search } from 'lucide-react';
import ShopIcon from '../../components/ui/ShopIcon';
import { SHOP_ICON_GROUPS, resolveShopIcon } from '../../utils/shopIconKeys';

/**
 * Compact icon field for homepage sections: shows the current icon, opens a
 * searchable grid of line icons. Stores the icon name (old emoji show as their
 * closest icon and are replaced on the next pick).
 */
export default function ShopIconPicker({ value, onChange, isAr, label, allowNone = true, className = '' }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef(null);
  const current = resolveShopIcon(value);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SHOP_ICON_GROUPS.map((g) => ({
      ...g,
      icons: g.icons.filter(([name, ar, en]) => !q || `${name} ${ar} ${en}`.toLowerCase().includes(q)),
    })).filter((g) => g.icons.length);
  }, [query]);

  const pick = (name) => {
    onChange(name);
    setOpen(false);
    setQuery('');
  };

  const currentLabel = (() => {
    for (const g of SHOP_ICON_GROUPS) {
      const hit = g.icons.find(([name]) => name === current);
      if (hit) return isAr ? hit[1] : hit[2];
    }
    return isAr ? 'بدون أيقونة' : 'No icon';
  })();

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {label && <p className="mb-1.5 text-sm font-medium text-text">{label}</p>}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-start text-sm hover:border-primary-300"
        aria-expanded={open}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
          {current ? <ShopIcon name={current} className="h-5 w-5" /> : <Ban className="h-4 w-4 text-text-muted" aria-hidden />}
        </span>
        <span className="flex-1 truncate text-text">{currentLabel}</span>
        <ChevronDown className="h-4 w-4 text-text-muted" aria-hidden />
      </button>

      {open && (
        <div className="absolute z-40 mt-1 w-[min(22rem,90vw)] rounded-2xl border border-border bg-white p-3 shadow-xl">
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden />
            <input
              type="search"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isAr ? 'ابحث: توصيل، هدية، ألبان…' : 'Search: delivery, gift, dairy…'}
              className="w-full rounded-lg border border-border py-1.5 ps-8 pe-2 text-sm"
            />
          </div>
          <div className="max-h-72 overflow-y-auto pe-1">
            {allowNone && !query && (
              <button
                type="button"
                onClick={() => pick('')}
                className={`mb-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold ${
                  current ? 'text-text-muted hover:bg-surface' : 'bg-primary-50 text-primary-700'
                }`}
              >
                <Ban className="h-4 w-4" aria-hidden />
                {isAr ? 'بدون أيقونة' : 'No icon'}
              </button>
            )}
            {groups.map((g) => (
              <div key={g.id} className="mb-2 last:mb-0">
                <p className="mb-1 text-[11px] font-bold text-text-muted">{isAr ? g.labelAr : g.labelEn}</p>
                <div className="grid grid-cols-6 gap-1">
                  {g.icons.map(([name, ar, en]) => {
                    const active = name === current;
                    return (
                      <button
                        key={name}
                        type="button"
                        title={isAr ? ar : en}
                        aria-label={isAr ? ar : en}
                        onClick={() => pick(name)}
                        className={`flex aspect-square items-center justify-center rounded-lg border transition ${
                          active
                            ? 'border-primary-500 bg-primary-50 text-primary-700'
                            : 'border-transparent text-text hover:border-primary-200 hover:bg-surface'
                        }`}
                      >
                        <ShopIcon name={name} className="h-5 w-5" />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {!groups.length && (
              <p className="py-4 text-center text-xs text-text-muted">{isAr ? 'لا نتائج' : 'No matches'}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
