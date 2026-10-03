/**
 * /:lang/brands — all brands A–Z.
 */
import BrandsPage from '../pages/BrandsPage';
import { apiGetSafe } from '../server/api.server';
import { PUBLIC_PAGE_CACHE } from '../server/site.server';
import { buildMeta, getRootData, homeLabel, metaLang, pickLang, storeName } from '../seo/meta';
import { breadcrumbJsonLd } from '../seo/jsonLd';

export default BrandsPage;

export async function loader() {
  const body = await apiGetSafe('/brands', { cached: true, ttlMs: 300_000 });
  return { brands: Array.isArray(body?.data) ? body.data : null };
}

export const headers = () => ({ 'Cache-Control': PUBLIC_PAGE_CACHE });

export function meta({ matches, location }) {
  const lang = metaLang(location);
  const { settings, siteUrl } = getRootData(matches) || {};
  const store = storeName(settings, lang);
  const title = pickLang(lang, 'الماركات', 'Brands');
  return buildMeta({
    matches,
    location,
    path: '/brands',
    title,
    description: lang === 'en'
      ? `Shop products from top brands at ${store} with fast delivery and great prices.`
      : `تسوق منتجات أشهر الماركات من ${store} مع توصيل سريع وأسعار مميزة.`,
    jsonLd: [breadcrumbJsonLd([{ name: homeLabel(lang), path: '/' }, { name: title, path: '/brands' }], siteUrl, lang)],
  });
}
