import { useState, useRef, useEffect } from 'react';
import { MapPin, ChevronDown } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useLocation } from '../../context/LocationContext';
import { useStoreSettings } from '../../context/StoreSettingsContext';
import { DeliveryAreaSheet, DeliveryAreaDropdown } from '../layout/DeliveryAreaPicker';
import { deliveryLocationLabel } from '../../utils/locationGate';

/** “Delivering to: Maadi (change)” — home page location strip. */
export default function HomeDeliveryBar() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { location, pin, openGate } = useLocation();
  const { settings } = useStoreSettings();
  const gateEnabled = Boolean(settings?.locationGate?.enabled);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const openPicker = () => (gateEnabled ? openGate() : setOpen(true));

  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const areaName = isAr ? location.nameAr : location.nameEn;
  const shortName = pin
    ? deliveryLocationLabel(pin, areaName, isAr)
    : areaName.split(',')[0].trim();

  return (
    <section className="container-app py-6">
      <div
        ref={ref}
        className="relative flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-white px-4 py-3.5 shadow-sm"
      >
        <div className="flex min-w-0 items-center gap-2">
          <MapPin className="h-5 w-5 shrink-0 text-primary-600" aria-hidden />
          <p className="min-w-0 text-sm text-text">
            <span className="text-text-muted">{isAr ? 'التوصيل إلى:' : 'Delivering to:'}</span>
            {' '}
            <span
              className="inline-block max-w-[220px] truncate align-bottom font-bold text-text"
              title={shortName}
            >
              {shortName}
            </span>
          </p>
        </div>

        <button
          type="button"
          onClick={openPicker}
          className="flex items-center gap-1 rounded-xl border border-primary-200 bg-primary-50 px-3 py-2 text-sm font-semibold text-primary-700 hover:bg-primary-100 md:hidden"
        >
          {isAr ? 'تغيير' : 'Change'}
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
        </button>

        <button
          type="button"
          onClick={() => (gateEnabled ? openGate() : setOpen((v) => !v))}
          className="hidden items-center gap-1 rounded-xl border border-primary-200 bg-primary-50 px-3 py-2 text-sm font-semibold text-primary-700 hover:bg-primary-100 md:flex"
        >
          {isAr ? 'اختر منطقة التوصيل' : 'Select delivery area'}
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
        </button>

        {!gateEnabled && (
          <div className="hidden md:block">
            <DeliveryAreaDropdown open={open} onClose={() => setOpen(false)} align="end" />
          </div>
        )}
      </div>

      {!gateEnabled && <DeliveryAreaSheet open={open} onClose={() => setOpen(false)} />}
    </section>
  );
}
