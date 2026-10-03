import { Navigate, useLocation } from '../router';
import { DEFAULT_LANG, localizedPath } from '../../i18n/routing';

/**
 * Old unprefixed storefront URL (/products/x, /cart…) → same page under /ar.
 * Server-side this is a 301 in routes/legacy-redirect.jsx.
 */
export default function LegacyRedirect() {
  const { pathname, search, hash } = useLocation();
  const target = localizedPath(DEFAULT_LANG, pathname);
  if (target === pathname) {
    return <p className="p-10 text-center text-slate-500">404</p>;
  }
  return <Navigate to={`${target}${search}${hash}`} replace />;
}
