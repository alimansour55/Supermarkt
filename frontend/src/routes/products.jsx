/**
 * /products — all products (filters/search via query string).
 */
import ProductListingPage from '../pages/ProductListingPage';
import { apiGetSafe } from '../server/api.server';
import { PUBLIC_PAGE_CACHE } from '../server/site.server';
import { buildMeta, getRootData, listingSeo, storeName } from '../seo/meta';
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
  const { settings, siteUrl } = getRootData(matches) || {};
  const { path, page, noindex } = listingSeo(location);
  const q = new URLSearchParams(location.search).get('q');
  const title = q ? `نتائج البحث: ${q}` : `كل المنتجات${page > 1 ? ` - صفحة ${page}` : ''}`;
  return buildMeta({
    matches,
    path,
    title,
    description: `تسوق كل منتجات ${storeName(settings)} أونلاين: بقالة ومنظفات وعناية شخصية مع توصيل سريع.`,
    noindex,
    jsonLd: [productListJsonLd(loaderData?.result?.data, { siteUrl, name: 'كل المنتجات' })],
  });
}
