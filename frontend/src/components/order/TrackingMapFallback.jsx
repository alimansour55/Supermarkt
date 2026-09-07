import { ExternalLink, MapPin, Navigation } from 'lucide-react';
import {
  buildGoogleMapsDestinationUrl,
  buildGoogleMapsDirectionsUrl,
  buildGoogleMapsSearchUrl,
} from '../../utils/googleMapsLinks';
import Button from '../ui/Button';

export default function TrackingMapFallback({
  isAr = false,
  className = 'h-80',
  reason = 'unavailable',
  destination,
  driver,
  title,
  description,
}) {
  const directionsUrl = buildGoogleMapsDirectionsUrl({ destination, driver })
    || buildGoogleMapsDestinationUrl(destination?.lat, destination?.lng)
    || buildGoogleMapsSearchUrl(destination?.formattedAddress);

  const defaultTitle = {
    unavailable: isAr ? 'الخريطة غير متاحة' : 'Map unavailable',
    stale: isAr ? 'الموقع المباشر غير متاح حالياً' : 'Live location unavailable',
    error: isAr ? 'تعذر تحميل الخريطة' : 'Could not load map',
    no_location: isAr ? 'لا يوجد موقع على الخريطة' : 'No map location',
  }[reason] || (isAr ? 'الخريطة غير متاحة' : 'Map unavailable');

  const defaultDescription = {
    unavailable: isAr
      ? 'يمكنك فتح الموقع في تطبيق خرائط Google.'
      : 'You can open the location in the Google Maps app.',
    stale: isAr
      ? 'لم يُحدَّث موقع المندوب منذ فترة. جرّب التحديث أو افتح الخريطة في Google.'
      : 'Driver location has not updated recently. Refresh or open Google Maps.',
    error: isAr
      ? 'حدث خطأ أثناء تحميل الخريطة. استخدم الرابط أدناه.'
      : 'Something went wrong loading the map. Use the link below.',
    no_location: isAr
      ? 'لا يوجد عنوان بإحداثيات GPS لهذا الطلب.'
      : 'This order has no GPS coordinates for the delivery address.',
  }[reason] || '';

  return (
    <div
      className={`flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-amber-300 bg-amber-50 p-6 text-center text-sm text-amber-950 ${className}`}
      dir={isAr ? 'rtl' : 'ltr'}
    >
      <MapPin className="h-8 w-8 text-amber-700" aria-hidden />
      <div className="max-w-sm space-y-1">
        <p className="font-semibold">{title || defaultTitle}</p>
        {(description || defaultDescription) && (
          <p className="text-xs text-amber-900/85">{description || defaultDescription}</p>
        )}
      </div>
      {directionsUrl && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => window.open(directionsUrl, '_blank', 'noopener,noreferrer')}
        >
          <Navigation className="h-4 w-4" aria-hidden />
          {isAr ? 'فتح في Google Maps' : 'Open in Google Maps'}
          <ExternalLink className="h-3.5 w-3.5 opacity-70" aria-hidden />
        </Button>
      )}
    </div>
  );
}
