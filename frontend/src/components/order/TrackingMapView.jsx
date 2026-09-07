import { useEffect, useState } from 'react';
import { isGoogleMapsEnabled, preferOsmMap } from '../../config/googleMaps';
import GoogleMapsProvider, { useGoogleMapsAuth } from '../maps/GoogleMapsProvider';
import OsmDeliveryTrackingMap from '../maps/OsmDeliveryTrackingMap';
import DeliveryTrackingMap from './DeliveryTrackingMap';
import TrackingMapFallback from './TrackingMapFallback';

const MAP_LOAD_TIMEOUT_MS = 12_000;

function MapLoadGuard({ onFailed }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!window.google?.maps || document.querySelector('.gm-err-title, .gm-err-message')) {
        onFailed?.();
      }
    }, MAP_LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [onFailed]);

  return null;
}

function GoogleTrackingMapCanvas({
  destination,
  driver,
  routePath,
  isAr,
  className,
  showDriverPin,
  onMapFailed,
}) {
  const { authFailed } = useGoogleMapsAuth();

  useEffect(() => {
    if (authFailed) onMapFailed?.();
  }, [authFailed, onMapFailed]);

  return (
    <div className={`relative overflow-hidden rounded-xl border border-border ${className}`} dir="ltr">
      <MapLoadGuard onFailed={onMapFailed} />
      <DeliveryTrackingMap
        destination={destination}
        driver={showDriverPin ? driver : null}
        routePath={routePath}
        isAr={isAr}
        className="h-full min-h-[inherit]"
        embedded
      />
    </div>
  );
}

function OsmTrackingWithHint({ isAr, className, children }) {
  return (
    <div className="space-y-2">
      <div className={`overflow-hidden rounded-xl border border-border ${className}`}>
        {children}
      </div>
      {isGoogleMapsEnabled() && (
        <p className="text-xs text-text-muted">
          {isAr
            ? 'الخريطة عبر OpenStreetMap — لتفعيل خرائط Google، فعّل الفوترة في Google Cloud.'
            : 'Map via OpenStreetMap. To use Google Maps, enable billing in Google Cloud.'}
        </p>
      )}
    </div>
  );
}

/**
 * Tracking map with RTL labels, stale hide rules, and Google Maps deep-link fallback.
 */
export default function TrackingMapView({
  destination,
  driver,
  routePath = [],
  isAr = false,
  className = 'h-80',
  mapVisible = true,
  showDriverPin = true,
  fallbackReason,
}) {
  const [useOsm, setUseOsm] = useState(() => preferOsmMap() || !isGoogleMapsEnabled());

  useEffect(() => {
    setUseOsm(preferOsmMap() || !isGoogleMapsEnabled());
  }, [destination?.lat, destination?.lng, driver?.lat, driver?.lng, mapVisible]);

  if (!destination?.lat || !destination?.lng) {
    return (
      <TrackingMapFallback
        isAr={isAr}
        className={className}
        reason="no_location"
        destination={destination}
        driver={driver}
      />
    );
  }

  if (mapVisible === false) {
    return (
      <TrackingMapFallback
        isAr={isAr}
        className={className}
        reason={fallbackReason || 'stale'}
        destination={destination}
        driver={driver}
      />
    );
  }

  if (useOsm) {
    return (
      <OsmTrackingWithHint isAr={isAr} className={className}>
        <OsmDeliveryTrackingMap
          destination={destination}
          driver={showDriverPin ? driver : null}
          routePath={routePath}
          className="h-full min-h-[inherit]"
          embedded
        />
      </OsmTrackingWithHint>
    );
  }

  return (
    <GoogleMapsProvider isAr={isAr}>
      <GoogleTrackingMapCanvas
        destination={destination}
        driver={driver}
        routePath={routePath}
        isAr={isAr}
        className={className}
        showDriverPin={showDriverPin}
        onMapFailed={() => setUseOsm(true)}
      />
    </GoogleMapsProvider>
  );
}
