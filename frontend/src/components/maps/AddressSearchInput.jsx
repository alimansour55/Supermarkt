import { useCallback, useEffect, useRef, useState } from 'react';
import { MapPin, Search } from 'lucide-react';
import { resolveAddressSuggestions, ADDRESS_SEARCH_MIN_QUERY } from '../../utils/addressSearch';

const MIN_QUERY = ADDRESS_SEARCH_MIN_QUERY;
const DEBOUNCE_MS = 300;

function suggestionHint(isAr, { usedFallback, googleError, mapsConfigured }) {
  if (googleError === 'quota') {
    return isAr
      ? 'تم تجاوز الحد اليومي لاقتراحات Google (100 طلب/يوم) — النتائج من خريطة مفتوحة. فعّل الفوترة في Google Cloud لرفع الحد، أو حاول غداً.'
      : 'Google daily suggestion limit reached (100/day) — showing open-map results. Enable billing in Google Cloud for higher limits, or try again tomorrow.';
  }
  if (googleError === 'blocked') {
    return isAr
      ? 'مفتاح الخادم لا يملك صلاحية Places API (New) — افتح Google Cloud → Credentials → مفتاح Backend → أضف Places API (New) ضمن API restrictions.'
      : 'Backend API key lacks Places API (New) — open Google Cloud → Credentials → Backend key → add Places API (New) under API restrictions.';
  }
  if (usedFallback && mapsConfigured) {
    return isAr
      ? 'اقتراحات من خريطة مفتوحة — Google غير متاح حالياً.'
      : 'Showing open-map suggestions — Google is unavailable right now.';
  }
  if (usedFallback) {
    return isAr
      ? 'اقتراحات من خريطة مفتوحة — لتفعيل اقتراحات Google (صيدليات ومحلات)، أضف GOOGLE_MAPS_API_KEY في backend/.env وفعّل Places API (New).'
      : 'Showing open-map suggestions — set GOOGLE_MAPS_API_KEY in backend/.env and enable Places API (New).';
  }
  return '';
}

