/**
 * Catch-all — renders the 404 page inside the storefront layout with a real 404 status.
 */
import { data } from 'react-router';
import NotFoundPage from '../pages/NotFoundPage';
import { buildMeta } from '../seo/meta';

export default NotFoundPage;

export function loader() {
  return data({ notFound: true }, { status: 404 });
}

export const meta = ({ matches }) => buildMeta({ matches, title: 'الصفحة غير موجودة', noindex: true });
