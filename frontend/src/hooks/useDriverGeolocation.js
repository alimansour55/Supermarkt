import { useCallback, useEffect, useRef, useState } from 'react';
import { orderService } from '../services/apiServices';

const TERMINAL_STATUSES = ['delivered', 'delivery_failed'];
const SEND_INTERVAL_MS = 20000;

export function useDriverGeolocation(orderId, { enabled, orderStatus, onLocationSent, onStopped }) {
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState('');
  const [lastSent, setLastSent] = useState(null);
  const [lastPosition, setLastPosition] = useState(null);
  const watchIdRef = useRef(null);
  const lastSendTimeRef = useRef(0);
  const pendingRef = useRef(false);

  const stop = useCallback(() => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setSharing(false);
    onStopped?.();
  }, [onStopped]);

  const sendPosition = useCallback(async (position) => {
    const now = Date.now();
    if (now - lastSendTimeRef.current < SEND_INTERVAL_MS) return;
    if (pendingRef.current) return;

    pendingRef.current = true;
    lastSendTimeRef.current = now;

    try {
      const { data } = await orderService.updateDriverLocation(orderId, {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        heading: position.coords.heading ?? undefined,
        speed: position.coords.speed ?? undefined,
      });
      setLastSent(data.data?.updatedAt || new Date().toISOString());
      setLastPosition({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      });
      setError('');
      onLocationSent?.(data.data);
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      setError(err.response?.status === 429
        ? 'Too many location updates — please wait'
        : msg);
      if (err.response?.status === 400 || err.response?.status === 403) {
        stop();
      }
    } finally {
      pendingRef.current = false;
    }
  }, [orderId, onLocationSent, stop]);

  useEffect(() => {
    if (!enabled || !orderId) return undefined;

    if (TERMINAL_STATUSES.includes(orderStatus)) {
      stop();
      return undefined;
    }

    if (!navigator.geolocation) {
      setError('Geolocation is not supported on this device');
      return undefined;
    }

    setSharing(true);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => { sendPosition(pos); },
      (geoErr) => setError(geoErr.message || 'Location access denied'),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 },
    );

    navigator.geolocation.getCurrentPosition(
      (pos) => { sendPosition(pos); },
      () => {},
      { enableHighAccuracy: true, timeout: 15000 },
    );

    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setSharing(false);
    };
  }, [enabled, orderId, orderStatus, sendPosition, stop]);

  useEffect(() => {
    if (TERMINAL_STATUSES.includes(orderStatus)) {
      stop();
    }
  }, [orderStatus, stop]);

  return { sharing, error, lastSent, lastPosition, stop };
}
