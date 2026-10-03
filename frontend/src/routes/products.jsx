/**
 * /:lang/products — all products (filters/search via query string).
 */
import ProductListingPage from '../pages/ProductListingPage';
import { apiGetSafe } from '../server/api.server';
import { PUBLIC_PAGE_CACHE } from '../server/site.server';
import { buildMeta, getRootData, listingSeo, metaLang, pickLang, storeName } from '../seo/meta';
import { productListJsonLd } from '../seo/jsonLd';
import { paramsKey, productListingApiParams } from '../utils/listingParams';

export default ProductListingPage;

export async function loader({ request }) {
  const apiParams = productListingApiParams(new URL(request.url).searchParams);
  const body = await apiGetSafe('/products', { params: apiParams });
  if (!body?.data) return { result: null, seedKey: null };
  return {
    result: { data: body.data, pagination: body.pagination ?? null },
    seedKey: paramsKey(apiParams),
  };
}

export const headers = () => ({ 'Cache-Control': PUBLIC_PAGE_CACHE });

// Filter/sort changes are fetched by the page itself.
export const shouldRevalidate = ({ currentUrl, nextUrl }) => currentUrl.pathname !== nextUrl.pathname;

export function meta({ data: loaderData, matches, location }) {
  const lang = metaLang(location);
  const { settings, siteUrl } = getRootData(matches) || {};
  const { path, page, noindex } = listingSeo(location);
  const q = new URLSearchParams(location.search).get('q');
  const listName = pickLang(lang, 'كل المنتجات', 'All products');
  const title = q
    ? `${pickLang(lang, 'نتائج البحث', 'Search results')}: ${q}`
    : `${listName}${page > 1 ? ` - ${pickLang(lang, 'صفحة', 'Page')} ${page}` : ''}`;
  const store = storeName(settings, lang);
  return buildMeta({
    matches,
    location,
    path,
    title,
    description: lang === 'en'
      ? `Shop all ${store} products online: groceries, cleaning and personal care with fast delivery.`
      : `تسوق كل منتجات ${store} أونلاين: بقالة ومنظفات وعناية شخصية مع توصيل سريع.`,
    noindex,
    jsonLd: [productListJsonLd(loaderData?.result?.data, { siteUrl, name: listName, lang })],
  });
}
