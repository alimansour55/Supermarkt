import { useEffect, useRef } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';

export default function PlaceAutocompleteInput({
  label,
  placeholder,
  isAr = false,
  onPlaceSelect,
  className = '',
}) {
  const inputRef = useRef(null);
  const places = useMapsLibrary('places');
  const autocompleteRef = useRef(null);

  useEffect(() => {
    if (!places || !inputRef.current) return undefined;

    const autocomplete = new places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: 'eg' },
      fields: ['geometry', 'formatted_address', 'place_id', 'address_components', 'name'],
    });

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (place?.geometry?.location) {
        onPlaceSelect?.(place);
      }
    });

    autocompleteRef.current = autocomplete;

    return () => {
      if (window.google?.maps?.event) {
        window.google.maps.event.clearInstanceListeners(autocomplete);
      }
    };
  }, [places, onPlaceSelect]);

  return (
    <div className={className}>
      <label className="mb-1 block text-sm font-medium text-text">
        {label || (isAr ? 'ابحث عن عنوانك' : 'Search your address')}
      </label>
      <input
        ref={inputRef}
        type="text"
        placeholder={placeholder || (isAr ? 'اكتب اسم الشارع أو المكان…' : 'Type street name or place…')}
        className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
        autoComplete="off"
      />
    </div>
  );
}
