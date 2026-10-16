/**
 * File door: for cashier systems that can only export a spreadsheet.
 * A file arrives (uploaded in the admin, posted by the shop-PC agent, or fetched from a
 * link on a schedule), its columns are mapped once, and stock/prices are applied.
 */
import crypto from 'node:crypto';
import { readSpreadsheet, rowsToItems, guessColumns } from './spreadsheet.js';
import { applyStockReport } from './stockSync.service.js';
import { applyPriceReport } from './priceSync.service.js';
import { safeFetch } from './outboundHttp.js';

/** Share links people paste → direct download links. */
export function directDownloadUrl(raw) {
  const url = String(raw || '').trim();
  let m = /docs\.google\.com\/spreadsheets\/d\/([\w-]+)/.exec(url);
  if (m) {
    const gid = /[#&?]gid=(\d+)/.exec(url)?.[1];
    return `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv${gid ? `&gid=${gid}` : ''}`;
  }
  m = /drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=)([\w-]+)/.exec(url);
  if (m) return `https://drive.google.com/uc?export=download&id=${m[1]}`;
  if (/^https?:\/\/(www\.)?dropbox\.com\//.test(url)) {
    const u = new URL(url);
    u.searchParams.set('dl', '1');
    return u.toString();
  }
  return url;
}

/** Read a file and show headers, a guessed mapping and the first rows — used by the mapping screen. */
export function previewFile(content, { filename = '', delimiter = '' } = {}) {
  const rows = readSpreadsheet(content, { filename, delimiter });
  const headers = rows[0] || [];
  return { headers, guessed: guessColumns(headers), sample: rows.slice(1, 11), rowCount: Math.max(0, rows.length - 1) };
}

export function fileHash(content) {
  return crypto.createHash('sha256').update(Buffer.isBuffer(content) ? content : String(content)).digest('hex');
}

/** Apply a file using the connection's saved column mapping (or `columns` passed in). */
export async function importFile(connection, content, { filename = '', dryRun = false, columns } = {}) {
  const saved = columns || connection.file?.columns || {};
  const mapping = typeof saved.toObject === 'function' ? saved.toObject() : { ...saved };
  const rows = readSpreadsheet(content, { filename, delimiter: connection.file?.delimiter || '' });
  const { items } = rowsToItems(rows, mapping);

  const result = { received: items.length, updated: 0, unchanged: 0, unmatched: [], failed: [], parts: {} };
  const wantsStock = Boolean(mapping.quantity) && connection.rules?.stock !== false;
  const wantsPrices = Boolean(mapping.price || mapping.oldPrice || mapping.costPrice)
    && (connection.rules?.prices || connection.rules?.costPrices);

  if (!wantsStock && !wantsPrices) {
    result.failed.push({ code: '', message: 'Nothing to update: map a quantity or price column, and allow this connection to change stock or prices' });
    return result;
  }
  if (wantsStock) {
    const stockItems = items.filter((it) => String(it.quantity ?? '').trim() !== '');
    const stock = await applyStockReport(connection, stockItems, { mode: 'set', dryRun });
    result.parts.stock = stock;
  }
  if (wantsPrices) {
    const prices = await applyPriceReport(connection, items, { dryRun });
    result.parts.prices = prices;
  }

  const parts = Object.values(result.parts);
  result.updated = parts.reduce((n, p) => n + p.updated, 0);
  result.unchanged = parts.reduce((n, p) => n + p.unchanged, 0);
  result.unmatched = [...new Set(parts.flatMap((p) => p.unmatched))];
  const seen = new Set();
  result.failed = parts.flatMap((p) => p.failed).filter((f) => {
    const k = `${f.code}|${f.message}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return result;
}

/** Scheduled pull from the connection's file link. Skips when the file did not change. */
export async function pullFileFromUrl(connection, { force = false } = {}) {
  const url = directDownloadUrl(connection.file?.sourceUrl);
  if (!url) return { skipped: true, reason: 'No file link set' };
  const res = await safeFetch(url, { timeoutMs: 30000 });
  if (!res.ok) throw new Error(`Could not download the file (HTTP ${res.status})`);
  const type = res.headers.get('content-type') || '';
  if (type.includes('text/html')) throw new Error('The link opens a web page, not a file — share it as "anyone with the link" or use a direct download link');
  const hash = fileHash(res.buffer);
  if (!force && hash === connection.file?.lastFileHash) return { skipped: true, reason: 'File unchanged', hash };
  const filename = /\.xlsx(\?|$)/i.test(url) || (res.buffer.length >= 4 && res.buffer.readUInt32LE(0) === 0x04034b50) ? 'pull.xlsx' : 'pull.csv';
  const result = await importFile(connection, res.buffer, { filename });
  return { ...result, hash };
}
