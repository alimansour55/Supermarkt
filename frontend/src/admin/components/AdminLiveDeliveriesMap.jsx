import { useEffect, useMemo, useState } from 'react';
import { AdvancedMarker, Map, Marker, useMap } from '@vis.gl/react-google-maps';
import { Home, Truck } from 'lucide-react';
import {
  GOOGLE_MAPS_MAP_ID,
  isGoogleMapsEnabled,
  preferOsmMap,
  useAdvancedMapMarkers,
} from '../../config/googleMaps';
import GoogleMapsProvider, { useGoogleMapsAuth } from '../../components/maps/GoogleMapsProvider';
import OsmAdminLiveMap from '../../components/maps/OsmAdminLiveMap';

const DEFAULT_CENTER = { lat: 30.0444, lng: 31.2357 };

function MapBounds({ points }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !points?.length || !window.google?.maps) return;
    const bounds = new window.google.maps.LatLngBounds();
    points.forEach((point) => bounds.extend(point));
    map.fitBounds(bounds, { top: 56, right: 56, bottom: 56, left: 56 });
  }, [map, points]);

  return null;
}

function GoogleAdminLiveMapCanvas({
  deliveries,
  selectedId,
  onSelect,
  isAr,
  className,
  onBroken,
}) {
  const { authFailed } = useGoogleMapsAuth();
  const useAdvanced = useAdvancedMapMarkers();

  const selected = useMemo(
    () => deliveries.find((d) => d.orderId === selectedId) || null,
    [deliveries, selectedId],
  );

  const boundsPoints = useMemo(() => {
    if (selected) {
      const pts = [];
      if (selected.driver?.location) {
        pts.push({ lat: selected.driver.location.lat, lng: selected.driver.location.lng });
      }
      if (selected.destination) {
        pts.push({ lat: selected.destination.lat, lng: selected.destination.lng });
      }
      return pts;
    }

    return deliveries
      .map((d) => d.driver?.location || d.destination)
      .filter((p) => p?.lat != null && p?.lng != null)
      .map((p) => ({ lat: Number(p.lat), lng: Number(p.lng) }));
  }, [deliveries, selected]);

  const center = boundsPoints[0] || DEFAULT_CENTER;

  useEffect(() => {
    if (authFailed) onBroken?.();
  }, [authFailed, onBroken]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (document.querySelector('.gm-err-title, .gm-err-message')) {
        onBroken?.();
      }
    }, 2500);
    return () => clearTimeout(timer);
  }, [onBroken]);

  const labels = isAr
    ? { customer: 'عنوان العميل', driver: 'المندوب' }
    : { customer: 'Customer address', driver: 'Driver' };

  return (
    <div className={`overflow-hidden rounded-2xl border border-border bg-white shadow-sm ${className}`} dir="ltr">
      <Map
        {...(useAdvanced ? { mapId: GOOGLE_MAPS_MAP_ID } : {})}
        defaultCenter={center}
        defaultZoom={12}
        gestureHandling="greedy"
        disableDefaultUI={false}
        className="h-full w-full"
        reuseMaps
      >
        <MapBounds points={boundsPoints.length ? boundsPoints : [DEFAULT_CENTER]} />

        {deliveries.map((delivery) => {
          const loc = delivery.driver?.location || delivery.destination;
          if (!loc?.lat || !loc?.lng) return null;

          const position = { lat: Number(loc.lat), lng: Number(loc.lng) };
          const isSelected = delivery.orderId === selectedId;
          const stale = delivery.driver?.location?.stale;

          if (!useAdvanced) {
            return (
              <Marker
                key={delivery.orderId}
                position={position}
                title={`#${delivery.orderNumber}`}
                onClick={() => onSelect?.(delivery.orderId)}
              />
            );
          }

          return (
            <AdvancedMarker
              key={delivery.orderId}
              position={position}
              onClick={() => onSelect?.(delivery.orderId)}
              title={`#${delivery.orderNumber}`}
            >
              <button
                type="button"
                onClick={() => onSelect?.(delivery.orderId)}
                className={[
                  'flex min-w-[2.5rem] flex-col items-center rounded-full px-2 py-1 text-[10px] font-bold text-white shadow-lg ring-4 ring-white transition',
                  stale ? 'bg-amber-600' : 'bg-indigo-600',
                  isSelected ? 'scale-110 ring-indigo-300' : '',
                ].join(' ')}
              >
                <Truck className="h-4 w-4" aria-hidden />
                <span className="mt-0.5 max-w-[4rem] truncate">{delivery.orderNumber}</span>
              </button>
            </AdvancedMarker>
          );
        })}

        {selected?.destination?.lat != null && selected?.destination?.lng != null && (
          useAdvanced ? (
            <AdvancedMarker
              position={{
                lat: Number(selected.destination.lat),
                lng: Number(selected.destination.lng),
              }}
              title={labels.customer}
            >
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg ring-4 ring-white"
                aria-label={labels.customer}
              >
                <Home className="h-5 w-5" aria-hidden />
              </div>
            </AdvancedMarker>
          ) : (
            <Marker
              position={{
                lat: Number(selected.destination.lat),
                lng: Number(selected.destination.lng),
              }}
              title={labels.customer}
            />
          )
        )}
      </Map>
    </div>
  );
}

function AdminLiveMapBody(props) {
  const [useOsm, setUseOsm] = useState(() => preferOsmMap() || !isGoogleMapsEnabled());

  if (useOsm) {
    return (
      <div className="space-y-2">
        <OsmAdminLiveMap {...props} />
        {isGoogleMapsEnabled() && (
          <p className="text-xs text-text-muted">
            {props.isAr
              ? 'الخريطة عبر OpenStreetMap — لتفعيل خرائط Google، فعّل الفوترة في Google Cloud.'
              : 'Map via OpenStreetMap. To use Google Maps, enable billing in Google Cloud.'}
          </p>
        )}
      </div>
    );
  }

  return (
    <GoogleMapsProvider isAr={props.isAr}>
      <GoogleAdminLiveMapCanvas {...props} onBroken={() => setUseOsm(true)} />
    </GoogleMapsProvider>
  );
}

export default function AdminLiveDeliveriesMap(props) {
  return <AdminLiveMapBody {...props} />;
}
