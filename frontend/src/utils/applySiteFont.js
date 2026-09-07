import { DEFAULT_SITE_FONT, getFont, resolveSiteFont } from '../constants/siteFonts';

const FONT_LINK_ID = 'site-font-link';
const PRELOAD_LINK_ID = 'site-font-preload';

let previewFont = null;

function buildGoogleFontsUrl(font) {
  return `https://fonts.googleapis.com/css2?family=${font.googleParam}&display=swap`;
}

function buildGoogleFontsUrlMulti(fontKeys) {
  const params = fontKeys
    .map((key) => getFont(key).googleParam)
    .join('&family=');
  return `https://fonts.googleapis.com/css2?family=${params}&display=swap`;
}

function paintFont(fontKey) {
  const font = getFont(fontKey);
  const root = document.documentElement;

  root.style.setProperty('--font-sans', `'${font.family}', system-ui, sans-serif`);
  root.dataset.siteFont = font.id;

  let link = document.getElementById(FONT_LINK_ID);
  if (!link) {
    link = document.createElement('link');
    link.id = FONT_LINK_ID;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }

  const nextHref = buildGoogleFontsUrl(font);
  if (link.getAttribute('href') !== nextHref) {
    link.setAttribute('href', nextHref);
  }

  return font.id;
}

/** Preload fonts for admin preview cards (does not change the active site font). */
export function preloadSiteFonts(fontKeys = []) {
  const unique = [...new Set(fontKeys.map(resolveSiteFont))];
  if (!unique.length) return;

  let link = document.getElementById(PRELOAD_LINK_ID);
  if (!link) {
    link = document.createElement('link');
    link.id = PRELOAD_LINK_ID;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }

  const nextHref = buildGoogleFontsUrlMulti(unique);
  if (link.getAttribute('href') !== nextHref) {
    link.setAttribute('href', nextHref);
  }
}

/** Apply site font via CSS variable and Google Fonts stylesheet. */
export function applySiteFont(fontKey, { preview = false } = {}) {
  const key = paintFont(fontKey);
  previewFont = preview ? key : null;
  return key;
}

export function clearFontPreview(fallbackFont = DEFAULT_SITE_FONT) {
  previewFont = null;
  return paintFont(fallbackFont);
}

export function isFontPreviewActive() {
  return previewFont !== null;
}

export function getPreviewFont() {
  return previewFont;
}

/** Skip applying saved settings while admin is previewing another font. */
export function shouldApplyCommittedFont(fontKey) {
  if (!isFontPreviewActive()) return true;
  return resolveSiteFont(fontKey) === previewFont;
}
