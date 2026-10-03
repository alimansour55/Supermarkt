import { Fragment, useEffect, useMemo, useState } from 'react';
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { bearingDegrees, clampRadiusMeters, destinationPoint, haversineMeters } from '../../utils/geoCircle';

const PIN_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" '
  + 'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
  + '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/>'
  + '<circle cx="12" cy="10" r="3"/></svg>';

const defaultIcon = L.divIcon({
  html: `<div class="app-map-pin">${PIN_SVG}</div>`,
  className: '',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

const radiusHandleIcon = L.divIcon({
  html: '<div class="app-radius-handle"></div>',
  className: '',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const zoneHintIcon = L.divIcon({
  html: '<div class="app-zone-hint"></div>',
  className: '',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

function MapViewSync({ center, zoom }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, zoom, { animate: false });
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
 * Drag handle sitting on the circle's edge — dragging it resizes the circle,
 * same interaction as Facebook Marketplace's "search radius" picker.
 */
function RadiusHandle({ center, radiusMeters, onRadiusChange, min, max }) {
  const [bearing, setBearing] = useState(90);

  const handlePosition = useMemo(() => {
    const dest = destinationPoint(center, bearing, radiusMeters);
    return [dest.lat, dest.lng];
  }, [center.lat, center.lng, bearing, radiusMeters]);

  const updateFromLatLng = (lat, lng) => {
    const distance = clampRadiusMeters(haversineMeters(center, { lat, lng }), min, max);
    setBearing(bearingDegrees(center, { lat, lng }));
    onRadiusChange(distance);
  };

  return (
    <Marker
      position={handlePosition}
      icon={radiusHandleIcon}
      draggable
      eventHandlers={{
        drag: (event) => {
          const { lat, lng } = event.target.getLatLng();
          updateFromLatLng(lat, lng);
        },
        dragend: (event) => {
          const { lat, lng } = event.target.getLatLng();
          updateFromLatLng(lat, lng);
        },
      }}
    />
  );
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
  radiusMeters = null,
  onRadiusChange = null,
  radiusMinMeters = 300,
  radiusMaxMeters = 50000,
  onClick,
  onDragEnd,
  heightClass = 'h-64',
  markers = [],
  zoneHints = [],
}) {
  const mapCenter = useMemo(
    () => [position?.lat ?? center.lat, position?.lng ?? center.lng],
    [center.lat, center.lng, position?.lat, position?.lng],
  );

  const editableRadius = Boolean(position) && typeof onRadiusChange === 'function';
  const clampedRadius = editableRadius
    ? clampRadiusMeters(Number(radiusMeters) || 0, radiusMinMeters, radiusMaxMeters)
    : null;

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

        {!editableRadius && position && Number.isFinite(accuracyMeters) && accuracyMeters > 0 && (
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

        {editableRadius && (
          <>
            <Circle
              center={[position.lat, position.lng]}
              radius={clampedRadius}
              pathOptions={{
                color: '#2563eb',
                fillColor: '#3b82f6',
                fillOpacity: 0.12,
                weight: 2,
              }}
            />
            <RadiusHandle
              center={position}
              radiusMeters={clampedRadius}
              onRadiusChange={onRadiusChange}
              min={radiusMinMeters}
              max={radiusMaxMeters}
            />
          </>
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

        {zoneHints.map((z) => (
          <Fragment key={z.id}>
            {Number.isFinite(z.radiusKm) && z.radiusKm > 0 && (
              <Circle
                center={[z.lat, z.lng]}
                radius={z.radiusKm * 1000}
                pathOptions={{
                  color: '#fff',
                  fillColor: '#fff',
                  fillOpacity: 0.12,
                  weight: 1,
                  dashArray: '4 4',
                }}
                interactive={false}
              />
            )}
            <Marker position={[z.lat, z.lng]} icon={zoneHintIcon}>
              {z.label && (
                <Popup>
                  <div className="space-y-1 text-center">
                    <p className="text-sm font-semibold">{z.label}</p>
                    {z.onSelect && (
                      <button
                        type="button"
                        onClick={z.onSelect}
                        className="text-xs font-semibold text-primary-700 hover:underline"
                      >
                        {z.selectLabel}
                      </button>
                    )}
                  </div>
                </Popup>
              )}
            </Marker>
          </Fragment>
        ))}
      </MapContainer>
    </div>
  );
}
