import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DELIVERY_LOCATIONS } from '../data/mockData';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { deliveryZoneService } from '../services/apiServices';

const LocationContext = createContext(null);

const DEFAULT_LOCATION_ID = 'cairo-helwan';

export function LocationProvider({ children }) {
  const [locationId, setLocationId] = useLocalStorage('marketplus_location', DEFAULT_LOCATION_ID);
  // `confirmedReady` turns true once the stored choice has been read (after hydration).
  const [confirmed, setConfirmed, , confirmedReady] = useLocalStorage('marketplus_location_confirmed', false);
  const [pin, setPin] = useLocalStorage('marketplus_location_pin', null);
  const [manualAddress, setManualAddress] = useLocalStorage('marketplus_location_address', null);
  const [zones, setZones] = useState(DELIVERY_LOCATIONS);
  const [loading, setLoading] = useState(true);
  const [gateOpen, setGateOpen] = useState(false);

  const refetchZones = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await deliveryZoneService.list();
      const next = data.data?.length ? data.data : DELIVERY_LOCATIONS;
      setZones(next);
      if (!next.some((zone) => zone.id === locationId)) {
        setLocationId(next[0]?.id || DEFAULT_LOCATION_ID);
      }
    } catch {
      setZones(DELIVERY_LOCATIONS);
    } finally {
      setLoading(false);
    }
  }, [locationId, setLocationId]);

  useEffect(() => {
    refetchZones();
  }, [refetchZones]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') refetchZones();
    };
    document.addEventListener('visibilitychange', onVisible);
    const interval = setInterval(refetchZones, 120000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(interval);
    };
  }, [refetchZones]);

  const confirmLocation = useCallback(({ zoneId, pin: nextPin, address: nextAddress } = {}) => {
    if (zoneId) setLocationId(zoneId);
    setPin(nextPin ?? null);
    setManualAddress(nextAddress ?? null);
    setConfirmed(true);
    setGateOpen(false);
  }, [setConfirmed, setLocationId, setPin, setManualAddress]);

  const resetLocationConfirmation = useCallback(() => {
    setConfirmed(false);
    setPin(null);
    setManualAddress(null);
  }, [setConfirmed, setPin, setManualAddress]);

  const openGate = useCallback(() => setGateOpen(true), []);
  const closeGate = useCallback(() => setGateOpen(false), []);

  const value = useMemo(() => {
    const location = zones.find((l) => l.id === locationId) || zones[0] || DELIVERY_LOCATIONS[0];
    return {
      location,
      locationId,
      setLocationId,
      locations: zones,
      loading,
      refetchZones,
      confirmed,
      confirmedReady,
      pin,
      manualAddress,
      confirmLocation,
      resetLocationConfirmation,
      gateOpen,
      openGate,
      closeGate,
    };
  }, [
    zones, locationId, setLocationId, loading, refetchZones,
    confirmed, confirmedReady, pin, manualAddress, confirmLocation, resetLocationConfirmation,
    gateOpen, openGate, closeGate,
  ]);

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocation() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocation must be used within LocationProvider');
  return ctx;
}
