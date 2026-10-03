/**
 * /subcategories — all sub-departments (data comes from the root loader's category tree).
 */
import SubcategoriesPage from '../pages/SubcategoriesPage';
import { PUBLIC_PAGE_CACHE } from '../server/site.server';
import { buildMeta, getRootData, storeName } from '../seo/meta';

export default SubcategoriesPage;

export const headers = () => ({ 'Cache-Control': PUBLIC_PAGE_CACHE });

export function meta({ matches, location }) {
  const { settings } = getRootData(matches) || {};
  // Filtered views (?main=…) are the same list narrowed down — index only the full page.
  const filtered = new URLSearchParams(location.search).toString() !== '';
  return buildMeta({
    matches,
    path: '/subcategories',
    title: 'الأقسام الفرعية',
    description: `كل الأقسام الفرعية في ${storeName(settings)} — اختر القسم وتسوق المنتجات.`,
    noindex: filtered,
  });
}
