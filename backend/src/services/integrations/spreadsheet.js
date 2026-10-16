/**
 * Reads the files cashier systems export: CSV/TSV (any common separator, with or without
 * quotes, UTF-8 with or without BOM) and Excel .xlsx (first sheet). No outside libraries.
 */
import zlib from 'node:zlib';

// ── CSV ──────────────────────────────────────────────────────────────────────

export function detectDelimiter(text) {
  const sample = text.split(/\r?\n/).slice(0, 5).join('\n');
  const candidates = [',', ';', '\t', '|'];
  let best = ',';
  let bestCount = 0;
  for (const d of candidates) {
    let count = 0;
    let quoted = false;
    for (const ch of sample) {
      if (ch === '"') quoted = !quoted;
      else if (!quoted && ch === d) count += 1;
    }
    if (count > bestCount) { best = d; bestCount = count; }
  }
  return best;
}

export function parseCsv(input, delimiter = '') {
  const text = String(input).replace(/^﻿/, '');
  const d = delimiter || detectDelimiter(text);
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; } else quoted = false;
      } else field += ch;
    } else if (ch === '"' && field.trim() === '') { field = ''; quoted = true; }
    else if (ch === d) { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field); field = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows.map((r) => r.map((c) => c.trim()));
}

// ── XLSX (zip of XML files) ───────────────────────────────────────────────────

function unzipEntries(buf) {
  // Find the end-of-central-directory record.
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 66000); i -= 1) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('This is not a valid Excel file');
  const count = buf.readUInt16LE(eocd + 10);
  let ptr = buf.readUInt32LE(eocd + 16);
  const entries = new Map();
  for (let n = 0; n < count; n += 1) {
    if (buf.readUInt32LE(ptr) !== 0x02014b50) break;
    const method = buf.readUInt16LE(ptr + 10);
    const compSize = buf.readUInt32LE(ptr + 20);
    const nameLen = buf.readUInt16LE(ptr + 28);
    const extraLen = buf.readUInt16LE(ptr + 30);
    const commentLen = buf.readUInt16LE(ptr + 32);
    const localOffset = buf.readUInt32LE(ptr + 42);
    const name = buf.toString('utf8', ptr + 46, ptr + 46 + nameLen);
    entries.set(name, { method, compSize, localOffset });
    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return {
    names: [...entries.keys()],
    read(name) {
      const e = entries.get(name);
      if (!e) return null;
      const lnameLen = buf.readUInt16LE(e.localOffset + 26);
      const lextraLen = buf.readUInt16LE(e.localOffset + 28);
      const start = e.localOffset + 30 + lnameLen + lextraLen;
      const data = buf.subarray(start, start + e.compSize);
      if (e.method === 0) return data.toString('utf8');
      if (e.method === 8) return zlib.inflateRawSync(data).toString('utf8');
      throw new Error('Unsupported compression in Excel file');
    },
  };
}

const decodeXml = (s) => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&amp;/g, '&');

const textOf = (xml) => [...xml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => decodeXml(m[1])).join('');

