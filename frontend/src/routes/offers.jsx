/**
 * /:lang/offers — discounted products.
 */
import OffersPage from '../pages/OffersPage';
import { apiGetSafe } from '../server/api.server';
import { PUBLIC_PAGE_CACHE } from '../server/site.server';
import { buildMeta, getRootData, listingSeo, metaLang, pickLang, storeName } from '../seo/meta';
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
  const lang = metaLang(location);
  const { settings, siteUrl } = getRootData(matches) || {};
  const { path, page, noindex } = listingSeo(location);
  const listName = pickLang(lang, 'العروض والخصومات', 'Offers & discounts');
  const store = storeName(settings, lang);
  return buildMeta({
    matches,
    location,
    path,
    title: `${listName}${page > 1 ? ` - ${pickLang(lang, 'صفحة', 'Page')} ${page}` : ''}`,
    description: lang === 'en'
      ? `The best deals and discounts at ${store} on groceries and household essentials — save more with fast delivery.`
      : `أقوى العروض والخصومات في ${store} على البقالة والمنتجات المنزلية — وفّر أكثر مع توصيل سريع.`,
    noindex,
    jsonLd: [productListJsonLd(loaderData?.result?.data, { siteUrl, name: listName, lang })],
  });
}
