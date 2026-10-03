/**
 * Language-prefixed URLs: every storefront page lives under /ar/... (default) or /en/...
 * Admin, driver and API paths are not localized.
 */
export const SUPPORTED_LANGS = ['ar', 'en'];
export const DEFAULT_LANG = 'ar';

const UNLOCALIZED_PREFIXES = ['/admin', '/driver', '/api', '/uploads', '/assets'];
const UNLOCALIZED_FILES = /^\/[^/]+\.(xml|txt|ico|svg|png|webmanifest|json)$/i;

export function isSupportedLang(value) {
  return SUPPORTED_LANGS.includes(value);
}

/** 'ar' | 'en' from the first path segment, or null. */
export function langFromPath(pathname = '') {
  const segment = String(pathname).split('/')[1];
  return isSupportedLang(segment) ? segment : null;
}

/** '/en/products/x' → '/products/x'; '/ar' → '/'. Unprefixed paths are returned as-is. */
export function stripLang(pathname = '/') {
  const lang = langFromPath(pathname);
  if (!lang) return pathname || '/';
  const rest = pathname.slice(lang.length + 1);
  return rest.startsWith('/') ? rest : `/${rest}`;
}

/** Paths that never get a language prefix (admin, driver app, API, files). */
export function isUnlocalizedPath(path = '') {
  const pathname = String(path).split(/[?#]/)[0];
  if (UNLOCALIZED_FILES.test(pathname)) return true;
  return UNLOCALIZED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/**
 * Prefix an app-absolute path ('/products/x?y#z') with a language.
 * Relative paths, external URLs, already-localized and unlocalized paths are left alone.
 */
export function localizedPath(lang, path = '/') {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) return path;
  if (!isSupportedLang(lang) || isUnlocalizedPath(path) || langFromPath(path)) return path;
  if (path === '/') return `/${lang}`;
  if (path.startsWith('/?') || path.startsWith('/#')) return `/${lang}${path.slice(1)}`;
  return `/${lang}${path}`;
}

/** Same page in another language: '/ar/products/x' → '/en/products/x'. */
export function swapLang(pathname, lang) {
  return localizedPath(lang, stripLang(pathname));
}

/** Language of a server request's URL (default language when unprefixed). */
export function requestLang(request) {
  return langFromPath(new URL(request.url).pathname) || DEFAULT_LANG;
}
