import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLocation } from '../context/LocationContext';
import { useHydrated } from '../components/ui/ClientOnly';
import { viewerKind } from '../utils/homepageVisibility';

const CLOCK_TICK_MS = 60_000;

/**
 * Who is looking at the homepage, for section audience / zone / time rules.
 * During SSR and hydration it is an anonymous guest with no zone and no clock,
 * so the first browser render matches the server HTML; then the real visitor
 * takes over and the clock re-checks every minute (sections that end disappear).
 */
export default function useHomepageViewer() {
  const { user, loading } = useAuth();
  const { locationId } = useLocation();
  const hydrated = useHydrated();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!hydrated) return undefined;
    const timer = setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, [hydrated]);

  if (!hydrated) return { viewer: 'guest', zoneId: null, now: null };
  return {
    // While the session is still loading, keep the guest view rather than flashing.
    viewer: loading ? 'guest' : viewerKind(user),
    zoneId: locationId || null,
    now,
  };
}
