import { useCallback, useEffect, useRef, useState } from 'react';
import { orderService } from '../services/apiServices';
import { haversineKm } from '../utils/orderTracking';

/** Send at least this often while moving slowly or standing still. */
const MAX_INTERVAL_MS = 30000;
/** Never more often than this (fast driving). */
const MIN_INTERVAL_MS = 5000;
/** Below this movement, wait for MAX_INTERVAL_MS (GPS jitter while parked). */
const MIN_MOVE_M = 25;
/** Above this speed (m/s ≈ 29 km/h), send at MIN_INTERVAL_MS. */
const FAST_SPEED_MS = 8;

/**
 * One GPS stream for the driver's whole shift. While `enabled`, the position goes to
 * `PUT /orders/driver/location`, and the server applies it to every order the driver
 * has out for delivery. It lives in the driver layout, so it keeps running across
 * pages instead of stopping when the delivery screen closes.
 *
 * Sending adapts to movement: every 5 s when driving fast, every 30 s when parked,
 * otherwise once the driver has moved 25 m.
 */
export function useDriverShiftLocation({ enabled }) {
  const [error, setError] = useState('');
  const [lastSent, setLastSent] = useState(null);
  const [lastPosition, setLastPosition] = useState(null);
  const [restartKey, setRestartKey] = useState(0);
  const lastSentRef = useRef({ at: 0, lat: null, lng: null });
  const pendingRef = useRef(false);

  const restart = useCallback(() => {
    setError('');
    setRestartKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined' || !navigator.geolocation) return undefined;

    let cancelled = false;

    const shouldSend = (coords) => {
      const prev = lastSentRef.current;
      const elapsed = Date.now() - prev.at;
      if (elapsed < MIN_INTERVAL_MS) return false;
      if (elapsed >= MAX_INTERVAL_MS || prev.lat == null) return true;
      if ((coords.speed ?? 0) >= FAST_SPEED_MS) return true;
      const movedM = (haversineKm(
        { lat: prev.lat, lng: prev.lng },
        { lat: coords.latitude, lng: coords.longitude },
      ) ?? 0) * 1000;
      return movedM >= MIN_MOVE_M;
    };

    const send = async (position) => {
      const { coords } = position;
      if (cancelled) return;
      setLastPosition({ lat: coords.latitude, lng: coords.longitude });
      if (pendingRef.current || !shouldSend(coords)) return;
      pendingRef.current = true;
      lastSentRef.current = { at: Date.now(), lat: coords.latitude, lng: coords.longitude };
      try {
        const { data } = await orderService.updateDriverShiftLocation({
          lat: coords.latitude,
          lng: coords.longitude,
          heading: Number.isFinite(coords.heading) ? coords.heading : undefined,
          speed: Number.isFinite(coords.speed) ? coords.speed : undefined,
        });
        if (cancelled) return;
        setLastSent(data.data?.updatedAt || new Date().toISOString());
        setError('');
      } catch (err) {
        if (cancelled) return;
        setError(err.response?.status === 429 ? 'rate_limited' : (err.response?.data?.message || err.message));
      } finally {
        pendingRef.current = false;
      }
    };

    const watchId = navigator.geolocation.watchPosition(
      send,
      (geoErr) => {
        if (cancelled) return;
        setError(geoErr.code === 1 ? 'denied' : (geoErr.message || 'unavailable'));
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );

    // watchPosition only fires on movement on some devices — keep a heartbeat while parked.
    const heartbeat = setInterval(() => {
      navigator.geolocation.getCurrentPosition(send, () => {}, { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 });
    }, MAX_INTERVAL_MS);

    return () => {
      cancelled = true;
      navigator.geolocation.clearWatch(watchId);
      clearInterval(heartbeat);
    };
  }, [enabled, restartKey]);

  const supported = typeof navigator !== 'undefined' && Boolean(navigator.geolocation);
  return {
    sharing: enabled && supported,
    error: enabled && !supported ? 'unsupported' : error,
    lastSent,
    lastPosition,
    restart,
  };
}
