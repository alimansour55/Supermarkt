import { Navigate, useLocation } from '../router';
import { DEFAULT_LANG } from '../../i18n/routing';

/** / → /ar (default language). Server-side this is a redirect in routes/root-redirect.jsx. */
export default function RootRedirect() {
  const { search, hash } = useLocation();
  return <Navigate to={`/${DEFAULT_LANG}${search}${hash}`} replace />;
}
