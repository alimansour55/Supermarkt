import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, MapPin, Search, X, Check } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useLocation } from '../../context/LocationContext';
import { useStoreSettings } from '../../context/StoreSettingsContext';
import { deliveryLocationLabel } from '../../utils/locationGate';

const estimateLabel = (loc) => {
  if (!loc) return '';
  if (loc.expressAvailable && loc.estimatedExpress) return loc.estimatedExpress;
  if (loc.scheduledAvailable && loc.estimatedScheduled) return loc.estimatedScheduled;
  return '';
};

export function DeliveryAreaSheet({ open, onClose, onSelected }) {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { location, setLocationId, locations } = useLocation();
  const [search, setSearch] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setSearch('');
      return undefined;
    }
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => inputRef.current?.focus(), 150);
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
      clearTimeout(t);
    };
  }, [open, onClose]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return locations;
    return locations.filter((loc) => {
      const ar = (loc.nameAr || '').toLowerCase();
      const en = (loc.nameEn || '').toLowerCase();
      return ar.includes(q) || en.includes(q);
    });
  }, [locations, search]);

  const pick = (id) => {
    setLocationId(id);
    onSelected?.();
    onClose();
  };

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] md:hidden" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-label={isAr ? 'إغلاق' : 'Close'}
      />
      <div className="absolute inset-x-0 bottom-0 flex max-h-[min(85vh,640px)] flex-col rounded-t-2xl bg-white shadow-2xl safe-bottom">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-4">
          <h2 className="text-lg font-bold text-text">
            {isAr ? 'اختر منطقة التوصيل' : 'Select delivery area'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-surface"
            aria-label={isAr ? 'إغلاق' : 'Close'}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="shrink-0 border-b border-border px-4 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden />
            <input
              ref={inputRef}
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isAr ? 'ابحث عن منطقة...' : 'Search areas...'}
              className="w-full rounded-xl border border-border bg-surface py-3 pe-3 ps-10 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
              autoComplete="off"
            />
          </div>
          <p className="mt-2 text-xs text-text-muted">
            {isAr
              ? `${filtered.length} من ${locations.length} منطقة`
              : `${filtered.length} of ${locations.length} areas`}
          </p>
        </div>

        <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2" role="listbox">
          {filtered.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-text-muted">
              {isAr ? 'لا توجد نتائج' : 'No areas found'}
            </li>
          ) : (
            filtered.map((loc) => {
              const selected = location.id === loc.id;
              const name = isAr ? loc.nameAr : loc.nameEn;
              return (
                <li key={loc.id} role="option" aria-selected={selected}>
                  <button
                    type="button"
                    onClick={() => pick(loc.id)}
                    className={`flex w-full items-start gap-3 rounded-xl px-3 py-3.5 text-start transition-colors ${
                      selected ? 'bg-primary-50 text-primary-800' : 'text-text hover:bg-surface'
                    }`}
                  >
                    <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary-600" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{name}</span>
                    </span>
                    {selected && <Check className="h-5 w-5 shrink-0 text-primary-600" aria-hidden />}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>,
    document.body,
  );
}

/** Desktop dropdown list (md+). */
export function DeliveryAreaDropdown({ open, onClose, onSelected, align = 'start' }) {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { location, setLocationId, locations } = useLocation();
  const [search, setSearch] = useState('');
  const showSearch = locations.length > 8;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return locations;
    return locations.filter((loc) => {
      const ar = (loc.nameAr || '').toLowerCase();
      const en = (loc.nameEn || '').toLowerCase();
      return ar.includes(q) || en.includes(q);
    });
  }, [locations, search]);

  useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  if (!open) return null;

  const alignClass = align === 'end' ? 'end-0' : 'start-0';

  return (
    <div className={`absolute ${alignClass} top-full z-50 mt-1.5 w-full min-w-[280px] max-w-sm overflow-hidden rounded-xl border border-border bg-white shadow-xl`}>
      <p className="border-b border-border px-4 py-2.5 text-xs font-semibold text-text-muted">
        {isAr ? 'اختر منطقة التوصيل' : 'Select delivery area'}
      </p>
      {showSearch && (
        <div className="border-b border-border px-3 py-2">
          <div className="relative">
            <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" aria-hidden />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isAr ? 'ابحث...' : 'Search...'}
              className="w-full rounded-lg border border-border py-2 pe-2 ps-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </div>
        </div>
      )}
      <ul className="max-h-64 overflow-y-auto py-1" role="listbox">
        {filtered.map((loc) => {
          const selected = location.id === loc.id;
          return (
            <li key={loc.id} role="option" aria-selected={selected}>
              <button
                type="button"
                onClick={() => {
                  setLocationId(loc.id);
                  onSelected?.();
                  onClose();
                }}
                className={`flex w-full items-start gap-2 px-4 py-2.5 text-start text-sm hover:bg-primary-50 ${
                  selected ? 'bg-primary-50 font-semibold text-primary-700' : 'text-text'
                }`}
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate">{isAr ? loc.nameAr : loc.nameEn}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Delivery area selector — bottom sheet on mobile, dropdown on desktop.
 * @param {'compact'|'row'|'form'|'header'} variant
 */
export default function DeliveryAreaPicker({
  variant = 'compact',
  className = '',
  onSelected,
  sheetOnly = false,
}) {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { location, pin, manualAddress, openGate } = useLocation();
  const { settings } = useStoreSettings();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // When the startup location popup is enabled it becomes the single "change area" UI.
  const gateEnabled = Boolean(settings?.locationGate?.enabled);

  // A precise pin dropped in the startup popup is what the customer chose — show it
  // instead of the admin zone label (the zone is still used silently for pricing).
  const locationName = deliveryLocationLabel(
    pin,
    isAr ? location.nameAr : location.nameEn,
    isAr,
    manualAddress,
  );
  const estimate = estimateLabel(location);
  const useSheet = sheetOnly || variant !== 'header';

  const close = useCallback(() => setOpen(false), []);
  const toggle = () => {
    if (gateEnabled) {
      openGate();
      return;
    }
    setOpen((v) => !v);
  };

  useEffect(() => {
    if (!open || useSheet) return undefined;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) close();
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [open, useSheet, close]);

  const triggerProps = {
    type: 'button',
    onClick: toggle,
    'aria-expanded': open,
    'aria-haspopup': 'listbox',
  };

  let trigger;

  if (variant === 'compact') {
    trigger = (
      <button
        {...triggerProps}
        className="flex max-w-[128px] items-center gap-1 rounded-xl border border-border bg-white px-2.5 py-2 text-xs font-semibold text-primary-700 transition-colors hover:border-primary-200"
      >
        <MapPin className="h-3.5 w-3.5 shrink-0 text-primary-600" aria-hidden />
        <span className="min-w-0 truncate">{locationName}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-text-muted transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
    );
  } else if (variant === 'row') {
    trigger = (
      <button
        {...triggerProps}
        className="flex w-full items-center gap-3 rounded-xl border border-border bg-white px-4 py-3.5 text-start transition-colors hover:border-primary-200 hover:bg-primary-50/30"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
          <MapPin className="h-5 w-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-medium text-text-muted">
            {isAr ? 'منطقة التوصيل' : 'Delivery area'}
          </span>
          <span className="block truncate text-sm font-bold text-text">{locationName}</span>
          {estimate && (
            <span className="block truncate text-xs text-text-muted">{estimate}</span>
          )}
        </span>
        <span className="shrink-0 text-xs font-semibold text-primary-600">
          {isAr ? 'تغيير' : 'Change'}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-text-muted transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
    );
  } else if (variant === 'form') {
    trigger = (
      <>
        <label className="mb-1.5 block text-sm font-medium text-text">
          {isAr ? 'منطقة التوصيل' : 'Delivery area'}
        </label>
        <button
          {...triggerProps}
          className="flex w-full items-center gap-3 rounded-xl border border-border bg-white px-4 py-3 text-start text-sm transition-colors hover:border-primary-300 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
        >
          <MapPin className="h-5 w-5 shrink-0 text-primary-600" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold text-text">{locationName}</span>
          </span>
          <ChevronDown className={`h-4 w-4 shrink-0 text-text-muted transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
        </button>
      </>
    );
  } else {
    trigger = (
      <button
        {...triggerProps}
        className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-white/80 transition-colors hover:bg-white/10"
      >
        <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="hidden sm:inline">{isAr ? 'التوصيل إلى:' : 'Deliver to:'}</span>
        <span className="max-w-[180px] truncate font-semibold text-white">{locationName}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 opacity-80 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
    );
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      {trigger}
      {variant === 'form' && (
        <p className="mt-1.5 text-xs text-text-muted">
          {isAr ? 'اضغط لاختيار منطقة التوصيل من القائمة' : 'Tap to choose your delivery area from the list'}
        </p>
      )}
      {useSheet ? (
        <>
          <div className="md:hidden">
            <DeliveryAreaSheet open={open} onClose={close} onSelected={onSelected} />
          </div>
          <div className="hidden md:block">
            <DeliveryAreaDropdown open={open} onClose={close} onSelected={onSelected} />
          </div>
        </>
      ) : (
        <DeliveryAreaDropdown open={open} onClose={close} onSelected={onSelected} />
      )}
    </div>
  );
}
