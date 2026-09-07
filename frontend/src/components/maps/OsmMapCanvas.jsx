import { useEffect, useMemo } from 'react';
import { Circle, MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

const defaultIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function MapViewSync({ center, zoom }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, zoom, { animate: true });
  }, [map, center, zoom]);

  return null;
}

function MapClickLayer({ onClick }) {
  useMapEvents({
    click(event) {
      onClick?.(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

/**
 * Free map tiles (OpenStreetMap) — works without Google Maps billing.
 * Geocoding still uses your backend when the user pins a location.
 */
export default function OsmMapCanvas({
  center,
  zoom = 13,
  position = null,
  accuracyMeters = null,
  onClick,
  onDragEnd,
  heightClass = 'h-64',
  markers = [],
}) {
  const mapCenter = useMemo(
    () => [position?.lat ?? center.lat, position?.lng ?? center.lng],
    [center.lat, center.lng, position?.lat, position?.lng],
  );

  return (
    <div className={`overflow-hidden rounded-xl border border-border ${heightClass}`} dir="ltr">
      <MapContainer
        center={mapCenter}
        zoom={zoom}
        className="h-full w-full"
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapViewSync center={mapCenter} zoom={zoom} />
        {onClick && <MapClickLayer onClick={onClick} />}

        {position && Number.isFinite(accuracyMeters) && accuracyMeters > 0 && (
          <Circle
            center={[position.lat, position.lng]}
            radius={Math.min(Math.max(accuracyMeters, 20), 2500)}
            pathOptions={{
              color: '#2563eb',
              fillColor: '#3b82f6',
              fillOpacity: 0.12,
              weight: 1,
            }}
          />
        )}

        {position && (
          <Marker
            position={[position.lat, position.lng]}
            icon={defaultIcon}
            draggable={Boolean(onDragEnd)}
            eventHandlers={{
              dragend: (event) => {
                const { lat, lng } = event.target.getLatLng();
                onDragEnd?.(lat, lng);
              },
            }}
          />
        )}

        {markers.map((m) => (
          <Marker
            key={m.id}
            position={[m.lat, m.lng]}
            icon={defaultIcon}
            eventHandlers={m.onClick ? { click: m.onClick } : undefined}
          />
        ))}
      </MapContainer>
    </div>
  );
}
