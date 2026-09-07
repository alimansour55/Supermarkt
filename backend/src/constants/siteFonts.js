export const DEFAULT_SITE_FONT = 'cairo';

export const SITE_FONT_KEYS = [
  'cairo',
  'tajawal',
  'almarai',
  'noto-sans-arabic',
  'ibm-plex-sans-arabic',
  'readex-pro',
  'changa',
  'el-messiri',
  'rubik',
  'harmattan',
  'reem-kufi',
  'alexandria',
  'amiri',
  'lateef',
  'markazi-text',
];

export function isValidSiteFont(value) {
  return SITE_FONT_KEYS.includes(String(value || '').trim());
}
