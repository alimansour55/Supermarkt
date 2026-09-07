import { useEffect } from 'react';
import { AdvancedMarker, Map, Marker, useMap } from '@vis.gl/react-google-maps';
import { Home, Truck } from 'lucide-react';
import {
  GOOGLE_MAPS_MAP_ID,
  useAdvancedMapMarkers,
} from '../../config/googleMaps';

const MAP_LABELS = {
  customer: { ar: 'عنوان التوصيل', en: 'Delivery address' },
  driver: { ar: 'مندوب التوصيل', en: 'Driver' },
};

function RoutePolyline({ path }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !path?.length || !window.google?.maps) return undefined;

    const line = new window.google.maps.Polyline({
      path,
      strokeColor: '#2563eb',
      strokeWeight: 4,
      strokeOpacity: 0.85,
    });
    line.setMap(map);

    return () => {
      line.setMap(null);
    };
  }, [map, path]);

  return null;
}

function MapBounds({ points }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !points?.length || !window.google?.maps) return;
    const bounds = new window.google.maps.LatLngBounds();
    points.forEach((point) => bounds.extend(point));
    map.fitBounds(bounds, { top: 48, right: 48, bottom: 48, left: 48 });
  }, [map, points]);

  return null;
}

export default function DeliveryTrackingMap({
  destination,
  driver,
  routePath = [],
  isAr = false,
  className = 'h-80',
  embedded = false,
}) {
  const useAdvanced = useAdvancedMapMarkers();

  if (!destination?.lat || !destination?.lng) {
    return null;
  }

  const customerPosition = { lat: Number(destination.lat), lng: Number(destination.lng) };
  const driverPosition = driver?.lat != null && driver?.lng != null
    ? { lat: Number(driver.lat), lng: Number(driver.lng) }
    : null;

  const center = driverPosition || customerPosition;
  const boundsPoints = [customerPosition, ...(driverPosition ? [driverPosition] : [])];
  const labels = isAr
    ? { customer: MAP_LABELS.customer.ar, driver: MAP_LABELS.driver.ar }
    : { customer: MAP_LABELS.customer.en, driver: MAP_LABELS.driver.en };

  const shellClass = embedded
    ? className
    : `overflow-hidden rounded-xl border border-border ${className}`;

  return (
    <div className={shellClass} dir="ltr">
      <Map
        {...(useAdvanced ? { mapId: GOOGLE_MAPS_MAP_ID } : {})}
        defaultCenter={center}
        center={center}
        defaultZoom={13}
        gestureHandling="greedy"
        disableDefaultUI={false}
        className="h-full w-full"
        reuseMaps
      >
        <MapBounds points={boundsPoints} />
        {routePath.length > 1 && <RoutePolyline path={routePath} />}

        {useAdvanced ? (
          <>
            <AdvancedMarker position={customerPosition} title={labels.customer}>
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg ring-4 ring-white"
                aria-label={labels.customer}
              >
                <Home className="h-5 w-5" aria-hidden />
              </div>
            </AdvancedMarker>
            {driverPosition && (
              <AdvancedMarker position={driverPosition} title={labels.driver}>
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg ring-4 ring-white"
                  style={driver?.heading != null ? { transform: `rotate(${driver.heading}deg)` } : undefined}
                  aria-label={labels.driver}
                >
                  <Truck className="h-5 w-5" aria-hidden />
                </div>
              </AdvancedMarker>
            )}
          </>
        ) : (
          <>
            <Marker position={customerPosition} title={labels.customer} />
            {driverPosition && (
              <Marker position={driverPosition} title={labels.driver} />
            )}
          </>
        )}
      </Map>
    </div>
  );
}
