import { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Slide-over panel — edits stay on the same page (no full navigation reload).
 */
export default function AdminSlidePanel({
  open,
  onClose,
  title,
  subtitle,
  children,
  width = 'max-w-lg',
  isAr,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex justify-end" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-black/45"
        onClick={onClose}
        aria-label={isAr ? 'إغلاق' : 'Close'}
      />
      <div
        className={`relative flex h-full w-full flex-col border-s border-border bg-white shadow-2xl ${width} animate-in slide-in-from-end duration-200 [transform:translateZ(0)]`}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border bg-orange-50/90 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-text">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-text-muted">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border p-2 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain bg-slate-50/40 px-5 py-4 [contain:layout_style_paint] [scrollbar-gutter:stable]">
          {children}
        </div>
      </div>
    </div>
  );
}
