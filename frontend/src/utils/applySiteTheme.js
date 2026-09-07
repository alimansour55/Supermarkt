import {
  DEFAULT_THEME_COLOR,
  DEFAULT_THEME_SHADE,
  getThemeColors,
  resolveThemeColor,
  resolveThemeShade,
  THEME_SHADES,
} from '../constants/siteThemes';

let previewTheme = null;
let previewShade = null;
let activeTheme = { key: DEFAULT_THEME_COLOR, shade: DEFAULT_THEME_SHADE };

function paintTheme(themeKey, themeShade = DEFAULT_THEME_SHADE) {
  const key = resolveThemeColor(themeKey);
  const shade = resolveThemeShade(themeShade);
  const colors = getThemeColors(key, shade);
  const root = document.documentElement;

  THEME_SHADES.forEach((level) => {
    const hex = colors[level];
    if (hex) root.style.setProperty(`--color-primary-${level}`, hex);
  });

  root.dataset.siteTheme = key;
  root.dataset.siteThemeShade = String(shade);
  activeTheme = { key, shade };
  return { key, shade };
}

export function getActiveSiteTheme() {
  return { ...activeTheme };
}

/** Apply primary palette CSS variables — updates header, buttons, links, badges, etc. */
export function applySiteTheme(themeKey, { preview = false, themeShade = DEFAULT_THEME_SHADE } = {}) {
  const applied = paintTheme(themeKey, themeShade);
  if (preview) {
    previewTheme = applied.key;
    previewShade = applied.shade;
  } else {
    previewTheme = null;
    previewShade = null;
  }
  return applied.key;
}

export function clearThemePreview(fallbackTheme = DEFAULT_THEME_COLOR, fallbackShade = DEFAULT_THEME_SHADE) {
  previewTheme = null;
  previewShade = null;
  return paintTheme(fallbackTheme, fallbackShade).key;
}

export function isThemePreviewActive() {
  return previewTheme !== null;
}

export function getPreviewTheme() {
  return previewTheme;
}

export function getPreviewThemeShade() {
  return previewShade;
}

/** Skip applying saved settings while admin is previewing another palette. */
export function shouldApplyCommittedTheme(themeKey, themeShade = DEFAULT_THEME_SHADE) {
  if (!isThemePreviewActive()) return true;
  return resolveThemeColor(themeKey) === previewTheme
    && resolveThemeShade(themeShade) === previewShade;
}
