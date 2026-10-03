/**
 * /categories — top-level departments (data comes from the root loader's category tree).
 */
import CategoriesPage from '../pages/CategoriesPage';
import { PUBLIC_PAGE_CACHE } from '../server/site.server';
import { absoluteUrl, buildMeta, getRootData, pickLang, storeName } from '../seo/meta';
import { breadcrumbJsonLd } from '../seo/jsonLd';

export default CategoriesPage;

export const headers = () => ({ 'Cache-Control': PUBLIC_PAGE_CACHE });

export function meta({ matches }) {
  const { settings, siteUrl, categoryTree } = getRootData(matches) || {};
  const roots = (categoryTree || []).filter((cat) => cat.isActive !== false);
  const names = roots.slice(0, 6).map((cat) => pickLang('ar', cat.nameAr || cat.name, cat.nameEn)).join('، ');
  return buildMeta({
    matches,
    path: '/categories',
    title: 'كل الأقسام',
    description: `تصفح كل أقسام ${storeName(settings)}${names ? `: ${names}` : ''} وأكثر.`,
    jsonLd: [
      breadcrumbJsonLd([{ name: 'الرئيسية', path: '/' }, { name: 'الأقسام', path: '/categories' }], siteUrl),
      roots.length ? {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        itemListElement: roots.map((cat, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: pickLang('ar', cat.nameAr || cat.name, cat.nameEn),
          url: absoluteUrl(siteUrl, `/category/${cat.slug}`),
        })),
      } : null,
    ],
  });
}
