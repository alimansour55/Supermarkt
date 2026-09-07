import { ChevronDown, ChevronUp, Edit3, Eye, EyeOff, Plus, Smartphone, Trash2 } from 'lucide-react';

export default function NavigationEditableZone({
  isAr,
  label,
  selected = false,
  inactive = false,
  hiddenOnMobile = false,
  onSelect,
  onEdit,
  onDelete,
  onToggleActive,
  onToggleMobile,
  onMoveUp,
  onMoveDown,
  canMoveUp = true,
  canMoveDown = true,
  canDelete = true,
  showMobileToggle = false,
  children,
  className = '',
}) {
  const showToolbar = selected;

  return (
    <div
      className={[
        'group relative rounded-xl transition',
        selected ? 'ring-2 ring-primary-500 ring-offset-2' : 'hover:ring-2 hover:ring-primary-200/80 hover:ring-offset-1',
        inactive ? 'opacity-55' : '',
        className,
      ].join(' ')}
    >
      <div className={[
        'absolute start-1/2 top-0 z-20 flex -translate-x-1/2 -translate-y-1/2 items-center gap-0.5 rounded-full border border-slate-200 bg-white px-1.5 py-1 shadow-lg transition',
        showToolbar ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
      ].join(' ')}>
        {label && (
          <span className="max-w-[100px] truncate px-1 text-[10px] font-bold text-slate-700" title={label}>
            {label}
          </span>
        )}
        {onMoveUp && (
          <button
            type="button"
            disabled={!canMoveUp}
            onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
            className="rounded p-0.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30"
            title={isAr ? 'تحريك لأعلى' : 'Move up'}
            aria-label={isAr ? 'تحريك لأعلى' : 'Move up'}
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
        )}
        {onMoveDown && (
          <button
            type="button"
            disabled={!canMoveDown}
            onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
            className="rounded p-0.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30"
            title={isAr ? 'تحريك لأسفل' : 'Move down'}
            aria-label={isAr ? 'تحريك لأسفل' : 'Move down'}
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        )}
        {showMobileToggle && onToggleMobile && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleMobile(); }}
            className={[
              'rounded p-0.5 hover:bg-slate-100',
              hiddenOnMobile ? 'text-amber-600' : 'text-emerald-600',
            ].join(' ')}
            title={hiddenOnMobile
              ? (isAr ? 'مخفي على الموبايل — انقر للإظهار' : 'Hidden on mobile — click to show')
              : (isAr ? 'يظهر على الموبايل — انقر للإخفاء' : 'Shown on mobile — click to hide')}
            aria-label={isAr ? 'الموبايل' : 'Mobile visibility'}
          >
            <Smartphone className="h-3.5 w-3.5" />
          </button>
        )}
        {onToggleActive && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleActive(); }}
            className="rounded p-0.5 text-slate-600 hover:bg-slate-100"
            title={inactive ? (isAr ? 'إظهار' : 'Show') : (isAr ? 'إخفاء' : 'Hide')}
            aria-label={inactive ? (isAr ? 'إظهار' : 'Show') : (isAr ? 'إخفاء' : 'Hide')}
          >
            {inactive ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          </button>
        )}
        {onEdit && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="rounded p-0.5 text-primary-700 hover:bg-primary-50"
            title={isAr ? 'تعديل' : 'Edit'}
            aria-label={isAr ? 'تعديل' : 'Edit'}
          >
            <Edit3 className="h-3.5 w-3.5" />
          </button>
        )}
        {canDelete && onDelete && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="rounded p-0.5 text-red-600 hover:bg-red-50"
            title={isAr ? 'حذف' : 'Delete'}
            aria-label={isAr ? 'حذف' : 'Delete'}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={onSelect || onEdit}
        className="block w-full text-start"
        aria-label={label ? `${isAr ? 'تعديل' : 'Edit'} ${label}` : undefined}
      >
        {children}
      </button>

      {inactive && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-slate-900/15">
          <span className="rounded-full bg-slate-800/85 px-2 py-0.5 text-[10px] font-bold text-white">
            {isAr ? 'مخفي' : 'Hidden'}
          </span>
        </div>
      )}
    </div>
  );
}

export function InsertNavSlot({ isAr, onInsert, label }) {
  return (
    <div className="group relative flex h-9 items-center justify-center py-0.5">
      <div className="absolute inset-x-2 top-1/2 border-t border-dashed border-slate-200 transition group-hover:border-primary-300" />
      <button
        type="button"
        onClick={onInsert}
        className="relative z-10 flex h-7 items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 text-[10px] font-bold text-slate-500 opacity-60 shadow-sm transition hover:border-primary-400 hover:bg-primary-50 hover:text-primary-700 group-hover:opacity-100"
      >
        <Plus className="h-3 w-3" />
        {label || (isAr ? 'إضافة' : 'Add')}
      </button>
    </div>
  );
}

export function AddChipButton({ onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-500 transition hover:border-primary-400 hover:bg-primary-50 hover:text-primary-700"
    >
      <Plus className="h-3 w-3" />
      {label}
    </button>
  );
}
