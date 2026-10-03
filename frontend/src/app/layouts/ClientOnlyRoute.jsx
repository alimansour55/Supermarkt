import { Outlet } from 'react-router';
import { PageLoader } from '../routeSuspense';
import { buildMeta } from '../../seo/meta';

/**
 * Layout route for private / interactive areas (admin, driver app, account, cart,
 * checkout, login…). They render only in the browser — the server sends a loader in
 * their place — and are kept out of search results.
 */
export async function clientLoader() {
  return null;
}
clientLoader.hydrate = true;

export function HydrateFallback() {
  return <PageLoader />;
}

export const meta = ({ matches }) => buildMeta({ matches, noindex: true });

export default function ClientOnlyRoute() {
  return <Outlet />;
}
