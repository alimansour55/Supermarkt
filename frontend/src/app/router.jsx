/**
 * The app's router API — import from here instead of 'react-router-dom'.
 *
 * Re-exports React Router, with language-aware versions of the navigation APIs:
 * - Link / NavLink / Navigate / useNavigate prefix app-absolute paths with the
 *   current URL language ('/cart' → '/en/cart' while browsing /en/...).
 * - useLocation returns the pathname *without* the language prefix, so page logic
 *   can keep comparing against '/cart', '/faq', etc.
 * Admin/driver paths are never prefixed (see i18n/routing.js).
 */
import { forwardRef, useCallback, useMemo } from 'react';
import {
  Link as RouterLink,
  NavLink as RouterNavLink,
  Navigate as RouterNavigate,
  useLocation as useRouterLocation,
  useNavigate as useRouterNavigate,
} from 'react-router';
import { langFromPath, localizedPath, stripLang } from '../i18n/routing';

export * from 'react-router';

/** Language of the current URL ('ar' | 'en'), or null outside the storefront. */
export function useUrlLang() {
  return langFromPath(useRouterLocation().pathname);
}

function localizeTo(to, lang) {
  if (!lang) return to;
  if (typeof to === 'string') return localizedPath(lang, to);
  if (to && typeof to === 'object' && typeof to.pathname === 'string') {
    return { ...to, pathname: localizedPath(lang, to.pathname) };
  }
  return to;
}

export const Link = forwardRef(function Link({ to, ...props }, ref) {
  const lang = useUrlLang();
  return <RouterLink ref={ref} to={localizeTo(to, lang)} {...props} />;
});

export const NavLink = forwardRef(function NavLink({ to, ...props }, ref) {
  const lang = useUrlLang();
  return <RouterNavLink ref={ref} to={localizeTo(to, lang)} {...props} />;
});

export function Navigate({ to, ...props }) {
  const lang = useUrlLang();
  return <RouterNavigate to={localizeTo(to, lang)} {...props} />;
}

export function useNavigate() {
  const navigate = useRouterNavigate();
  const lang = useUrlLang();
  return useCallback(
    (to, options) => (typeof to === 'number' ? navigate(to) : navigate(localizeTo(to, lang), options)),
    [navigate, lang],
  );
}

export function useLocation() {
  const location = useRouterLocation();
  return useMemo(
    () => ({ ...location, pathname: stripLang(location.pathname) }),
    [location],
  );
}
