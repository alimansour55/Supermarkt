/**
 * Integrations — pure helpers: file reading (CSV + xlsx), column guessing, number parsing,
 * share-link conversion, key/secret handling and the order-change diff.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';

process.env.JWT_SECRET ||= 'integrations_unit_test_secret_value_32chars';

const { parseCsv, detectDelimiter, parseXlsx, guessColumns, rowsToItems, resolveColumn } = await import('../src/services/integrations/spreadsheet.js');
const { toNumber } = await import('../src/services/integrations/stockSync.service.js');
const { directDownloadUrl } = await import('../src/services/integrations/fileSync.service.js');
const secrets = await import('../src/services/integrations/secrets.js');
const { diffOrderEvents } = await import('../src/services/integrations/orderScanner.service.js');
const { normalizeCode } = await import('../src/services/integrations/productMatcher.js');
const { getPath } = await import('../src/services/integrations/connectors/genericJson.js');
const { describeConnectors, missingConnectorFields, getConnector } = await import('../src/services/integrations/connectors/index.js');

/** Minimal zip writer (deflate) — enough to build an .xlsx in memory. */
function makeZip(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const data = Buffer.from(content, 'utf8');
    const comp = zlib.deflateRawSync(data);
    const nameBuf = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(comp.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(comp.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBuf, comp);
    centrals.push(central, nameBuf);
    offset += 30 + nameBuf.length + comp.length;
  }
  const centralBuf = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBuf, end]);
}

