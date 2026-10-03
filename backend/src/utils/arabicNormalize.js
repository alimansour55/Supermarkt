/**
 * Fold text into a canonical search form so spelling variants match each other:
 * أ/إ/آ → ا, ى → ي, ة → ه, ؤ → و, ئ → ي, Arabic-Indic digits → 0-9,
 * tashkeel and tatweel removed, Latin lower-cased, whitespace collapsed.
 *
 * The same function runs on indexed product text and on the shopper's query.
 */
const ARABIC_DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭ]/g;
const TATWEEL = /ـ/g;

const LETTER_MAP = {
  'أ': 'ا',
  'إ': 'ا',
  'آ': 'ا',
  'ٱ': 'ا',
  'ى': 'ي',
  'ة': 'ه',
  'ؤ': 'و',
  'ئ': 'ي',
};

const DIGIT_MAP = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
  '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
};

const FOLD_CHARS = new RegExp(`[${Object.keys(LETTER_MAP).join('')}${Object.keys(DIGIT_MAP).join('')}]`, 'g');

export function normalizeSearchText(value) {
  if (value == null) return '';
  return String(value)
    .normalize('NFKC')
    .replace(ARABIC_DIACRITICS, '')
    .replace(TATWEEL, '')
    .replace(FOLD_CHARS, (ch) => LETTER_MAP[ch] || DIGIT_MAP[ch] || ch)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
