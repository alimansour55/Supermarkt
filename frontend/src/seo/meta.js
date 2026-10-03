/**
 * SEO helpers shared by route `meta()` exports.
 * Everything here is pure (runs on the server and in the browser).
 *
 * Paths passed to these helpers are *logical* (unprefixed) app paths such as
 * '/products/rice'; the language prefix (/ar, /en) is added here.
 */
import {
  DEFAULT_LANG,
  SUPPORTED_LANGS,
  langFromPath,
  localizedPath,
  stripLang,
} from '../i18n/routing';

export { DEFAULT_LANG };
const OG_LOCALES = { ar: 'ar_EG', en: 'en_US' };
const DESCRIPTION_MAX = 160;

/** Language of the page a meta() function is building for. */
export function metaLang(location) {
  return langFromPath(location?.pathname) || DEFAULT_LANG;
}

/** Root loader data ({ siteUrl, settings, categoryTree }) from a meta() `matches` array. */
export function getRootData(matches) {
  const root = matches?.find((match) => match?.id === 'root');
  return root?.loaderData ?? root?.data ?? null;
}

export function absoluteUrl(siteUrl, path = '/') {
  if (!path) return siteUrl || '';
  if (/^https?:\/\//i.test(path)) return path;
  const base = String(siteUrl || '').replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Absolute URL of a logical app path in a given language. */
export function pageUrl(siteUrl, lang, path = '/') {
  return absoluteUrl(siteUrl, localizedPath(lang, path));
}

/** Usable absolute image URL, or null for emoji/placeholder images. */
export function absoluteImage(siteUrl, src) {
  if (typeof src !== 'string' || !src) return null;
  if (/^https?:\/\//i.test(src)) return src;
  if (src.startsWith('/')) return absoluteUrl(siteUrl, src);
  return null;
}

/** Strip tags/whitespace and cut to a search-snippet friendly length. */
export function plainText(value, max = DESCRIPTION_MAX) {
  const text = String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

export function pickLang(lang, ar, en) {
  return lang === 'en' ? (en || ar || '') : (ar || en || '');
}

export function storeName(settings, lang = DEFAULT_LANG) {
  return pickLang(lang, settings?.storeNameAr, settings?.storeNameEn) || 'MarketPlus';
}

export function defaultSeo(settings, lang = DEFAULT_LANG) {
  const seo = settings?.seo || {};
  return {
    title: pickLang(lang, seo.defaultTitleAr, seo.defaultTitleEn) || storeName(settings, lang),
    description: pickLang(lang, seo.defaultDescriptionAr, seo.defaultDescriptionEn)
      || pickLang(lang, settings?.taglineAr, settings?.taglineEn),
    image: seo.ogImageUrl || settings?.logoUrl || '',
    indexable: seo.robotsIndex !== false,
  };
}

/**
 * Build React Router meta descriptors: title, description, canonical, hreflang
 * alternates, robots, Open Graph, Twitter card and JSON-LD blocks.
 *
 * @param {object} options
 * @param {Array} options.matches      meta() matches (to read root settings/siteUrl)
 * @param {object} options.location    meta() location (decides the language)
 * @param {string} [options.path]      logical canonical path (default: current path without
 *                                     language prefix, no query string)
 * @param {string} [options.title]     page title (store name is appended)
 * @param {string} [options.description]
 * @param {string} [options.image]     OG image (absolute or site-relative)
 * @param {string} [options.type]      og:type (website, product…)
 * @param {boolean} [options.noindex]  keep the page out of search results
 * @param {object[]} [options.jsonLd]  structured-data objects
 */
export function buildMeta({
  matches,
  location,
  path,
  title,
  description,
  image,
  type = 'website',
  noindex = false,
  jsonLd = [],
} = {}) {
  const lang = metaLang(location);
  const root = getRootData(matches) || {};
  const { settings, siteUrl } = root;
  const defaults = defaultSeo(settings, lang);
  const name = storeName(settings, lang);
  const logicalPath = path ?? stripLang(location?.pathname || '/');

  const fullTitle = title
    ? (title.includes(name) ? title : `${title} | ${name}`)
    : defaults.title;
  const desc = plainText(description || defaults.description);
  const canonical = pageUrl(siteUrl, lang, logicalPath);
  const ogImage = absoluteImage(siteUrl, image) || absoluteImage(siteUrl, defaults.image);
  const indexable = defaults.indexable && !noindex;

  const alternates = indexable
    ? [
      ...SUPPORTED_LANGS.map((alt) => ({
        tagName: 'link', rel: 'alternate', hrefLang: alt, href: pageUrl(siteUrl, alt, logicalPath),
      })),
      { tagName: 'link', rel: 'alternate', hrefLang: 'x-default', href: pageUrl(siteUrl, DEFAULT_LANG, logicalPath) },
    ]
    : [];

  const tags = [
    { title: fullTitle },
    desc && { name: 'description', content: desc },
    { name: 'robots', content: indexable ? 'index, follow, max-image-preview:large' : 'noindex, nofollow' },
    indexable && { tagName: 'link', rel: 'canonical', href: canonical },
    ...alternates,
    { property: 'og:site_name', content: name },
    { property: 'og:type', content: type },
    { property: 'og:title', content: fullTitle },
    desc && { property: 'og:description', content: desc },
    { property: 'og:url', content: canonical },
    { property: 'og:locale', content: OG_LOCALES[lang] || OG_LOCALES.ar },
    ...SUPPORTED_LANGS
      .filter((alt) => alt !== lang)
      .map((alt) => ({ property: 'og:locale:alternate', content: OG_LOCALES[alt] })),
    ogImage && { property: 'og:image', content: ogImage },
    { name: 'twitter:card', content: ogImage ? 'summary_large_image' : 'summary' },
    { name: 'twitter:title', content: fullTitle },
    desc && { name: 'twitter:description', content: desc },
    ogImage && { name: 'twitter:image', content: ogImage },
    ...jsonLd.filter(Boolean).map((data) => ({ 'script:ld+json': data })),
  ];

  return tags.filter(Boolean);
}

/**
 * Canonical path + index policy for listing pages: the plain listing and its
 * ?page=N pages are indexable; filtered/sorted/search variants are noindex
 * (they duplicate the main listing). Returns a logical (unprefixed) path.
 */
export function listingSeo(location) {
  const params = new URLSearchParams(location?.search || '');
  const page = Number(params.get('page')) || 1;
  const otherKeys = [...params.keys()].filter((key) => key !== 'page' && params.get(key) !== '');
  const pathname = stripLang(location?.pathname || '/');
  const path = page > 1 ? `${pathname}?page=${page}` : pathname;
  return { path, page, noindex: otherKeys.length > 0 };
}

/** Localized "Home" breadcrumb label. */
export function homeLabel(lang) {
  return lang === 'en' ? 'Home' : 'الرئيسية';
}
