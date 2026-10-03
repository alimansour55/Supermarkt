/**
 * /:lang/categories — top-level departments (data comes from the root loader's category tree).
 */
import CategoriesPage from '../pages/CategoriesPage';
import { PUBLIC_PAGE_CACHE } from '../server/site.server';
import { buildMeta, getRootData, homeLabel, metaLang, pickLang, storeName } from '../seo/meta';
import { breadcrumbJsonLd, linkListJsonLd } from '../seo/jsonLd';

export default CategoriesPage;

export const headers = () => ({ 'Cache-Control': PUBLIC_PAGE_CACHE });

export function meta({ matches, location }) {
  const lang = metaLang(location);
  const { settings, siteUrl, categoryTree } = getRootData(matches) || {};
  const roots = (categoryTree || []).filter((cat) => cat.isActive !== false);
  const links = roots.map((cat) => ({
    name: pickLang(lang, cat.nameAr || cat.name, cat.nameEn),
    path: `/category/${cat.slug}`,
  }));
  const names = links.slice(0, 6).map((link) => link.name).join(lang === 'en' ? ', ' : '، ');
  const store = storeName(settings, lang);
  const title = pickLang(lang, 'كل الأقسام', 'All categories');
  return buildMeta({
    matches,
    location,
    path: '/categories',
    title,
    description: lang === 'en'
      ? `Browse every department at ${store}${names ? `: ${names}` : ''} and more.`
      : `تصفح كل أقسام ${store}${names ? `: ${names}` : ''} وأكثر.`,
    jsonLd: [
      breadcrumbJsonLd([{ name: homeLabel(lang), path: '/' }, { name: title, path: '/categories' }], siteUrl, lang),
      linkListJsonLd(links, { siteUrl, name: title, lang }),
    ],
  });
}
