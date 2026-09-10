import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = path.join(__dirname, '../../assets/fonts');

/**
 * One PDF text font for both scripts. IBM Plex Sans Arabic covers Latin, digits,
 * punctuation, symbols and full Arabic shaping (contextual joining via the font's
 * OpenType `arab` shaper, which PDFKit/fontkit applies automatically).
 *
 * We do NOT pre-reshape or run a BiDi pass. Instead each visual line is split into
 * single-direction runs (`segmentRuns`) and the caller positions each run with
 * `lineBreak:false` — PDFKit renders a pure Arabic or pure Latin run perfectly on
 * its own; it only mishandles direction changes inside one `text()` call.
 */
export const PDF_FONT_PATH = path.join(FONTS_DIR, 'IBMPlexSansArabic-Regular.ttf');
export const PDF_FONT_BOLD_PATH = path.join(FONTS_DIR, 'IBMPlexSansArabic-Bold.ttf');
export const ARABIC_FONT_PATH = PDF_FONT_PATH; // back-compat alias

const ARABIC_RE = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
const STRONG_LTR_RE = /[A-Za-zÀ-ɏ]/;
const DIGIT_RE = /[0-9٠-٩]/;

let fontBuffer = null;
let boldFontBuffer = null;

export function getPdfFontBuffer() {
  if (fontBuffer) return fontBuffer;
  if (!fs.existsSync(PDF_FONT_PATH)) {
    throw new Error(`PDF font missing at ${PDF_FONT_PATH}`);
  }
  fontBuffer = fs.readFileSync(PDF_FONT_PATH);
  return fontBuffer;
}

export function getPdfBoldFontBuffer() {
  if (boldFontBuffer) return boldFontBuffer;
  boldFontBuffer = fs.existsSync(PDF_FONT_BOLD_PATH)
    ? fs.readFileSync(PDF_FONT_BOLD_PATH)
    : getPdfFontBuffer();
  return boldFontBuffer;
}

// Back-compat aliases (older imports).
export const getArabicFontBuffer = getPdfFontBuffer;
export const getArabicBoldFontBuffer = getPdfBoldFontBuffer;

export function containsArabic(text) {
  return ARABIC_RE.test(String(text || ''));
}

/**
 * Split a logical string into consecutive single-direction runs.
 * Strong Arabic letters → rtl run; strong Latin letters → ltr run; digits lean
 * ltr; weak characters (spaces, punctuation, symbols) attach to the run in
 * progress (or the base direction at the start).
 *
 * Returns `{ baseRtl, runs: [{ rtl, text }] }` in LOGICAL order. Callers that
 * need visual order reverse `runs` when `baseRtl` is true.
 */
export function segmentRuns(input, baseRtlHint) {
  const str = String(input ?? '');
  const baseRtl = baseRtlHint == null ? containsArabic(str) : !!baseRtlHint;
  const runs = [];
  let cur = null;

  for (const ch of str) {
    let dir;
    if (ARABIC_RE.test(ch)) dir = 'r';
    else if (STRONG_LTR_RE.test(ch)) dir = 'l';
    else if (DIGIT_RE.test(ch)) dir = 'l';
    else dir = null; // weak — stick to current run

    if (dir === null) {
      if (cur) { cur.text += ch; continue; }
      cur = { rtl: baseRtl, text: ch };
      continue;
    }
    const rtl = dir === 'r';
    if (cur && cur.rtl === rtl) cur.text += ch;
    else {
      if (cur) runs.push(cur);
      cur = { rtl, text: ch };
    }
  }
  if (cur) runs.push(cur);

  // Trim a run that is only whitespace onto its neighbour to avoid stray gaps.
  return { baseRtl, runs: runs.length ? runs : [{ rtl: baseRtl, text: '' }] };
}

export function formatPdfDate(date, isAr) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  if (isAr) return `${day}/${month}/${year} - ${hours}:${minutes}`;
  return d.toLocaleString('en-GB', {
    year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

/* ---- Back-compat no-op-ish exports (old callers) ---- */
export function prepareLine(text) {
  return { text: String(text ?? ''), rtl: containsArabic(text) };
}
export function prepareArabicLine(text) { return String(text ?? ''); }
export function prepareLatinLine(text) { return String(text ?? ''); }
