/**
 * /brands — all brands A–Z.
 */
import BrandsPage from '../pages/BrandsPage';
import { apiGetSafe } from '../server/api.server';
import { PUBLIC_PAGE_CACHE } from '../server/site.server';
import { buildMeta, getRootData, storeName } from '../seo/meta';
import { breadcrumbJsonLd } from '../seo/jsonLd';

export default BrandsPage;

export async function loader() {
  const body = await apiGetSafe('/brands', { cached: true, ttlMs: 300_000 });
  return { brands: Array.isArray(body?.data) ? body.data : null };
}

export const headers = () => ({ 'Cache-Control': PUBLIC_PAGE_CACHE });

export function meta({ matches }) {
  const { settings, siteUrl } = getRootData(matches) || {};
  return buildMeta({
    matches,
    path: '/brands',
    title: 'الماركات',
    description: `تسوق منتجات أشهر الماركات من ${storeName(settings)} مع توصيل سريع وأسعار مميزة.`,
    jsonLd: [breadcrumbJsonLd([{ name: 'الرئيسية', path: '/' }, { name: 'الماركات', path: '/brands' }], siteUrl)],
  });
}
