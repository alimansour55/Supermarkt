import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import {
  GOOGLE_MAPS_API_KEY,
  isGoogleMapsEnabled,
} from '../../config/googleMaps';

const GoogleMapsAuthContext = createContext({
  authFailed: false,
  setAuthFailed: () => {},
  resetAuthFailure: () => {},
});

export function useGoogleMapsAuth() {
  return useContext(GoogleMapsAuthContext);
}

/**
 * Detects Google Maps auth failures (billing, referrer, wrong key).
 * Sets window.gm_authFailure — called by Google when the key is rejected.
 */
export function GoogleMapsAuthProvider({ children }) {
  const [authFailed, setAuthFailed] = useState(false);

  useEffect(() => {
    const previous = window.gm_authFailure;
    window.gm_authFailure = () => setAuthFailed(true);
    return () => {
      if (previous) window.gm_authFailure = previous;
      else delete window.gm_authFailure;
    };
  }, []);

  const value = useMemo(() => ({
    authFailed,
    setAuthFailed,
    resetAuthFailure: () => setAuthFailed(false),
  }), [authFailed]);

  return (
    <GoogleMapsAuthContext.Provider value={value}>
      {children}
    </GoogleMapsAuthContext.Provider>
  );
}

export default function GoogleMapsProvider({ isAr = false, libraries, children }) {
  if (!isGoogleMapsEnabled()) {
    return children;
  }

  return (
    <GoogleMapsAuthProvider>
      <APIProvider
        apiKey={GOOGLE_MAPS_API_KEY}
        language={isAr ? 'ar' : 'en'}
        region="EG"
        libraries={libraries}
      >
        {children}
      </APIProvider>
    </GoogleMapsAuthProvider>
  );
}
