import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DELIVERY_LOCATIONS } from '../data/mockData';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { deliveryZoneService } from '../services/apiServices';

const LocationContext = createContext(null);

export function LocationProvider({ children }) {
  const [locationId, setLocationId] = useLocalStorage('marketplus_location', 'cairo-maadi');
  const [zones, setZones] = useState(DELIVERY_LOCATIONS);
  const [loading, setLoading] = useState(true);

  const refetchZones = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await deliveryZoneService.list();
      const next = data.data?.length ? data.data : DELIVERY_LOCATIONS;
      setZones(next);
      if (!next.some((zone) => zone.id === locationId)) {
        setLocationId(next[0]?.id || 'cairo-maadi');
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

  const value = useMemo(() => {
    const location = zones.find((l) => l.id === locationId) || zones[0] || DELIVERY_LOCATIONS[0];
    return { location, locationId, setLocationId, locations: zones, loading, refetchZones };
  }, [loading, locationId, refetchZones, setLocationId, zones]);

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocation() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocation must be used within LocationProvider');
  return ctx;
}
