import { LayoutGrid, Rows3, Search, X } from 'lucide-react';
import Input from '../../../components/ui/Input';

function ViewToggle({ view, onChange, isAr }) {
  return (
    <div className="flex items-center gap-0.5 rounded-xl border border-border bg-white p-0.5 shadow-sm">
      <button
        type="button"
        onClick={() => onChange('table')}
        aria-pressed={view === 'table'}
        aria-label={isAr ? 'عرض جدول' : 'Table view'}
        className={`rounded-lg p-1.5 transition-colors ${view === 'table' ? 'bg-primary-600 text-white' : 'text-text-muted hover:bg-slate-100'}`}
      >
        <Rows3 className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => onChange('grid')}
        aria-pressed={view === 'grid'}
        aria-label={isAr ? 'عرض شبكي' : 'Grid view'}
        className={`rounded-lg p-1.5 transition-colors ${view === 'grid' ? 'bg-primary-600 text-white' : 'text-text-muted hover:bg-slate-100'}`}
      >
        <LayoutGrid className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function ProductsToolbar({
  isAr,
  q,
  onSearchChange,
  view,
  onViewChange,
  quickFilters = [],
  onClearQuickFilters,
  filters,
  actions,
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <Input
            placeholder={isAr ? 'ابحث بالاسم أو SKU أو الباركود...' : 'Search by name, SKU, or barcode...'}
            value={q}
            onChange={(e) => onSearchChange(e.target.value)}
            className="ps-9"
          />
        </div>
        <ViewToggle view={view} onChange={onViewChange} isAr={isAr} />
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      </div>

      {quickFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {quickFilters.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.onClick}
              aria-pressed={chip.active}
              className={[
                'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                chip.active
                  ? 'border-primary-600 bg-primary-600 text-white shadow-sm'
                  : 'border-border bg-white text-text-muted hover:border-primary-300 hover:text-text',
              ].join(' ')}
            >
              {chip.label}
              {chip.active && <X className="h-3 w-3" />}
            </button>
          ))}
          {onClearQuickFilters && (
            <button
              type="button"
              onClick={onClearQuickFilters}
              className="ms-1 text-xs font-semibold text-primary-700 hover:underline"
            >
              {isAr ? 'مسح الفلاتر' : 'Clear filters'}
            </button>
          )}
        </div>
      )}

      {filters && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          {filters}
        </div>
      )}
    </div>
  );
}
