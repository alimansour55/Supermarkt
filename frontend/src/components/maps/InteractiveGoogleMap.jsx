import { useEffect, useState } from 'react';
import {
  APILoadingStatus,
  Map,
  AdvancedMarker,
  Circle as GoogleCircle,
  Marker,
  useApiLoadingStatus,
  useMap,
} from '@vis.gl/react-google-maps';
import { MapPin } from 'lucide-react';
import {
  GOOGLE_MAPS_MAP_ID,
  isGoogleMapsEnabled,
  preferOsmMap,
  useAdvancedMapMarkers,
} from '../../config/googleMaps';
import GoogleMapsProvider from './GoogleMapsProvider';
import OsmMapCanvas from './OsmMapCanvas';
import { useGoogleMapsAuth } from './GoogleMapsProvider';
import Loader from '../ui/Loader';
import { clampRadiusMeters } from '../../utils/geoCircle';

function toOsmClickHandler(onClick) {
  if (!onClick) return undefined;
  return (lat, lng) => onClick({ detail: { latLng: { lat, lng } } });
}

function toOsmDragHandler(onDragEnd) {
  if (!onDragEnd) return undefined;
  return (lat, lng) => onDragEnd({ latLng: { lat: () => lat, lng: () => lng } });
}

function MapPanTo({ center, zoom }) {
  const map = useMap();

  useEffect(() => {
    if (!map || center?.lat == null || center?.lng == null) return;
    map.panTo(center);
    if (zoom != null) map.setZoom(zoom);
  }, [map, center?.lat, center?.lng, zoom]);

  return null;
}

function GoogleMapMarker({ position, draggable, onDragEnd, useAdvanced }) {
  if (!position) return null;

  if (useAdvanced) {
    return (
      <AdvancedMarker position={position} draggable={draggable} onDragEnd={onDragEnd}>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-600 text-white shadow-lg ring-4 ring-white">
          <MapPin className="h-5 w-5" aria-hidden />
        </div>
      </AdvancedMarker>
    );
  }

  return <Marker position={position} draggable={draggable} onDragEnd={onDragEnd} />;
}

/** Editable/resizable coverage circle — dragging its edge handle resizes it, like a Facebook Marketplace radius filter. */
function GoogleRadiusCircle({ position, radiusMeters, onRadiusChange, min, max }) {
  if (!position || typeof onRadiusChange !== 'function') return null;
  const clamped = clampRadiusMeters(Number(radiusMeters) || 0, min, max);

  return (
    <GoogleCircle
      center={position}
      radius={clamped}
      editable
      draggable={false}
      clickable={false}
      strokeColor="#2563eb"
      strokeOpacity={0.9}
      strokeWeight={2}
      fillColor="#3b82f6"
      fillOpacity={0.12}
      onRadiusChanged={(nextRadius) => {
        if (!Number.isFinite(nextRadius)) return;
        onRadiusChange(clampRadiusMeters(nextRadius, min, max));
      }}
    />
  );
}

function GoogleMapInner({
  center,
  zoom,
  position,
  radiusMeters,
  onRadiusChange,
  radiusMinMeters,
  radiusMaxMeters,
  onClick,
  onDragEnd,
  heightClass,
  onBroken,
}) {
  const useAdvanced = useAdvancedMapMarkers();
  const status = useApiLoadingStatus();

  useEffect(() => {
    if (status !== APILoadingStatus.LOADED) return undefined;

    const timer = setTimeout(() => {
      if (document.querySelector('.gm-err-title, .gm-err-message')) {
        onBroken?.();
      }
    }, 2500);

    return () => clearTimeout(timer);
  }, [status, onBroken]);

  if (status === APILoadingStatus.AUTH_FAILURE || status === APILoadingStatus.FAILED) {
    onBroken?.();
    return null;
  }

  if (status !== APILoadingStatus.LOADED) {
    return (
      <div className={`flex items-center justify-center rounded-xl border border-border bg-slate-50 ${heightClass}`}>
        <Loader />
      </div>
    );
  }

  return (
    <div className={`overflow-hidden rounded-xl border border-border ${heightClass}`} dir="ltr">
      <Map
        {...(useAdvanced ? { mapId: GOOGLE_MAPS_MAP_ID } : {})}
        defaultCenter={center}
        defaultZoom={zoom}
        gestureHandling="greedy"
        disableDefaultUI={false}
        onClick={onClick}
        className="h-full w-full"
        reuseMaps
      >
        <MapPanTo center={center} zoom={zoom} />
        <GoogleMapMarker
          position={position}
          draggable={Boolean(position)}
          onDragEnd={onDragEnd}
          useAdvanced={useAdvanced}
        />
        <GoogleRadiusCircle
          position={position}
          radiusMeters={radiusMeters}
          onRadiusChange={onRadiusChange}
          min={radiusMinMeters}
          max={radiusMaxMeters}
        />
      </Map>
    </div>
  );
}

