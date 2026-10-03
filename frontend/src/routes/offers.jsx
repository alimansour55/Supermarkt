/**
 * /offers — discounted products.
 */
import OffersPage from '../pages/OffersPage';
import { apiGetSafe } from '../server/api.server';
import { PUBLIC_PAGE_CACHE } from '../server/site.server';
import { buildMeta, getRootData, listingSeo, storeName } from '../seo/meta';
import { productListJsonLd } from '../seo/jsonLd';
import { offersApiParams, offersFiltersFromSearch, paramsKey } from '../utils/listingParams';

export default OffersPage;

export async function loader({ request }) {
  const apiParams = offersApiParams(offersFiltersFromSearch(new URL(request.url).searchParams));
  const body = await apiGetSafe('/products/offers', { params: apiParams });
  if (!body?.data) return { result: null, seedKey: null };
  return {
    result: { data: body.data, pagination: body.pagination ?? null, meta: body.meta ?? null },
    seedKey: paramsKey(apiParams),
  };
}

export const headers = () => ({ 'Cache-Control': PUBLIC_PAGE_CACHE });

export const shouldRevalidate = ({ currentUrl, nextUrl }) => currentUrl.pathname !== nextUrl.pathname;

export function meta({ data: loaderData, matches, location }) {
  const { settings, siteUrl } = getRootData(matches) || {};
  const { path, page, noindex } = listingSeo(location);
  return buildMeta({
    matches,
    path,
    title: `العروض والخصومات${page > 1 ? ` - صفحة ${page}` : ''}`,
    description: `أقوى العروض والخصومات في ${storeName(settings)} على البقالة والمنتجات المنزلية — وفّر أكثر مع توصيل سريع.`,
    noindex,
    jsonLd: [productListJsonLd(loaderData?.result?.data, { siteUrl, name: 'العروض' })],
  });
}
