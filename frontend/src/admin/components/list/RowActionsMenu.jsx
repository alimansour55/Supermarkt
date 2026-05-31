import { useEffect, useRef, useState } from 'react';
import { MoreVertical } from 'lucide-react';

export default function RowActionsMenu({ items, isAr }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div className="relative inline-block text-start" ref={ref}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="rounded-lg p-1.5 text-text-muted hover:bg-slate-100 hover:text-text"
        aria-label={isAr ? 'إجراءات' : 'Actions'}
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute end-0 z-20 mt-1 min-w-[9rem] rounded-xl border border-border bg-white py-1 shadow-lg">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              disabled={item.disabled}
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                item.onClick();
              }}
              className={[
                'block w-full px-3 py-2 text-start text-sm transition-colors disabled:opacity-50',
                item.danger ? 'text-red-600 hover:bg-red-50' : 'text-text hover:bg-slate-50',
              ].join(' ')}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
