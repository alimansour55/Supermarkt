/**
 * XML sitemap helpers (server-only).
 * Each logical page is listed once per language, with hreflang alternates and
 * optional image entries — https://developers.google.com/search/docs/specialty/international/localized-versions#sitemap
 */
import { DEFAULT_LANG, SUPPORTED_LANGS, localizedPath } from '../i18n/routing';

/** Products per sitemap file (×2 languages = URLs per file; limit is 50,000). */
export const PRODUCTS_PER_SITEMAP = 10000;

export const SITEMAP_CACHE = 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400';

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function isoDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
}

/**
 * @param {string} siteUrl
 * @param {{ path: string, lastmod?: string|Date, images?: string[] }} entry — logical path
 */
function urlEntries(siteUrl, { path, lastmod, images = [] }) {
  const href = (lang) => `${siteUrl}${localizedPath(lang, path)}`;
  const alternates = [
    ...SUPPORTED_LANGS.map((lang) => `<xhtml:link rel="alternate" hreflang="${lang}" href="${escapeXml(href(lang))}"/>`),
    `<xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(href(DEFAULT_LANG))}"/>`,
  ].join('');
  const modified = isoDate(lastmod);
  const imageTags = images
    .filter(Boolean)
    .slice(0, 5)
    .map((src) => `<image:image><image:loc>${escapeXml(src)}</image:loc></image:image>`)
    .join('');

  return SUPPORTED_LANGS.map((lang) => [
    '<url>',
    `<loc>${escapeXml(href(lang))}</loc>`,
    modified ? `<lastmod>${modified}</lastmod>` : '',
    alternates,
    imageTags,
    '</url>',
  ].join('')).join('\n');
}

export function urlsetXml(siteUrl, entries) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'
      + ' xmlns:xhtml="http://www.w3.org/1999/xhtml"'
      + ' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    ...entries.map((entry) => urlEntries(siteUrl, entry)),
    '</urlset>',
  ].join('\n');
}

/** @param {{ path: string, lastmod?: string|Date }[]} sitemaps — site-relative paths */
export function sitemapIndexXml(siteUrl, sitemaps) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...sitemaps.map(({ path, lastmod }) => {
      const modified = isoDate(lastmod);
      return `<sitemap><loc>${escapeXml(`${siteUrl}${path}`)}</loc>${modified ? `<lastmod>${modified}</lastmod>` : ''}</sitemap>`;
    }),
    '</sitemapindex>',
  ].join('\n');
}

export function xmlResponse(xml, status = 200) {
  return new Response(xml, {
    status,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': SITEMAP_CACHE,
    },
  });
}
