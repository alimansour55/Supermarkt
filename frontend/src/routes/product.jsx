/**
 * /products/:slug — server-rendered product page with Product + Breadcrumb structured data.
 */
import { data, redirect } from 'react-router';
import ProductDetailsPage from '../pages/ProductDetailsPage';
import { apiGet, apiGetSafe } from '../server/api.server';
import { PUBLIC_PAGE_CACHE } from '../server/site.server';
import { buildMeta, getRootData, pickLang, plainText, storeName } from '../seo/meta';
import { breadcrumbJsonLd, productJsonLd } from '../seo/jsonLd';
import { buildCategoryPath } from '../utils/categoryHelpers';
import { formatPrice } from '../utils/formatters';

export default ProductDetailsPage;

export async function loader({ params }) {
  const slug = params.slug;
  let body;
  try {
    body = await apiGet(`/products/${encodeURIComponent(slug)}`);
  } catch (error) {
    // API unavailable: let the page load the product in the browser instead of erroring.
    console.error(`[ssr] product ${slug}: ${error.message}`);
    return data({ product: null, categoryChain: [] }, { headers: { 'Cache-Control': 'no-store' } });
  }

  const product = body?.data;
  if (!product || product.isActive === false) {
    return data({ product: null, categoryChain: [], notFound: true }, { status: 404 });
  }

  // Requested by id or an old slug → one canonical URL per product.
  if (product.slug && product.slug !== slug) {
    throw redirect(`/products/${product.slug}`, 301);
  }

  const categorySlug = product.categorySlug || product.category;
  const pathBody = categorySlug
    ? await apiGetSafe(`/categories/path/${encodeURIComponent(categorySlug)}`, { cached: true })
    : null;

  return {
    product,
    categoryChain: pathBody?.chain || [],
    categorySlugPath: pathBody?.slugPath || '',
  };
}

export function headers({ loaderHeaders }) {
  return {
    'Cache-Control': loaderHeaders.get('Cache-Control') || PUBLIC_PAGE_CACHE,
  };
}

// Same product, only the query string changed (e.g. ?variant=) — keep the loaded data.
export function shouldRevalidate({ currentParams, nextParams }) {
  return currentParams.slug !== nextParams.slug;
}

export function meta({ data: loaderData, matches, params }) {
  const lang = 'ar';
  const path = `/products/${params.slug}`;
  const product = loaderData?.product;

  if (!product) {
    return buildMeta({
      matches,
      path,
      lang,
      noindex: true,
      title: loaderData?.notFound ? 'المنتج غير موجود' : undefined,
    });
  }

  const { settings, siteUrl } = getRootData(matches) || {};
  const name = pickLang(lang, product.nameAr || product.name, product.nameEn);
  const brand = pickLang(lang, product.brandAr || product.brand, product.brandEn || product.brand);
  const price = formatPrice(product.price, lang, settings?.currency || 'EGP');
  const description = plainText(
    pickLang(lang, product.descriptionAr || product.description, product.descriptionEn),
  ) || `اشترِ ${name}${brand ? ` من ${brand}` : ''} بسعر ${price} من ${storeName(settings, lang)} مع توصيل سريع.`;

  const chain = loaderData.categoryChain || [];
  const crumbs = [
    { name: lang === 'ar' ? 'الرئيسية' : 'Home', path: '/' },
    ...chain.map((cat, index) => ({
      name: pickLang(lang, cat.nameAr || cat.name, cat.nameEn),
      path: buildCategoryPath(chain.slice(0, index + 1).map((c) => c.slug).join('/')),
    })),
    { name, path },
  ];

  return buildMeta({
    matches,
    lang,
    path,
    type: 'product',
    title: brand && !name.toLowerCase().includes(brand.toLowerCase()) ? `${name} - ${brand}` : name,
    description,
    image: product.images?.find((src) => /^https?:\/\//.test(src)) || product.image,
    jsonLd: [
      productJsonLd(product, { siteUrl, settings, lang, path }),
      breadcrumbJsonLd(crumbs, siteUrl),
    ],
  });
}