export function makeXlsx(rows) {
  const strings = [];
  const idx = (s) => {
    let i = strings.indexOf(s);
    if (i < 0) { strings.push(s); i = strings.length - 1; }
    return i;
  };
  const sheetRows = rows.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => {
    const ref = `${String.fromCharCode(65 + ci)}${ri + 1}`;
    return typeof v === 'number' ? `<c r="${ref}"><v>${v}</v></c>` : `<c r="${ref}" t="s"><v>${idx(String(v))}</v></c>`;
  }).join('')}</row>`).join('');
  return makeZip({
    'xl/workbook.xml': '<workbook/>',
    'xl/sharedStrings.xml': `<sst>${strings.map((s) => `<si><t>${s.replace(/&/g, '&amp;')}</t></si>`).join('')}</sst>`,
    'xl/worksheets/sheet1.xml': `<worksheet><sheetData>${sheetRows}</sheetData></worksheet>`,
  });
}

test('CSV: separators, quotes, BOM, CRLF and blank lines', () => {
  assert.equal(detectDelimiter('a;b;c\n1;2;3'), ';');
  assert.equal(detectDelimiter('a\tb\n1\t2'), '\t');
  const rows = parseCsv('﻿Barcode,Name,Qty\r\n"0622",  "Milk, full cream" ,5\r\n\r\n"1""2",x,"7"\n');
  assert.deepEqual(rows, [['Barcode', 'Name', 'Qty'], ['0622', 'Milk, full cream', '5'], ['1"2', 'x', '7']]);
});

test('XLSX: first sheet, shared strings and numbers', () => {
  const rows = parseXlsx(makeXlsx([['الباركود', 'الكمية', 'السعر'], ['6221234', 12, 25.5], ['A&B', 0, 3]]));
  assert.deepEqual(rows, [['الباركود', 'الكمية', 'السعر'], ['6221234', '12', '25.5'], ['A&B', '0', '3']]);
});

test('column guessing understands English and Arabic headers', () => {
  assert.deepEqual(guessColumns(['Item Code', 'Description', 'Qty On Hand', 'Sale Price', 'Cost']), {
    code: 'Item Code', quantity: 'Qty On Hand', price: 'Sale Price', costPrice: 'Cost',
  });
  const ar = guessColumns(['كود الصنف', 'اسم الصنف', 'الرصيد', 'سعر البيع', 'الفرع']);
  assert.equal(ar.code, 'كود الصنف');
  assert.equal(ar.quantity, 'الرصيد');
  assert.equal(ar.price, 'سعر البيع');
  assert.equal(ar.location, 'الفرع');
});

test('mapping by header, letter or number', () => {
  const headers = ['SKU', 'Stock'];
  assert.equal(resolveColumn(headers, 'stock'), 1);
  assert.equal(resolveColumn(headers, 'B'), 1);
  assert.equal(resolveColumn(headers, '1'), 0);
  const { items } = rowsToItems([headers, ['A1', '4'], ['', '9'], ['A2', '']], { code: 'A', quantity: 'Stock' });
  assert.deepEqual(items, [{ code: 'A1', quantity: '4' }, { code: 'A2', quantity: '' }]);
  assert.throws(() => rowsToItems([headers, ['x', '1']], { quantity: 'Stock' }), /barcode or SKU/);
});

test('numbers from cashier exports', () => {
  assert.equal(toNumber('1,250.50'), 1250.5);
  assert.equal(toNumber('١٢٥'), 125);
  assert.equal(toNumber('12٫5'), 12.5);
  assert.equal(toNumber(' 7 '), 7);
  assert.ok(Number.isNaN(toNumber('abc')));
  assert.ok(Number.isNaN(toNumber('')));
});

test('codes compare without spaces and case', () => {
  assert.equal(normalizeCode(' ab 12c '), 'AB12C');
  assert.equal(normalizeCode(null), '');
});

test('share links become download links', () => {
  assert.equal(
    directDownloadUrl('https://docs.google.com/spreadsheets/d/abc_123/edit#gid=42'),
    'https://docs.google.com/spreadsheets/d/abc_123/export?format=csv&gid=42',
  );
  assert.equal(directDownloadUrl('https://drive.google.com/file/d/XYZ/view?usp=sharing'), 'https://drive.google.com/uc?export=download&id=XYZ');
  assert.equal(directDownloadUrl('https://www.dropbox.com/s/k/stock.csv?dl=0'), 'https://www.dropbox.com/s/k/stock.csv?dl=1');
  assert.equal(directDownloadUrl('https://example.com/a.csv'), 'https://example.com/a.csv');
});

test('API keys: only the hash is needed to check, and look-alikes fail', () => {
  const { key, prefix, hash } = secrets.generateApiKey();
  assert.match(key, /^mpk_[a-f0-9]{12}_/);
  assert.equal(secrets.parseApiKey(key).prefix, prefix);
  assert.ok(secrets.apiKeyMatches(key, hash));
  assert.ok(!secrets.apiKeyMatches(`${key}x`, hash));
  assert.equal(secrets.parseApiKey('Bearer nope'), null);
});

test('stored secrets are encrypted and come back intact', () => {
  const enc = secrets.encryptJson({ token: 'سر', n: 1 });
  assert.ok(!enc.includes('سر'));
  assert.deepEqual(secrets.decryptJson(enc), { token: 'سر', n: 1 });
  assert.equal(secrets.decryptSecret('garbage'), '');
});

test('webhook signature is HMAC of timestamp.body', async () => {
  const crypto = await import('node:crypto');
  const sig = secrets.signWebhook('whsec_x', '1700000000', '{"a":1}');
  assert.equal(sig, crypto.createHmac('sha256', 'whsec_x').update('1700000000.{"a":1}').digest('hex'));
});

test('order diff: new, status, payment and returns', () => {
  const started = new Date('2026-01-01');
  const order = { createdAt: new Date('2026-02-01'), orderStatus: 'pending', paymentStatus: 'paid', returns: [] };
  assert.deepEqual(diffOrderEvents(order, null, { integrationStartedAt: started }).events.map((e) => e.event), ['order.created', 'order.paid']);

  const old = { ...order, createdAt: new Date('2025-06-01') };
  assert.equal(diffOrderEvents(old, null, { integrationStartedAt: started }).events.length, 0, 'orders from before integrations are not announced');

  const state = { orderStatus: 'pending', paymentStatus: 'pending', approvedReturnIds: [] };
  const changed = diffOrderEvents({ ...order, orderStatus: 'cancelled' }, state);
  assert.deepEqual(changed.events.map((e) => e.event), ['order.status_changed', 'order.cancelled', 'order.paid']);
  assert.equal(changed.holdChanged, true);

  const legacy = diffOrderEvents({ ...order, orderStatus: 'confirmed' }, { ...state, orderStatus: 'preparing', paymentStatus: 'paid' });
  assert.equal(legacy.events.length, 0, '"confirmed" is the same as "preparing"');

  const withReturn = diffOrderEvents(
    { ...order, orderStatus: 'delivered', returns: [{ _id: 'r1', status: 'approved' }, { _id: 'r2', status: 'pending' }] },
    { orderStatus: 'delivered', paymentStatus: 'paid', approvedReturnIds: [] },
  );
  assert.deepEqual(withReturn.events.map((e) => e.key), ['return:r1']);
});

test('connector catalog: no secrets, required fields checked', () => {
  const list = describeConnectors();
  assert.deepEqual(list.map((c) => c.key), ['loyverse', 'odoo', 'zoho-inventory', 'square', 'generic-json']);
  assert.ok(list.every((c) => typeof c.pull === 'undefined'));
  assert.deepEqual(missingConnectorFields(getConnector('odoo'), { url: 'https://x.odoo.com', database: 'db' }), ['User login (email)', 'API key']);
  assert.equal(getPath({ data: { items: [1] } }, 'data.items')[0], 1);
});
