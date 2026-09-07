import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { ArabicShaper } = require('arabic-persian-reshaper');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ARABIC_FONT_PATH = path.join(__dirname, '../../assets/fonts/NotoSansArabic-Regular.ttf');

const ARABIC_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

let arabicFontBuffer = null;

export function getArabicFontBuffer() {
  if (arabicFontBuffer) return arabicFontBuffer;
  if (!fs.existsSync(ARABIC_FONT_PATH)) {
    throw new Error(`Arabic PDF font missing at ${ARABIC_FONT_PATH}`);
  }
  arabicFontBuffer = fs.readFileSync(ARABIC_FONT_PATH);
  return arabicFontBuffer;
}

export function containsArabic(text) {
  return ARABIC_RE.test(String(text || ''));
}

function shapeArabicRun(text) {
  return ArabicShaper.convertArabic(String(text));
}

/** Reshape Arabic segments only; keep Latin/numbers intact for PDFKit. */
export function shapeArabic(text) {
  const raw = String(text ?? '');
  if (!raw || !containsArabic(raw)) return raw;

  let result = '';
  let current = '';
  let currentArabic = null;

  for (const char of raw) {
    const isArabic = containsArabic(char);
    if (currentArabic === null) {
      currentArabic = isArabic;
      current = char;
      continue;
    }
    if (isArabic === currentArabic) {
      current += char;
    } else {
      result += currentArabic ? shapeArabicRun(current) : current;
      current = char;
      currentArabic = isArabic;
    }
  }

  if (current) result += currentArabic ? shapeArabicRun(current) : current;
  return result;
}

export function formatPdfDate(date, isAr) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  if (isAr) return `${day}/${month}/${year} ${hours}:${minutes}`;
  return d.toLocaleString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Prepare Arabic for PDFKit: connect letters only.
 * PDFKit lays out glyphs left-to-right; right/center alignment handles RTL positioning.
 */
export function prepareArabicLine(text) {
  const raw = String(text ?? '');
  if (!raw) return '';
  if (!containsArabic(raw)) return raw;
  return shapeArabic(raw);
}

export function prepareLatinLine(text) {
  return String(text ?? '');
}

export function prepareAutoLine(text, preferRtl = false) {
  const raw = String(text ?? '');
  if (!raw) return { text: '', isAr: false };
  if (containsArabic(raw)) {
    return { text: prepareArabicLine(raw), isAr: true };
  }
  return { text: prepareLatinLine(raw), isAr: preferRtl };
}
