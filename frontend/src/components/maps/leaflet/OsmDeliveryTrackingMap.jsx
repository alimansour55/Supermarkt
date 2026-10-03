import { useEffect, useMemo } from 'react';
import { MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const customerIcon = L.divIcon({
  className: '',
  html: '<div style="width:36px;height:36px;border-radius:9999px;background:#059669;color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,.2);border:4px solid #fff;font-size:16px">🏠</div>',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

const driverIcon = L.divIcon({
  className: '',
  html: '<div style="width:36px;height:36px;border-radius:9999px;background:#4f46e5;color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,.2);border:4px solid #fff;font-size:16px">🚚</div>',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

function FitBounds({ points }) {
  const map = useMap();

  useEffect(() => {
    if (!points?.length) return;
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [48, 48] });
  }, [map, points]);

  return null;
}

export default function OsmDeliveryTrackingMap({
  destination,
  driver,
  routePath = [],
  className = 'h-80',
  embedded = false,
}) {
  const customerPosition = useMemo(
    () => ({ lat: Number(destination.lat), lng: Number(destination.lng) }),
    [destination.lat, destination.lng],
  );

  const driverPosition = useMemo(() => {
    if (driver?.lat == null || driver?.lng == null) return null;
    return { lat: Number(driver.lat), lng: Number(driver.lng) };
  }, [driver?.lat, driver?.lng]);

  const center = driverPosition || customerPosition;
  const boundsPoints = useMemo(
    () => [customerPosition, ...(driverPosition ? [driverPosition] : [])],
    [customerPosition, driverPosition],
  );

  const polyline = useMemo(
    () => routePath.map((p) => [p.lat, p.lng]),
    [routePath],
  );

  const shellClass = embedded
    ? className
    : `overflow-hidden rounded-xl border border-border ${className}`;

  return (
    <div className={shellClass} dir="ltr">
      <MapContainer center={[center.lat, center.lng]} zoom={13} className="h-full w-full" scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={boundsPoints} />
        {polyline.length > 1 && (
          <Polyline positions={polyline} pathOptions={{ color: '#2563eb', weight: 4, opacity: 0.85 }} />
        )}
        <Marker position={[customerPosition.lat, customerPosition.lng]} icon={customerIcon} />
        {driverPosition && (
          <Marker position={[driverPosition.lat, driverPosition.lng]} icon={driverIcon} />
        )}
      </MapContainer>
    </div>
  );
}
