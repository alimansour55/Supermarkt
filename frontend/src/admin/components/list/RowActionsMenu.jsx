import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical } from 'lucide-react';

export default function RowActionsMenu({ items, isAr }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  const computePosition = () => {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const isRtl = document.documentElement.dir === 'rtl';
    setPosition({
      top: rect.bottom + 4,
      left: isRtl ? rect.left : null,
      right: isRtl ? null : window.innerWidth - rect.right,
    });
  };

  const toggleOpen = (e) => {
    e.stopPropagation();
    setOpen((v) => {
      const next = !v;
      if (next) computePosition();
      return next;
    });
  };

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (buttonRef.current?.contains(e.target)) return;
      if (menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const closeOnScrollOrResize = () => setOpen(false);
    document.addEventListener('mousedown', close);
    window.addEventListener('scroll', closeOnScrollOrResize, true);
    window.addEventListener('resize', closeOnScrollOrResize);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('scroll', closeOnScrollOrResize, true);
      window.removeEventListener('resize', closeOnScrollOrResize);
    };
  }, [open]);

  return (
    <div className="inline-block text-start">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleOpen}
        className="rounded-lg p-1.5 text-text-muted hover:bg-slate-100 hover:text-text"
        aria-label={isAr ? 'إجراءات' : 'Actions'}
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && position && createPortal(
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: position.top,
            left: position.left ?? undefined,
            right: position.right ?? undefined,
          }}
          className="z-50 min-w-[9rem] rounded-xl border border-border bg-white py-1 shadow-lg"
        >
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
        </div>,
        document.body,
      )}
    </div>
  );
}
