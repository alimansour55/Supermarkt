import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { buildHomepageLinkGroups, findLinkPresetInGroups } from '../utils/homepageLinkPresets';
import { normalizeHomepageLink } from '../utils/homepageSectionMeta';

export default function HomepageDestinationPicker({
  href,
  isAr,
  onChange,
  categories = [],
  className = '',
  titleAr = 'إلى أين يذهب الزائر؟',
  titleEn = 'Where should this link go?',
  hintAr = 'اختر صفحة أو قسم — أو اكتب رابطاً مخصصاً.',
  hintEn = 'Pick a page or category — or enter a custom URL.',
  customLabelAr = 'رابط مخصص (اختياري)',
  customLabelEn = 'Custom URL (optional)',
}) {
  const [query, setQuery] = useState('');
  const normalized = normalizeHomepageLink(href);
  const groups = useMemo(() => buildHomepageLinkGroups(categories), [categories]);
  const match = findLinkPresetInGroups(normalized, groups);

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          const hay = `${item.labelAr || ''} ${item.labelEn || ''} ${item.path || ''}`.toLowerCase();
          return hay.includes(q);
        }),
      }))
      .filter((group) => group.items.length > 0);
  }, [groups, query]);

  return (
    <div className={`rounded-xl border border-border bg-white p-3 ${className}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold text-text">
            {isAr ? titleAr : titleEn}
          </p>
          <p className="mt-0.5 text-xs text-text-muted">
            {isAr ? hintAr : hintEn}
          </p>
        </div>
        {match && (
          <span className="rounded-full bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-800">
            {isAr ? match.labelAr : match.labelEn}
          </span>
        )}
      </div>

      <div className="relative mb-3">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={isAr ? 'ابحث: عروض، سلة، قسم...' : 'Search: offers, cart, category...'}
          className="w-full rounded-xl border border-border py-2.5 ps-9 pe-3 text-sm"
        />
      </div>

      <div className="max-h-56 space-y-3 overflow-y-auto pe-1">
        {filteredGroups.map((group) => (
          <div key={group.id}>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-text-muted">
              {isAr ? group.labelAr : group.labelEn}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {group.items.map((item) => {
                const active = normalized === normalizeHomepageLink(item.path);
                return (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => onChange(normalizeHomepageLink(item.path))}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                      active
                        ? 'bg-primary-600 text-white shadow-sm'
                        : 'border border-border bg-surface-muted/30 text-text hover:border-primary-200 hover:bg-primary-50'
                    }`}
                  >
                    {isAr ? item.labelAr : item.labelEn}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {filteredGroups.length === 0 && (
          <p className="py-4 text-center text-xs text-text-muted">
            {isAr ? 'لا نتائج — جرّب كلمة أخرى أو رابطاً مخصصاً.' : 'No matches — try another term or use a custom URL.'}
          </p>
        )}
      </div>

      <div className="mt-3 border-t border-border pt-3">
        <label className="mb-1 block text-xs font-medium text-text-muted">
          {isAr ? customLabelAr : customLabelEn}
        </label>
        <input
          className="w-full rounded-xl border border-border px-3 py-2 text-sm"
          dir="ltr"
          placeholder="/products?section=offers"
          value={href || ''}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}
