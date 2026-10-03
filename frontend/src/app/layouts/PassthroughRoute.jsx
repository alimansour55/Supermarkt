import { Outlet } from 'react-router';

/** Capacitor (SPA) stand-in for ClientOnlyRoute — everything is client-rendered there anyway. */
export default function PassthroughRoute() {
  return <Outlet />;
}
