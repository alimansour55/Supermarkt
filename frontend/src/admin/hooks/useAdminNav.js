import { useCallback, useMemo } from 'react';
import { useLocation } from '../../app/router';
import { useAuth } from '../../context/AuthContext';
import { useAdminPanel } from '../context/AdminPanelContext';
import { hasPermission } from '../adminPermissions';
import { getVisibleNav, getVisibleSettings, locateNav } from '../adminNavGroups';

/** The menu for the signed-in user plus where the current URL sits in it. */
export default function useAdminNav() {
  const { user } = useAuth();
  const { showRevenue, features } = useAdminPanel();
  const { pathname } = useLocation();

  const can = useCallback((permission) => hasPermission(user, permission), [user]);
  const ctx = useMemo(() => ({ can, showRevenue, features }), [can, showRevenue, features]);

  const nav = useMemo(() => getVisibleNav(ctx), [ctx]);
  const settings = useMemo(() => getVisibleSettings(ctx), [ctx]);
  const current = useMemo(() => locateNav(pathname, nav), [pathname, nav]);

  return { nav, settings, current, ctx, pathname };
}
