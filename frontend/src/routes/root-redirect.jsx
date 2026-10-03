/**
 * / → /ar. Temporary (302) so the default language can later be negotiated
 * (e.g. from Accept-Language) without browsers having cached a permanent redirect.
 */
import { redirect } from 'react-router';
import RootRedirect from '../app/layouts/RootRedirect';
import { DEFAULT_LANG } from '../i18n/routing';

export default RootRedirect;

export function loader({ request }) {
  const url = new URL(request.url);
  throw redirect(`/${DEFAULT_LANG}${url.search}`, 302);
}
