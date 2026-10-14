import { useAuth } from '../context/AuthContext';
import { useHydrated } from '../components/ui/ClientOnly';
import { viewerAudienceForUser } from '../utils/bannerAudience';

/**
 * The visitor's banner audience. Stays "guests" during SSR and hydration so it
 * matches the server-rendered HTML, then switches once the signed-in user is known.
 */
export default function useBannerViewer() {
  const { user } = useAuth();
  const hydrated = useHydrated();
  return hydrated ? viewerAudienceForUser(user) : 'guests';
}
