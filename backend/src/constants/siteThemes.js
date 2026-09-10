export const DEFAULT_THEME_COLOR = 'hyperone';
export const DEFAULT_THEME_SHADE = 600;

export const THEME_SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];

export const SITE_THEME_KEYS = [
  'hyperone',
  'green',
  'teal',
  'blue',
  'sky',
  'indigo',
  'purple',
  'rose',
  'orange',
  'amber',
  'cyan',
  'pink',
  'fuchsia',
  'red',
  'lime',
  'violet',
  'navy',
  'coral',
  'wine',
  'chocolate',
  'bronze',
];

export function isValidThemeColor(value) {
  return SITE_THEME_KEYS.includes(String(value || '').trim());
}

export function resolveThemeColor(themeKey) {
  const key = String(themeKey || '').trim();
  return isValidThemeColor(key) ? key : DEFAULT_THEME_COLOR;
}

export function resolveThemeShade(value) {
  const n = Number(value);
  return THEME_SHADES.includes(n) ? n : DEFAULT_THEME_SHADE;
}

export function isValidThemeShade(value) {
  return THEME_SHADES.includes(Number(value));
}
