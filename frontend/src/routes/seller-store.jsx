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

export async function loader({ params }) {
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

  const productsBody = await apiGetSafe('/products', { params: { seller: slug, sort: 'best-selling', limit: 24 } });
  return {
    seller,
    products: productsBody?.data || null,
    pages: productsBody?.pagination?.pages || 1,
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
