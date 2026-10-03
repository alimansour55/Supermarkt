import { useEffect, useMemo } from 'react';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const DEFAULT_CENTER = { lat: 30.0444, lng: 31.2357 };

function deliveryIcon(orderNumber, { stale, selected }) {
  const bg = stale ? '#d97706' : '#4f46e5';
  const ring = selected ? 'box-shadow:0 0 0 4px #a5b4fc;' : '';
  return L.divIcon({
    className: '',
    html: `<div style="min-width:40px;padding:4px 8px;border-radius:9999px;background:${bg};color:#fff;font-size:10px;font-weight:700;text-align:center;box-shadow:0 4px 12px rgba(0,0,0,.2);border:4px solid #fff;${ring}">🚚<br/>${orderNumber}</div>`,
    iconAnchor: [20, 20],
  });
}

const customerIcon = L.divIcon({
  className: '',
  html: '<div style="width:36px;height:36px;border-radius:9999px;background:#059669;color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,.2);border:4px solid #fff;font-size:16px">🏠</div>',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

function FitBounds({ points }) {
  const map = useMap();

  useEffect(() => {
    if (!points?.length) return;
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [56, 56] });
  }, [map, points]);

  return null;
}

export default function OsmAdminLiveMap({
  deliveries,
  selectedId,
  onSelect,
  className,
}) {
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

  return (
    <div className={`overflow-hidden rounded-2xl border border-border bg-white shadow-sm ${className}`} dir="ltr">
      <MapContainer center={[center.lat, center.lng]} zoom={12} className="h-full w-full" scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={boundsPoints.length ? boundsPoints : [DEFAULT_CENTER]} />

        {deliveries.map((delivery) => {
          const loc = delivery.driver?.location || delivery.destination;
          if (!loc?.lat || !loc?.lng) return null;

          const position = [Number(loc.lat), Number(loc.lng)];
          const isSelected = delivery.orderId === selectedId;
          const stale = delivery.driver?.location?.stale;

          return (
            <Marker
              key={delivery.orderId}
              position={position}
              icon={deliveryIcon(delivery.orderNumber, { stale, selected: isSelected })}
              eventHandlers={{
                click: () => onSelect?.(delivery.orderId),
              }}
            />
          );
        })}

        {selected?.destination?.lat != null && selected?.destination?.lng != null && (
          <Marker
            position={[Number(selected.destination.lat), Number(selected.destination.lng)]}
            icon={customerIcon}
          />
        )}
      </MapContainer>
    </div>
  );
}
