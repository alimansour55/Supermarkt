/**
 * Lowest-priority catch-all: any URL without a language prefix (old links such as
 * /products/x or /cart) permanently redirects to the same page under /ar.
 */
import { data, redirect } from 'react-router';
import LegacyRedirect from '../app/layouts/LegacyRedirect';
import { DEFAULT_LANG, localizedPath } from '../i18n/routing';

export default LegacyRedirect;

export function loader({ request }) {
  const url = new URL(request.url);
  const target = localizedPath(DEFAULT_LANG, url.pathname);
  // Paths that are never localized (e.g. a mistyped /api URL) just 404.
  if (target === url.pathname) return data(null, { status: 404 });
  throw redirect(`${target}${url.search}`, 301);
}