function columnIndex(ref) {
  const letters = /^[A-Z]+/.exec(ref)?.[0] || 'A';
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export function parseXlsx(buffer) {
  const zip = unzipEntries(Buffer.from(buffer));
  const shared = [];
  const sst = zip.read('xl/sharedStrings.xml');
  if (sst) for (const m of sst.matchAll(/<si>([\s\S]*?)<\/si>/g)) shared.push(textOf(m[1]));

  const sheetName = zip.names
    .filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
    .sort((a, b) => Number(/(\d+)\.xml$/.exec(a)[1]) - Number(/(\d+)\.xml$/.exec(b)[1]))[0];
  if (!sheetName) throw new Error('The Excel file has no sheets');
  const sheet = zip.read(sheetName);

  const rows = [];
  for (const rowMatch of sheet.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const row = [];
    for (const c of rowMatch[1].matchAll(/<c([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1];
      const inner = c[2] || '';
      const ref = /\br="([A-Z]+)\d+"/.exec(attrs)?.[1];
      const type = /\bt="(\w+)"/.exec(attrs)?.[1];
      const v = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
      let value = '';
      if (type === 's') value = shared[Number(v)] ?? '';
      else if (type === 'inlineStr') value = textOf(inner);
      else if (v != null) value = decodeXml(v);
      const idx = ref ? columnIndex(ref) : row.length;
      while (row.length < idx) row.push('');
      row[idx] = String(value).trim();
    }
    if (row.some((cell) => cell !== '')) rows.push(row);
  }
  return rows;
}

/** CSV text or xlsx bytes → array of rows (first row = headers). */
export function readSpreadsheet(content, { filename = '', delimiter = '' } = {}) {
  const buf = Buffer.isBuffer(content) ? content : null;
  const isZip = buf && buf.length > 4 && buf.readUInt32LE(0) === 0x04034b50;
  if (isZip || /\.xlsx$/i.test(filename)) {
    if (!buf) throw new Error('Excel files must be uploaded as a file');
    return parseXlsx(buf);
  }
  if (/\.xls$/i.test(filename)) throw new Error('Old .xls files are not supported — save the file as .xlsx or .csv');
  return parseCsv(buf ? buf.toString('utf8') : content, delimiter);
}

// ── Column mapping ────────────────────────────────────────────────────────────

const GUESSES = {
  code: ['barcode', 'bar code', 'ean', 'upc', 'sku', 'code', 'item code', 'product code', 'item_code', 'الباركود', 'باركود', 'كود', 'الكود', 'كود الصنف', 'رقم الصنف'],
  quantity: ['quantity', 'qty', 'stock', 'on hand', 'onhand', 'in stock', 'available', 'balance', 'stock_on_hand', 'الكمية', 'كمية', 'الرصيد', 'رصيد', 'المخزون', 'الكمية المتاحة'],
  price: ['price', 'sale price', 'selling price', 'retail price', 'unit price', 'rate', 'سعر', 'السعر', 'سعر البيع', 'سعر القطاعي'],
  oldPrice: ['old price', 'compare at price', 'was price', 'original price', 'السعر قبل الخصم', 'السعر القديم'],
  costPrice: ['cost', 'cost price', 'purchase price', 'buy price', 'التكلفة', 'سعر التكلفة', 'سعر الشراء', 'سعر الجملة'],
  location: ['branch', 'store', 'location', 'warehouse', 'shop', 'الفرع', 'فرع', 'المخزن', 'المحل'],
};

const norm = (s) => String(s || '').toLowerCase().replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Best-effort guess of which header is which field. */
export function guessColumns(headers) {
  const out = {};
  const used = new Set();
  for (const [field, words] of Object.entries(GUESSES)) {
    const idx = headers.findIndex((h, i) => !used.has(i) && words.includes(norm(h)));
    const loose = idx >= 0 ? idx : headers.findIndex((h, i) => !used.has(i) && words.some((w) => norm(h).includes(w)));
    if (loose >= 0) { out[field] = headers[loose]; used.add(loose); }
  }
  return out;
}

/** A mapping value may be a header name, a column letter (A, B…) or a 1-based number. */
export function resolveColumn(headers, ref) {
  if (!ref) return -1;
  const byName = headers.findIndex((h) => norm(h) === norm(ref));
  if (byName >= 0) return byName;
  if (/^[A-Z]{1,2}$/i.test(ref)) return columnIndex(ref.toUpperCase());
  if (/^\d+$/.test(ref)) return Number(ref) - 1;
  return -1;
}

/** rows (with header row) + mapping → [{ code, quantity?, price?, oldPrice?, costPrice?, location? }] */
export function rowsToItems(rows, columns) {
  if (!rows.length) return { headers: [], items: [] };
  const [headers, ...data] = rows;
  const idx = Object.fromEntries(Object.entries(columns || {}).map(([k, v]) => [k, resolveColumn(headers, v)]));
  if (idx.code == null || idx.code < 0) throw new Error('Choose which column has the barcode or SKU');
  const items = data.map((r) => {
    const item = { code: r[idx.code] ?? '' };
    for (const field of ['quantity', 'price', 'oldPrice', 'costPrice', 'location']) {
      if (idx[field] >= 0) item[field] = r[idx[field]] ?? '';
    }
    return item;
  }).filter((it) => String(it.code).trim() !== '');
  return { headers, items };
}
