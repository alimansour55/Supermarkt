/**
 * /sitemaps/pages.xml, /sitemaps/categories.xml, /sitemaps/products-N.xml
 */
import { apiGetSafe } from '../server/api.server';
import { resolveSiteUrl } from '../server/site.server';
import { PRODUCTS_PER_SITEMAP, urlsetXml, xmlResponse } from '../server/sitemap.server';

/** Indexable top-level storefront pages (content pages are added from the CMS). */
const STATIC_PATHS = ['/', '/categories', '/subcategories', '/brands', '/products', '/offers', '/today-deals'];

async function pageEntries() {
  const body = await apiGetSafe('/content-pages', { cached: true, ttlMs: 600_000 });
  const contentPages = (body?.data || [])
    .filter((page) => page?.slug && page.isActive !== false)
    .map((page) => ({ path: `/${page.slug}`, lastmod: page.updatedAt }));
  return [...STATIC_PATHS.map((path) => ({ path })), ...contentPages];
}

async function categoryEntries() {
  const body = await apiGetSafe('/sitemap/categories', { cached: true, ttlMs: 600_000 });
  return (body?.data || []).map((cat) => ({ path: `/category/${cat.slugPath}`, lastmod: cat.updatedAt }));
}

async function productEntries(page) {
  const body = await apiGetSafe('/sitemap/products', {
    params: { page, limit: PRODUCTS_PER_SITEMAP },
    cached: true,
    ttlMs: 600_000,
  });
  if (!body) return null;
  return (body.data || []).map((product) => ({
    path: `/products/${product.slug}`,
    lastmod: product.updatedAt,
    images: product.image ? [product.image] : [],
  }));
}

export async function loader({ params, request }) {
  const siteUrl = resolveSiteUrl(request);
  const name = params.name || '';

  let entries = null;
  if (name === 'pages.xml') entries = await pageEntries();
  else if (name === 'categories.xml') entries = await categoryEntries();
  else {
    const match = name.match(/^products-(\d+)\.xml$/);
    if (match) entries = await productEntries(Number(match[1]));
  }

  if (!entries) {
    return new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain' } });
  }
  return xmlResponse(urlsetXml(siteUrl, entries));
}
