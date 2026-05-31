import { useState, useRef, useEffect } from 'react';
import { MapPin, ChevronDown } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useLocation } from '../../context/LocationContext';

export default function LocationSelector() {
  const { language } = useLanguage();
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

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-text hover:bg-white/10 transition-colors"
      >
        <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="max-w-[140px] truncate hidden sm:inline">
          {language === 'ar' ? location.nameAr : location.nameEn}
        </span>
        <ChevronDown className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
      </button>

      {open && (
        <div className="absolute start-0 top-full z-50 mt-1 w-64 rounded-xl border border-border bg-white py-2 shadow-xl">
          <p className="px-4 py-2 text-xs font-semibold text-text-muted">
            {language === 'ar' ? 'اختر منطقة التوصيل' : 'Select delivery area'}
          </p>
          {locations.map((loc) => (
            <button
              key={loc.id}
              type="button"
              onClick={() => { setLocationId(loc.id); setOpen(false); }}
              className={`flex w-full items-center gap-2 px-4 py-2.5 text-sm text-start hover:bg-primary-50 ${location.id === loc.id ? 'bg-primary-50 font-semibold text-primary-700' : 'text-text'}`}
            >
              <MapPin className="h-4 w-4 shrink-0 text-primary-600" aria-hidden />
              {language === 'ar' ? loc.nameAr : loc.nameEn}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
