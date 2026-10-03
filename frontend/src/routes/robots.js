/**
 * /robots.txt — keeps crawlers out of private/interactive areas and points at the sitemap.
 * When the admin turns off "allow search engines" (SEO settings), the whole site is disallowed.
 */
import { apiGetSafe } from '../server/api.server';
import { resolveSiteUrl } from '../server/site.server';

const PRIVATE_PATHS = [
  '/admin',
  '/driver',
  '/api/',
  '/*/cart',
  '/*/checkout',
  '/*/payment',
  '/*/login',
  '/*/register',
  '/*/verify-email',
  '/*/forgot-password',
  '/*/reset-password',
  '/*/orders',
  '/*/profile',
  '/*/account',
  '/*/my-',
  '/*/favorites',
  '/*/recurring-deliveries',
  '/*/search',
  '/*/track-order',
];

export async function loader({ request }) {
  const siteUrl = resolveSiteUrl(request);
  const settingsBody = await apiGetSafe('/store-settings', { cached: true, ttlMs: 60_000 });
  const indexable = settingsBody?.data?.seo?.robotsIndex !== false;

  const lines = indexable
    ? ['User-agent: *', 'Allow: /', ...PRIVATE_PATHS.map((path) => `Disallow: ${path}`)]
    : ['User-agent: *', 'Disallow: /'];
  lines.push('', `Sitemap: ${siteUrl}/sitemap.xml`, '');

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
