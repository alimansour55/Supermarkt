import { useState, useRef, useEffect } from 'react';
import { MapPin, ChevronDown } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useLocation } from '../../context/LocationContext';

/** “Delivering to: Maadi (change)” — home page location strip. */
export default function HomeDeliveryBar() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { location, setLocationId, locations } = useLocation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const areaName = isAr ? location.nameAr : location.nameEn;
  const shortName = areaName.split(',')[0].trim();

  return (
    <section className="container-app py-6">
      <div
        ref={ref}
        className="relative flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-white px-4 py-3.5 shadow-sm"
      >
        <div className="flex min-w-0 items-center gap-2">
          <MapPin className="h-5 w-5 shrink-0 text-primary-600" aria-hidden />
          <p className="text-sm text-text">
            <span className="text-text-muted">{isAr ? 'التوصيل إلى:' : 'Delivering to:'}</span>
            {' '}
            <span className="font-bold text-text">{shortName}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1 rounded-xl border border-primary-200 bg-primary-50 px-3 py-2 text-sm font-semibold text-primary-700 hover:bg-primary-100"
        >
          {isAr ? 'تغيير' : 'Change'}
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="absolute end-4 top-full z-30 mt-2 w-full max-w-sm rounded-xl border border-border bg-white py-2 shadow-xl sm:end-4 sm:w-72">
            <p className="px-4 py-2 text-xs font-semibold text-text-muted">
              {isAr ? 'اختر منطقة التوصيل' : 'Select delivery area'}
            </p>
            {locations.map((loc) => (
              <button
                key={loc.id}
                type="button"
                onClick={() => { setLocationId(loc.id); setOpen(false); }}
                className={`flex w-full items-center gap-2 px-4 py-2.5 text-sm text-start hover:bg-primary-50 ${
                  location.id === loc.id ? 'bg-primary-50 font-semibold text-primary-700' : 'text-text'
                }`}
              >
                <MapPin className="h-4 w-4 shrink-0 text-primary-600" />
                {isAr ? loc.nameAr : loc.nameEn}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
