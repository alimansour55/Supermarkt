/**
 * /sitemap.xml — sitemap index pointing at the page, category and product sitemaps.
 */
import { apiGetSafe } from '../server/api.server';
import { resolveSiteUrl } from '../server/site.server';
import { PRODUCTS_PER_SITEMAP, sitemapIndexXml, xmlResponse } from '../server/sitemap.server';

export async function loader({ request }) {
  const siteUrl = resolveSiteUrl(request);
  const countBody = await apiGetSafe('/sitemap/products', {
    params: { limit: 1 },
    cached: true,
    ttlMs: 600_000,
  });
  const total = countBody?.pagination?.total ?? 0;
  const productFiles = Math.max(1, Math.ceil(total / PRODUCTS_PER_SITEMAP));

  return xmlResponse(sitemapIndexXml(siteUrl, [
    { path: '/sitemaps/pages.xml' },
    { path: '/sitemaps/categories.xml' },
    ...Array.from({ length: productFiles }, (_, index) => ({ path: `/sitemaps/products-${index + 1}.xml` })),
  ]));
}
