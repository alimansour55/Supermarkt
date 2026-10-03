/**
 * Public site origin used for canonical URLs, sitemaps and Open Graph tags.
 * Set SITE_URL in production (e.g. https://www.example.com); falls back to the request origin.
 */
export function resolveSiteUrl(request) {
  const fromEnv = process.env.SITE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  try {
    return new URL(request.url).origin;
  } catch {
    return '';
  }
}

/** Cache-Control for public, non-personal HTML (safe for a CDN to cache briefly). */
export const PUBLIC_PAGE_CACHE = 'public, max-age=0, s-maxage=60, stale-while-revalidate=300';

/** True while prerendering the static Capacitor build (BUILD_TARGET=spa). */
export function isSpaBuild() {
  return process.env.BUILD_TARGET === 'spa';
}
