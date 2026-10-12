/**
 * /:lang/sellers/:slug — server-rendered marketplace seller store page.
 */
import { data } from 'react-router';
import SellerStorefrontPage from '../pages/SellerStorefrontPage';
import { apiGet, apiGetSafe } from '../server/api.server';
import { PUBLIC_PAGE_CACHE } from '../server/site.server';
import { buildMeta, getRootData, homeLabel, metaLang, pickLang, plainText, storeName } from '../seo/meta';
import { breadcrumbJsonLd } from '../seo/jsonLd';

export default SellerStorefrontPage;

export async function loader({ params, request }) {
  const slug = params.slug;
  let body;
  try {
    body = await apiGet(`/sellers/${encodeURIComponent(slug)}`);
  } catch (error) {
    // API unavailable: the page loads the seller in the browser instead of erroring.
    console.error(`[ssr] seller ${slug}: ${error.message}`);
    return data({ seller: null }, { headers: { 'Cache-Control': 'no-store' } });
  }
  const seller = body?.data;
  if (!seller) return data({ seller: null, notFound: true }, { status: 404 });

  // Same filters the page reads from the URL, so a shared filtered link renders filtered.
  const url = new URL(request.url);
  const pick = (k) => url.searchParams.get(k) || undefined;
  const [productsBody, sectionsBody] = await Promise.all([
    apiGetSafe('/products', {
      params: {
        seller: slug,
        sort: pick('sort') || 'best-selling',
        page: pick('page'),
        limit: 24,
        sellerCategory: pick('section'),
        q: pick('q'),
        minPrice: pick('minPrice'),
        maxPrice: pick('maxPrice'),
        inStock: pick('inStock'),
      },
    }),
    apiGetSafe(`/sellers/${encodeURIComponent(slug)}/categories`),
  ]);
  return {
    seller,
    products: productsBody?.data || null,
    pages: productsBody?.pagination?.pages || 1,
    total: productsBody?.pagination?.total ?? null,
    sections: sectionsBody?.data || [],
  };
}

export function headers({ loaderHeaders }) {
  return { 'Cache-Control': loaderHeaders.get('Cache-Control') || PUBLIC_PAGE_CACHE };
}

export function meta({ data: loaderData, matches, location }) {
  const lang = metaLang(location);
  const seller = loaderData?.seller;
  if (!seller) return buildMeta({ matches, location, title: pickLang(lang, 'المتجر غير متاح', 'Store not available'), noindex: true });
  const { settings, siteUrl } = getRootData(matches) || {};
  const name = pickLang(lang, seller.nameAr || seller.nameEn, seller.nameEn || seller.nameAr);
  const about = pickLang(lang, seller.descriptionAr, seller.descriptionEn);
  const path = `/sellers/${seller.slug}`;
  return buildMeta({
    matches,
    location,
    path,
    title: name,
    image: seller.bannerUrl || seller.logoUrl || undefined,
    description: plainText(about) || (lang === 'en'
      ? `Shop ${name} on ${storeName(settings, lang)} — ${seller.productCount} products, delivered to your door.`
      : `تسوق من ${name} على ${storeName(settings, lang)} — ${seller.productCount} منتج يصلك حتى باب بيتك.`),
    jsonLd: [breadcrumbJsonLd([{ name: homeLabel(lang), path: '/' }, { name, path }], siteUrl, lang)],
  });
}
