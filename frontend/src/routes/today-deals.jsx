/**
 * /:lang/today-deals — limited-time deals.
 */
import TodaysDealsPage from '../pages/TodaysDealsPage';
import { apiGetSafe } from '../server/api.server';
import { buildMeta, getRootData, listingSeo, metaLang, pickLang, storeName } from '../seo/meta';
import { productListJsonLd } from '../seo/jsonLd';
import {
  TODAYS_DEALS_DEFAULT_SORT,
  paramsKey,
  parsePage,
  todaysDealsApiParams,
} from '../utils/listingParams';

export default TodaysDealsPage;

export async function loader({ request }) {
  const search = new URL(request.url).searchParams;
  const apiParams = todaysDealsApiParams({
    page: parsePage(search.get('page')),
    sort: search.get('sort') || TODAYS_DEALS_DEFAULT_SORT,
  });
  const body = await apiGetSafe('/products/offers', { params: apiParams });
  if (!body?.data) return { result: null, seedKey: null };
  return {
    result: { data: body.data, pagination: body.pagination ?? null, meta: body.meta ?? null },
    seedKey: paramsKey(apiParams),
  };
}

// Deals and their countdown change during the day — keep CDN caching short.
export const headers = () => ({ 'Cache-Control': 'public, max-age=0, s-maxage=30, stale-while-revalidate=60' });

export const shouldRevalidate = ({ currentUrl, nextUrl }) => currentUrl.pathname !== nextUrl.pathname;

export function meta({ data: loaderData, matches, location }) {
  const lang = metaLang(location);
  const { settings, siteUrl } = getRootData(matches) || {};
  const { path, page, noindex } = listingSeo(location);
  const listName = pickLang(lang, 'عروض اليوم', "Today's deals");
  const store = storeName(settings, lang);
  return buildMeta({
    matches,
    location,
    path,
    title: `${listName}${page > 1 ? ` - ${pickLang(lang, 'صفحة', 'Page')} ${page}` : ''}`,
    description: lang === 'en'
      ? `Limited-time discounts, today only at ${store} — grab them before they end.`
      : `خصومات لفترة محدودة اليوم فقط في ${store} — الحق العروض قبل انتهائها.`,
    noindex,
    jsonLd: [productListJsonLd(loaderData?.result?.data, { siteUrl, name: listName, lang })],
  });
}
