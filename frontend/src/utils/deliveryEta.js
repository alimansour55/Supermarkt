const ARABIC_LETTERS = /[اأإآء-ي]/;

/**
 * Turn an admin-typed delivery estimate into Arabic.
 * Zones store free text (often English, e.g. "within 2 hours" or "4-6 hours"),
 * so the Arabic storefront needs it translated before display.
 * Returns the Arabic phrase (e.g. "خلال ساعتين"), the text unchanged when it is
 * already Arabic, or null when the pattern isn't recognised.
 * @param {string} raw
 * @returns {string|null}
 */
export function arabicEtaPhrase(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;
  if (ARABIC_LETTERS.test(text)) return text;

  const normalized = text.toLowerCase().replace(/\s+/g, ' ');
  const range = normalized.match(/(\d+\s*[-–]\s*\d+)\s*hours?/);
  if (range) return `خلال ${range[1].replace(/\s+/g, '')} ساعات`;

  const within = normalized.match(/(?:within\s+)?(\d+)\s*hours?/);
  if (within) {
    const h = Number(within[1]);
    if (h === 1) return 'خلال ساعة';
    if (h === 2) return 'خلال ساعتين';
    return `خلال ${h} ${h <= 10 ? 'ساعات' : 'ساعة'}`;
  }

  const minutes = normalized.match(/(?:within\s+)?(\d+)\s*(?:min|mins|minutes?)\b/);
  if (minutes) return `خلال ${minutes[1]} دقيقة`;

  if (/same[- ]day/.test(normalized)) return 'في نفس اليوم';
  if (/next[- ]day|tomorrow/.test(normalized)) return 'في اليوم التالي';
  return null;
}

/**
 * Display text for a zone's delivery estimate in the active language.
 * Unrecognised English text falls back to `fallbackAr` (or the raw text when none).
 */
export function localizeEta(raw, isAr, fallbackAr) {
  const text = String(raw || '').trim();
  if (!isAr) return text;
  return arabicEtaPhrase(text) || fallbackAr || text;
}