function OsmMapWithHint({
  center,
  zoom,
  position,
  accuracyMeters,
  radiusMeters,
  onRadiusChange,
  radiusMinMeters,
  radiusMaxMeters,
  onClick,
  onDragEnd,
  isAr,
  heightClass,
}) {
  return (
    <div className="space-y-2">
      <OsmMapCanvas
        center={center}
        zoom={zoom}
        position={position}
        accuracyMeters={accuracyMeters}
        radiusMeters={radiusMeters}
        onRadiusChange={onRadiusChange}
        radiusMinMeters={radiusMinMeters}
        radiusMaxMeters={radiusMaxMeters}
        onClick={toOsmClickHandler(onClick)}
        onDragEnd={toOsmDragHandler(onDragEnd)}
        heightClass={heightClass}
      />
      {isGoogleMapsEnabled() && (
        <p className="text-xs text-text-muted">
          {isAr
            ? 'الخريطة عبر OpenStreetMap — لا حاجة لإعداد Google. لتفعيل خرائط Google، فعّل الفوترة في Google Cloud.'
            : 'Map via OpenStreetMap (no Google billing needed). To use Google Maps, enable billing in Google Cloud.'}
        </p>
      )}
    </div>
  );
}

function MapPickerCanvas({
  center,
  zoom,
  position,
  radiusMeters,
  onRadiusChange,
  radiusMinMeters,
  radiusMaxMeters,
  onClick,
  onDragEnd,
  isAr,
  heightClass,
}) {
  const { authFailed } = useGoogleMapsAuth();
  const [useOsm, setUseOsm] = useState(() => preferOsmMap() || !isGoogleMapsEnabled());

  useEffect(() => {
    if (authFailed) setUseOsm(true);
  }, [authFailed]);

  if (useOsm) {
    return (
      <OsmMapWithHint
        center={center}
        zoom={zoom}
        position={position}
        radiusMeters={radiusMeters}
        onRadiusChange={onRadiusChange}
        radiusMinMeters={radiusMinMeters}
        radiusMaxMeters={radiusMaxMeters}
        onClick={onClick}
        onDragEnd={onDragEnd}
        isAr={isAr}
        heightClass={heightClass}
      />
    );
  }

  return (
    <GoogleMapInner
      center={center}
      zoom={zoom}
      position={position}
      radiusMeters={radiusMeters}
      onRadiusChange={onRadiusChange}
      radiusMinMeters={radiusMinMeters}
      radiusMaxMeters={radiusMaxMeters}
      onClick={onClick}
      onDragEnd={onDragEnd}
      heightClass={heightClass}
      onBroken={() => setUseOsm(true)}
    />
  );
}

export function InteractiveMapCanvas(props) {
  if (!isGoogleMapsEnabled()) {
    return (
      <OsmMapWithHint
        {...props}
        onClick={props.onClick}
        onDragEnd={props.onDragEnd}
      />
    );
  }

  return <MapPickerCanvas {...props} />;
}

export default function InteractiveGoogleMap(props) {
  if (!isGoogleMapsEnabled() || preferOsmMap()) {
    return <InteractiveMapCanvas {...props} />;
  }

  return (
    <GoogleMapsProvider isAr={props.isAr}>
      <InteractiveMapCanvas {...props} />
    </GoogleMapsProvider>
  );
}
