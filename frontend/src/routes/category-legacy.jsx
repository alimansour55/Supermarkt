/**
 * /categories/:slug — legacy URL; permanently redirects to the full /category/... path.
 */
import { data, redirect } from 'react-router';
import CategoryPage from '../pages/CategoryPage';
import { apiGet } from '../server/api.server';
import { buildMeta } from '../seo/meta';
import { buildCategoryPath } from '../utils/categoryHelpers';

export default CategoryPage;

export async function loader({ params }) {
  let body;
  try {
    body = await apiGet(`/categories/path/${encodeURIComponent(params.slug)}`);
  } catch {
    // API unavailable — the page resolves the redirect in the browser.
    return null;
  }
  if (!body?.slugPath) return data({ notFound: true }, { status: 404 });
  throw redirect(buildCategoryPath(body.slugPath), 301);
}

export const meta = ({ matches, params }) => buildMeta({ matches, path: `/categories/${params.slug}`, noindex: true });