function isQuotaError(message) {
  const text = String(message || '').toLowerCase();
  return text.includes('quota exceeded')
    || text.includes('resource_exhausted')
    || text.includes('billing');
}
function PlacesSearchField({
  isAr,
  label,
  placeholder,
  onSelect,
  suggestPlaces,
  deliveryZone,
  zoneAnchor,
  className,
}) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fallbackHint, setFallbackHint] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const [hasFetched, setHasFetched] = useState(false);
  const wrapperRef = useRef(null);
  const debounceRef = useRef(null);
  const requestIdRef = useRef(0);

  const fetchSuggestions = useCallback(async (value) => {
    const trimmed = value.trim();
    if (trimmed.length < MIN_QUERY) {
      setSuggestions([]);
      setOpen(false);
      setLoading(false);
      setHasFetched(false);
      setError('');
      setFallbackHint('');
      return;
    }

    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError('');
    setFallbackHint('');

    try {
      const resolver = suggestPlaces || ((args) => resolveAddressSuggestions({
        ...args,
        deliveryZone,
        zoneAnchor,
      }));
      const result = await resolver({
        query: trimmed,
        language: isAr ? 'ar' : 'en',
        deliveryZone,
        zoneAnchor,
      });

      if (requestId !== requestIdRef.current) return;

      const next = result.items || result.data?.data || [];
      setSuggestions(next);
      setOpen(next.length > 0);
      setActiveIndex(-1);
      setHasFetched(true);
      if (result.rateLimited) {
        setError(isAr
          ? 'كثرة طلبات البحث — انتظر قليلاً ثم حاول مجدداً.'
          : 'Too many searches — wait a moment and try again.');
        return;
      }

      const hint = suggestionHint(isAr, {
        usedFallback: Boolean(result.usedFallback || ['osm', 'local', 'photon'].includes(result.source)),
        googleError: result.googleError,
        mapsConfigured: result.mapsConfigured,
      });
      setFallbackHint(hint);

      if (!next.length && result.mapsConfigured === false) {
        setError(isAr
          ? 'اقتراحات Google غير مفعّلة — أضف GOOGLE_MAPS_API_KEY في backend/.env وفعّل Places API (New).'
          : 'Google suggestions unavailable — set GOOGLE_MAPS_API_KEY in backend/.env and enable Places API (New).');
      }
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setSuggestions([]);
      setOpen(false);
      setHasFetched(true);

      const apiMsg = err.message || err.response?.data?.message;
      if (isQuotaError(apiMsg)) {
        setFallbackHint(suggestionHint(isAr, { usedFallback: true, googleError: 'quota', mapsConfigured: true }));
        setError('');
      } else {
        setError(apiMsg || (isAr ? 'تعذر تحميل الاقتراحات' : 'Could not load suggestions'));
      }
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [deliveryZone, isAr, suggestPlaces, zoneAnchor]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(query), DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, fetchSuggestions]);

  useEffect(() => {
    const onPointerDown = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  const pick = (item) => {
    setQuery(item.description || item.mainText || '');
    setOpen(false);
    setSuggestions([]);
    onSelect?.(item);
  };

  const onKeyDown = (event) => {
    if (!open || !suggestions.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      pick(suggestions[activeIndex]);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <label className="mb-1 block text-sm font-medium text-text">
        {label || (isAr ? 'ابحث عن عنوان أو منطقة' : 'Search address or area')}
      </label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
          aria-hidden
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (query.trim().length >= MIN_QUERY) {
              fetchSuggestions(query);
            }
            if (suggestions.length) setOpen(true);
          }}
          onKeyDown={onKeyDown}
          placeholder={placeholder || (isAr ? 'اكتب اسم الشارع أو المنطقة…' : 'Type street name or area…')}
          className="w-full rounded-xl border border-border bg-white py-2.5 ps-10 pe-3 text-sm outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
        />
        {loading && (
          <span className="absolute end-3 top-1/2 -translate-y-1/2 text-xs text-text-muted">…</span>
        )}
      </div>

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

      {fallbackHint && !error && (
        <p className="mt-1 text-xs text-amber-800">{fallbackHint}</p>
      )}

      {open && suggestions.length > 0 && (
        <ul
          className="absolute z-[500] mt-1 max-h-60 w-full overflow-auto rounded-xl border border-border bg-white py-1 shadow-xl"
          role="listbox"
        >
          {suggestions.map((item, index) => (
            <li key={item.placeId || item.description} role="option" aria-selected={index === activeIndex}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(item)}
                className={`flex w-full items-start gap-2 px-3 py-2.5 text-start text-sm hover:bg-primary-50 ${
                  index === activeIndex ? 'bg-primary-50' : ''
                }`}
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" aria-hidden />
                <span className="min-w-0">
                  <span className="block font-medium text-text">{item.mainText || item.description}</span>
                  {item.secondaryText && (
                    <span className="block truncate text-xs text-text-muted">{item.secondaryText}</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {!error && hasFetched && query.trim().length >= MIN_QUERY && !loading && suggestions.length === 0 && (
        <p className="mt-1 text-xs text-text-muted">
          {isAr
            ? 'لا توجد اقتراحات — جرّب كلمات أخرى أو حدد الموقع على الخريطة.'
            : 'No suggestions — try different words or pick on the map.'}
        </p>
      )}

      {!error && !hasFetched && (
        <p className="mt-1 text-xs text-text-muted">
          {isAr ? 'ابدأ الكتابة واختر من القائمة.' : 'Start typing and pick from the list.'}
        </p>
      )}
    </div>
  );
}

export default function AddressSearchInput({
  isAr = false,
  label,
  placeholder,
  onSelect,
  suggestPlaces,
  deliveryZone,
  zoneAnchor,
  className = '',
}) {
  return (
    <PlacesSearchField
      isAr={isAr}
      label={label}
      placeholder={placeholder}
      onSelect={onSelect}
      suggestPlaces={suggestPlaces}
      deliveryZone={deliveryZone}
      zoneAnchor={zoneAnchor}
      className={className}
    />
  );
}
