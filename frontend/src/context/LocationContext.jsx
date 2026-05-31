import { createContext, useContext, useMemo } from 'react';
import { DELIVERY_LOCATIONS } from '../data/mockData';
import { useLocalStorage } from '../hooks/useLocalStorage';

const LocationContext = createContext(null);

export function LocationProvider({ children }) {
  const [locationId, setLocationId] = useLocalStorage('marketplus_location', 'cairo-maadi');

  const value = useMemo(() => {
    const location = DELIVERY_LOCATIONS.find((l) => l.id === locationId) || DELIVERY_LOCATIONS[0];
    return { location, locationId, setLocationId, locations: DELIVERY_LOCATIONS };
  }, [locationId, setLocationId]);

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocation() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocation must be used within LocationProvider');
  return ctx;
}
