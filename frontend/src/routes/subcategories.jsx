/**
 * /:lang/subcategories — all sub-departments (data comes from the root loader's category tree).
 */
import SubcategoriesPage from '../pages/SubcategoriesPage';
import { PUBLIC_PAGE_CACHE } from '../server/site.server';
import { buildMeta, getRootData, metaLang, pickLang, storeName } from '../seo/meta';

export default SubcategoriesPage;

export const headers = () => ({ 'Cache-Control': PUBLIC_PAGE_CACHE });

export function meta({ matches, location }) {
  const lang = metaLang(location);
  const { settings } = getRootData(matches) || {};
  const store = storeName(settings, lang);
  // Filtered views (?main=…) are the same list narrowed down — index only the full page.
  const filtered = new URLSearchParams(location.search).toString() !== '';
  return buildMeta({
    matches,
    location,
    path: '/subcategories',
    title: pickLang(lang, 'الأقسام الفرعية', 'Subcategories'),
    description: lang === 'en'
      ? `Every subcategory at ${store} — pick one and start shopping.`
      : `كل الأقسام الفرعية في ${store} — اختر القسم وتسوق المنتجات.`,
    noindex: filtered,
  });
}
