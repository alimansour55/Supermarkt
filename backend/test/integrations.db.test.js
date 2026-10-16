/**
 * Integrations end to end: admin creates connections, an outside system pushes stock/prices
 * with its key, online orders are held and acknowledged, webhooks are signed and retried,
 * and files are imported. Skips itself when MongoDB is not reachable.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import { makeXlsx } from './integrations.test.js';

const MONGO_BASE = (process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/marketplus').replace(/\/[^/?]*(\?.*)?$/, '');
const TEST_DB_URI = `${MONGO_BASE}/marketplus_integrations_test`;

let mongoose;
let api;
let apiUrl;
let skip = false;
const m = {};
const t = {};

async function call(method, path, body, { token, key, headers = {} } = {}) {
  const res = await fetch(`${apiUrl}${path}`, {
    method,
    headers: {
      ...(body !== undefined && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(key ? { 'X-Api-Key': key } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON */ }
  return { status: res.status, body: json };
}

before(async () => {
  Object.assign(process.env, {
    NODE_ENV: 'test',
    MONGODB_URI: TEST_DB_URI,
    JWT_SECRET: 'integrations_db_test_jwt_secret_at_least_32_chars',
    CLIENT_URL: 'http://client.test',
    INTEGRATIONS_JOBS: 'off',
  });
  delete process.env.MEILI_HOST;
  delete process.env.ADMIN_EMAIL;
  mongoose = (await import('mongoose')).default;
  try {
    await mongoose.connect(TEST_DB_URI, { serverSelectionTimeoutMS: 2000 });
  } catch {
    skip = true;
    return;
  }
  await mongoose.connection.dropDatabase();
  for (const name of ['User', 'Product', 'Order', 'FulfillmentLocation', 'LocationStock', 'IntegrationConnection', 'IntegrationLog', 'WebhookDelivery', 'IntegrationOrderState', 'Notification']) {
    // eslint-disable-next-line no-await-in-loop
    m[name] = (await import(`../src/models/${name}.js`)).default;
  }
  m.settings = await import('../src/models/IntegrationSettings.js');
  m.scanner = await import('../src/services/integrations/orderScanner.service.js');
  m.webhooks = await import('../src/services/integrations/webhooks.service.js');
  m.matcher = await import('../src/services/integrations/productMatcher.js');

  const { default: app } = await import('../src/app.js');
  const { generateToken } = await import('../src/utils/generateToken.js');
  api = await new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
  apiUrl = `http://127.0.0.1:${api.address().port}/api`;

  const admin = await m.User.create({ name: 'Admin', username: 'admin_int', role: 'super_admin', password: 'adminpass123' });
  t.admin = generateToken(admin._id);
  const manager = await m.User.create({ name: 'Manager', username: 'manager_int', role: 'manager', password: 'managerpass1' });
  t.manager = generateToken(manager._id);
  t.customer = await m.User.create({ name: 'Customer', phone: '+201011113333' });

  t.main = await m.FulfillmentLocation.create({ name: 'Main shop', address: 'Cairo', isDefault: true });
  t.branch = await m.FulfillmentLocation.create({ name: 'Branch 2', address: 'Giza' });

  const { default: Category } = await import('../src/models/Category.js');
  const category = await Category.create({ nameAr: 'بقالة', nameEn: 'Grocery', slug: 'grocery-int', isActive: true });
  const cat = { category: category._id };
  t.milk = await m.Product.create({ ...cat, nameAr: 'لبن', nameEn: 'Milk', slug: 'milk', price: 30, stock: 50, barcode: '06221000001', sku: 'MILK-1' });
  t.rice = await m.Product.create({ ...cat, nameAr: 'أرز', nameEn: 'Rice', slug: 'rice', price: 40, stock: 10, sku: 'RICE-5KG' });
  t.shirt = await m.Product.create({
    ...cat,
    nameAr: 'تيشيرت', nameEn: 'Shirt', slug: 'shirt', price: 100, stock: 0,
    variants: [
      { type: 'size', valueAr: 'صغير', valueEn: 'S', barcode: 'SHIRT-S', price: 100, stock: 3 },
      { type: 'size', valueAr: 'كبير', valueEn: 'L', barcode: 'SHIRT-L', price: 110, stock: 4 },
    ],
  });
  await m.settings.getIntegrationSettings();
  m.matcher.invalidateProductMatcher();
});

after(async () => {
  if (mongoose?.connection?.readyState === 1) {
    if (!skip) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
  api?.close();
});

let orderSeq = 0;
async function placeOrder(items, extra = {}) {
  orderSeq += 1;
  return m.Order.create({
    orderNumber: `INT-${orderSeq}`,
    user: t.customer._id,
    items: items.map(([product, quantity, variantId]) => ({
      product: product._id, variantId: variantId || null, nameAr: product.nameAr, nameEn: product.nameEn, price: product.price, quantity,
    })),
    shippingAddress: { street: '1 Nile St', city: 'Cairo' },
    phone: '+201011113333',
    subtotal: 100,
    total: 100,
    paymentMethod: 'cod',
    ...extra,
  });
}

const stockOf = async (product) => (await m.Product.findById(product._id).lean()).stock;

test('only staff with the integrations permission can manage connections', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  assert.equal((await call('GET', '/admin/integrations')).status, 401);
  assert.equal((await call('GET', '/admin/integrations', undefined, { token: t.manager })).status, 403);
  const ok = await call('GET', '/admin/integrations', undefined, { token: t.admin });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.data.connectors.length, 5);
});

test('API key: shown once, checked, scoped, rotatable', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const created = await call('POST', '/admin/integrations/connections', { name: 'Shop POS', door: 'api' }, { token: t.admin });
  assert.equal(created.status, 201);
  t.posId = created.body.data.connection.id;
  t.posKey = created.body.data.apiKey;
  assert.match(t.posKey, /^mpk_/);

  const raw = await m.IntegrationConnection.findById(t.posId).select('+apiKey.hash').lean();
  assert.ok(!JSON.stringify(raw).includes(t.posKey), 'the key itself is never stored');

  assert.equal((await call('GET', '/integrations/v1/ping')).status, 401);
  assert.equal((await call('GET', '/integrations/v1/ping', undefined, { key: `${t.posKey}x` })).status, 401);
  const ping = await call('GET', '/integrations/v1/ping', undefined, { key: t.posKey });
  assert.equal(ping.status, 200);
  assert.equal(ping.body.data.connection, 'Shop POS');

  // No prices:write scope by default.
  assert.equal((await call('PUT', '/integrations/v1/prices', { items: [] }, { key: t.posKey })).status, 403);

  const rotated = await call('POST', `/admin/integrations/connections/${t.posId}/api-key`, {}, { token: t.admin });
  assert.equal((await call('GET', '/integrations/v1/ping', undefined, { key: t.posKey })).status, 401, 'old key stops working');
  t.posKey = rotated.body.data.apiKey;
  assert.equal((await call('GET', '/integrations/v1/ping', undefined, { key: t.posKey })).status, 200);

  await call('PATCH', `/admin/integrations/connections/${t.posId}`, { status: 'paused' }, { token: t.admin });
  assert.equal((await call('GET', '/integrations/v1/ping', undefined, { key: t.posKey })).status, 403);
  await call('PATCH', `/admin/integrations/connections/${t.posId}`, {
    status: 'active',
    locationMap: [{ externalCode: 'B2', location: String(t.branch._id) }],
  }, { token: t.admin });
});

test('stock report: barcode/SKU/variant matching, branches, unmatched, idempotent', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const items = [
    { barcode: '6221000001', quantity: 20 }, // leading zero lost in Excel — still matches
    { code: '6221000001', quantity: 5, location: 'B2' },
    { sku: 'rice-5kg', quantity: '١٢' },
    { code: 'SHIRT-L', quantity: 9 },
    { code: 'NOPE-404', quantity: 3 },
    { code: 'MILK-1', quantity: 'many' },
  ];
  const res = await call('PUT', '/integrations/v1/stock', { items }, { key: t.posKey });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.updated, 4);
  assert.deepEqual(res.body.data.unmatched, ['NOPE-404']);
  assert.equal(res.body.data.failed.length, 1);

  assert.equal(await stockOf(t.milk), 25, 'main 20 + branch 5');
  assert.equal(await stockOf(t.rice), 12);
  const shirt = await m.Product.findById(t.shirt._id).lean();
  assert.equal(shirt.variants.find((v) => v.valueEn === 'L').stock, 9);
  assert.equal(shirt.variants.find((v) => v.valueEn === 'S').stock, 3, 'unreported variant untouched');

  const again = await call('PUT', '/integrations/v1/stock', { items: items.slice(0, 2) }, { key: t.posKey });
  assert.equal(again.body.data.updated, 0);
  assert.equal(again.body.data.unchanged, 2);

  const conn = await m.IntegrationConnection.findById(t.posId).lean();
  assert.equal(conn.unmatchedCodes[0].code, 'NOPE-404');
  assert.ok(conn.lastSyncAt);
});

test('safety buffer and which branches sell online', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const res = await call('PUT', '/admin/integrations/settings', { stockBuffer: 2, onlineLocations: [String(t.main._id)], onlineOrderHold: 'none' }, { token: t.admin });
  assert.equal(res.status, 200);
  const { recomputeProductStock } = await import('../src/services/integrations/stockSync.service.js');
  await recomputeProductStock([t.milk._id]);
  assert.equal(await stockOf(t.milk), 18, 'main 20 − buffer 2; branch 2 not sold online');
  await call('PUT', '/admin/integrations/settings', { stockBuffer: 0, onlineLocations: [] }, { token: t.admin });
  await recomputeProductStock([t.milk._id]);
  assert.equal(await stockOf(t.milk), 25);
});

test('adjustments need a reference and are applied once', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const noRef = await call('POST', '/integrations/v1/stock/adjustments', { items: [{ code: 'RICE-5KG', change: -2 }] }, { key: t.posKey });
  assert.equal(noRef.status, 400);
  const body = { reference: 'RCPT-1001', items: [{ code: 'RICE-5KG', change: -2 }, { code: 'RICE-5KG', change: -1 }] };
  const first = await call('POST', '/integrations/v1/stock/adjustments', body, { key: t.posKey });
  assert.equal(first.status, 200);
  assert.equal(await stockOf(t.rice), 9);
  const replay = await call('POST', '/integrations/v1/stock/adjustments', body, { key: t.posKey });
  assert.equal(replay.body.data.replayed, true);
  assert.equal(await stockOf(t.rice), 9, 'same receipt is not counted twice');
});

test('dry run shows the change without saving', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const res = await call('PUT', '/integrations/v1/stock?dryRun=true', { items: [{ code: 'RICE-5KG', quantity: 99 }] }, { key: t.posKey });
  assert.equal(res.body.data.dryRun, true);
  assert.equal(res.body.data.preview[0].after, 99);
  assert.equal(await stockOf(t.rice), 9);
});

test('online orders are held until acknowledged, then released', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  await call('PUT', '/admin/integrations/settings', { onlineOrderHold: 'ack' }, { token: t.admin });
  const order = await placeOrder([[t.rice, 4]]);
  await m.Product.updateOne({ _id: t.rice._id }, { $inc: { stock: -4 } }); // what checkout does
  assert.equal(await stockOf(t.rice), 5);

  // The POS reports its own (unchanged) count — the website must not give the 4 back.
  await call('PUT', '/integrations/v1/stock', { items: [{ code: 'RICE-5KG', quantity: 9 }] }, { key: t.posKey });
  await m.scanner.scanOrderChanges();
  const { recomputeProductStock } = await import('../src/services/integrations/stockSync.service.js');
  await recomputeProductStock([t.rice._id]);
  assert.equal(await stockOf(t.rice), 5, '9 in the shop − 4 held for the online order');

  const feed = await call('GET', '/integrations/v1/orders?unacknowledged=true', undefined, { key: t.posKey });
  assert.equal(feed.status, 200);
  const line = feed.body.data.find((o) => o.number === order.orderNumber);
  assert.ok(line);
  assert.equal(line.items[0].sku, 'RICE-5KG', 'falls back to the product SKU');
  assert.equal(line.items[0].quantity, 4);

  // POS takes the 4 out, then acknowledges.
  await call('PUT', '/integrations/v1/stock', { items: [{ code: 'RICE-5KG', quantity: 5 }] }, { key: t.posKey });
  assert.equal(await stockOf(t.rice), 1, 'briefly under-counts (safe side) until the ack');
  const ack = await call('POST', `/integrations/v1/orders/${order.orderNumber}/acknowledge`, { externalReference: 'POS-77' }, { key: t.posKey });
  assert.equal(ack.status, 200);
  assert.equal(ack.body.data.acknowledged, true);
  assert.equal(await stockOf(t.rice), 5);

  const twice = await call('POST', `/integrations/v1/orders/${order._id}/acknowledge`, {}, { key: t.posKey });
  assert.equal(twice.body.data.alreadyAcknowledged, true);

  const next = await call('GET', `/integrations/v1/orders?unacknowledged=true`, undefined, { key: t.posKey });
  assert.ok(!next.body.data.some((o) => o.number === order.orderNumber));
});

test('"until delivered" hold releases when the order is delivered or cancelled', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  await call('PUT', '/admin/integrations/settings', { onlineOrderHold: 'until_delivered' }, { token: t.admin });
  const order = await placeOrder([[t.rice, 2]]);
  await m.scanner.scanOrderChanges();
  assert.equal(await stockOf(t.rice), 3);
  await new Promise((r) => setTimeout(r, 5));
  await m.Order.updateOne({ _id: order._id }, { $set: { orderStatus: 'cancelled' } });
  await m.scanner.scanOrderChanges();
  assert.equal(await stockOf(t.rice), 5, 'cancelled order no longer held');
});

test('order feed pages with a cursor', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const page1 = await call('GET', '/integrations/v1/orders?limit=1', undefined, { key: t.posKey });
  assert.equal(page1.body.data.length, 1);
  assert.equal(page1.body.hasMore, true);
  const page2 = await call('GET', `/integrations/v1/orders?limit=1&cursor=${page1.body.nextCursor}`, undefined, { key: t.posKey });
  assert.notEqual(page2.body.data[0].id, page1.body.data[0].id);
  assert.equal((await call('GET', '/integrations/v1/orders?cursor=bad', undefined, { key: t.posKey })).status, 400);
});

test('prices only change when the connection is allowed, and keep offers honest', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  await call('PATCH', `/admin/integrations/connections/${t.posId}`, {
    scopes: ['stock:write', 'prices:write', 'products:read', 'orders:read', 'orders:write'],
    rules: { prices: false },
  }, { token: t.admin });
  const blocked = await call('PUT', '/integrations/v1/prices', { items: [{ code: 'MILK-1', price: 33 }] }, { key: t.posKey });
  assert.equal(blocked.status, 403);

  await call('PATCH', `/admin/integrations/connections/${t.posId}`, { rules: { prices: true, costPrices: true } }, { token: t.admin });
  const res = await call('PUT', '/integrations/v1/prices', {
    items: [
      { code: 'MILK-1', price: 33, oldPrice: 40, costPrice: 25 },
      { code: 'SHIRT-S', price: 95 },
      { code: 'RICE-5KG', price: -1 },
    ],
  }, { key: t.posKey });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.updated, 2);
  assert.equal(res.body.data.failed.length, 1);
  const milk = await m.Product.findById(t.milk._id).lean();
  assert.equal(milk.price, 33);
  assert.equal(milk.wholesalePrice, 25);
  assert.equal(milk.discount, 18, 'discount recomputed from old price');

  await call('PUT', '/integrations/v1/prices', { items: [{ code: 'MILK-1', price: 45 }] }, { key: t.posKey });
  const after = await m.Product.findById(t.milk._id).lean();
  assert.equal(after.oldPrice, null, 'old price at or below the new price is dropped');

  const products = await call('GET', '/integrations/v1/products?code=milk-1', undefined, { key: t.posKey });
  assert.equal(products.body.data[0].costPrice, 25);
});

test('webhooks are signed, retried and finally delivered', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const received = [];
  let failNext = 1;
  const receiver = await new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        if (failNext > 0) { failNext -= 1; res.statusCode = 500; return res.end('nope'); }
        received.push({ headers: req.headers, body });
        res.end('ok');
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
  try {
    const created = await call('POST', '/admin/integrations/connections', { name: 'ERP hooks', door: 'webhook' }, { token: t.admin });
    const secret = created.body.data.webhookSecret;
    const id = created.body.data.connection.id;
    const upd = await call('PATCH', `/admin/integrations/connections/${id}`, {
      webhook: { url: `http://127.0.0.1:${receiver.address().port}/hook`, events: ['order.created', 'order.status_changed'], enabled: true },
    }, { token: t.admin });
    assert.equal(upd.status, 200);

    const testRes = await call('POST', `/admin/integrations/connections/${id}/test`, { what: 'webhook' }, { token: t.admin });
    assert.equal(testRes.body.data.ok, false, 'first call fails (500)');
    const testOk = await call('POST', `/admin/integrations/connections/${id}/test`, { what: 'webhook' }, { token: t.admin });
    assert.equal(testOk.body.data.ok, true);
    received.length = 0;

    const order = await placeOrder([[t.milk, 1]]);
    await m.scanner.scanOrderChanges();
    await m.scanner.scanOrderChanges(); // a second look must not queue the event again
    assert.equal(await m.WebhookDelivery.countDocuments({ connection: id }), 1);

    failNext = 1;
    await m.webhooks.deliverDueWebhooks();
    let row = await m.WebhookDelivery.findOne({ connection: id }).lean();
    assert.equal(row.status, 'pending');
    assert.equal(row.attempts, 1);
    assert.ok(row.nextAttemptAt > new Date(), 'retry is scheduled later');

    await call('POST', `/admin/integrations/deliveries/${row._id}/retry`, {}, { token: t.admin });
    row = await m.WebhookDelivery.findOne({ connection: id }).lean();
    assert.equal(row.status, 'delivered');

    const [hit] = received;
    const payload = JSON.parse(hit.body);
    assert.equal(payload.event, 'order.created');
    assert.equal(payload.data.order.number, order.orderNumber);
    const expected = crypto.createHmac('sha256', secret).update(`${hit.headers['x-marketplus-timestamp']}.${hit.body}`).digest('hex');
    assert.equal(hit.headers['x-marketplus-signature'], `sha256=${expected}`);

    await new Promise((r) => setTimeout(r, 5));
    await m.Order.updateOne({ _id: order._id }, { $set: { orderStatus: 'preparing' } });
    await m.scanner.scanOrderChanges();
    await m.webhooks.deliverDueWebhooks();
    const last = JSON.parse(received[received.length - 1].body);
    assert.equal(last.event, 'order.status_changed');
    assert.equal(last.data.previousStatus, 'pending');
  } finally {
    receiver.close();
  }
});

test('file door: preview guesses columns, import applies them (CSV and Excel)', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const created = await call('POST', '/admin/integrations/connections', { name: 'Old cashier export', door: 'file' }, { token: t.admin });
  const id = created.body.data.connection.id;

  const csv = 'كود الصنف;اسم;الرصيد;الفرع\nMILK-1;لبن;30;\nMILK-1;لبن;7;B2\nGHOST;x;1;\n';
  const form = new FormData();
  form.append('file', new Blob([csv], { type: 'text/csv' }), 'stock.csv');
  const preview = await call('POST', `/admin/integrations/connections/${id}/file/preview`, form, { token: t.admin });
  assert.equal(preview.status, 200);
  assert.equal(preview.body.data.guessed.code, 'كود الصنف');
  assert.equal(preview.body.data.guessed.quantity, 'الرصيد');
  assert.equal(preview.body.data.rowCount, 3);

  const mapped = await call('PATCH', `/admin/integrations/connections/${id}`, {
    file: { columns: preview.body.data.guessed },
    locationMap: [{ externalCode: 'B2', location: String(t.branch._id) }],
  }, { token: t.admin });

  const milkBefore = await stockOf(t.milk);
  const dry = new FormData();
  dry.append('file', new Blob([csv], { type: 'text/csv' }), 'stock.csv');
  dry.append('dryRun', 'true');
  const dryRes = await call('POST', `/admin/integrations/connections/${id}/file/import`, dry, { token: t.admin });
  assert.equal(mapped.body.data.file.columns.quantity, 'الرصيد');
  assert.equal(dryRes.body.data.dryRun, true);
  assert.equal(await stockOf(t.milk), milkBefore, 'dry run saved nothing');

  const real = new FormData();
  real.append('file', new Blob([csv], { type: 'text/csv' }), 'stock.csv');
  const res = await call('POST', `/admin/integrations/connections/${id}/file/import`, real, { token: t.admin });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.log.counts.unmatched, 1);
  assert.equal(await stockOf(t.milk), 37 - 1, '30 + 7 − 1 held (the webhook test order is still open)');

  // The agent can post an Excel file with the connection key.
  const keyRes = await call('POST', `/admin/integrations/connections/${id}/api-key`, {}, { token: t.admin });
  const xlsx = makeXlsx([['Barcode', 'Qty'], ['SHIRT-S', 11]]);
  const upload = await fetch(`${apiUrl}/integrations/v1/files?filename=export.xlsx`, {
    method: 'POST',
    headers: { 'X-Api-Key': keyRes.body.data.apiKey, 'Content-Type': 'application/octet-stream' },
    body: xlsx,
  });
  assert.equal(upload.status, 400, 'mapping still points at the Arabic headers');
  await call('PATCH', `/admin/integrations/connections/${id}`, { file: { columns: { code: 'Barcode', quantity: 'Qty' } } }, { token: t.admin });
  const upload2 = await fetch(`${apiUrl}/integrations/v1/files?filename=export.xlsx`, {
    method: 'POST',
    headers: { 'X-Api-Key': keyRes.body.data.apiKey, 'Content-Type': 'application/octet-stream' },
    body: xlsx,
  });
  assert.equal(upload2.status, 200);
  const shirt = await m.Product.findById(t.shirt._id).lean();
  assert.equal(shirt.variants.find((v) => v.valueEn === 'S').stock, 11);
});

test('stock breakdown and deleting a connection releases its products', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const breakdown = await call('GET', `/admin/integrations/products/${t.rice._id}/stock`, undefined, { token: t.admin });
  assert.equal(breakdown.body.data.synced, true);
  assert.equal(breakdown.body.data.branches[0].connection, 'Shop POS');

  const logs = await call('GET', `/admin/integrations/connections/${t.posId}/logs`, undefined, { token: t.admin });
  assert.ok(logs.body.data.length >= 5);

  const del = await call('DELETE', `/admin/integrations/connections/${t.posId}`, undefined, { token: t.admin });
  assert.equal(del.status, 200);
  assert.equal(await m.LocationStock.countDocuments({ connection: t.posId }), 0);
  const stillSynced = await call('GET', `/admin/integrations/products/${t.rice._id}/stock`, undefined, { token: t.admin });
  assert.equal(stillSynced.body.data.synced, false);
});

test('repeated failures raise one admin alert per hour', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const created = await call('POST', '/admin/integrations/connections', { name: 'Broken JSON', door: 'connector', connectorKey: 'generic-json' }, { token: t.admin });
  const id = created.body.data.connection.id;
  await call('PATCH', `/admin/integrations/connections/${id}`, {
    connector: { config: { url: 'http://127.0.0.1:1/nothing', codeField: 'barcode', quantityField: 'qty' } },
  }, { token: t.admin });
  const run1 = await call('POST', `/admin/integrations/connections/${id}/run`, {}, { token: t.admin });
  assert.equal(run1.body.data.status, 'error');
  await call('POST', `/admin/integrations/connections/${id}/run`, {}, { token: t.admin });
  const conn = await m.IntegrationConnection.findById(id).lean();
  assert.equal(conn.consecutiveFailures, 2);
  assert.equal(await m.Notification.countDocuments({ type: 'integration_alert', 'data.connectionId': conn._id }), 1);

  const detail = await call('GET', `/admin/integrations/connections/${id}`, undefined, { token: t.admin });
  assert.equal(detail.body.data.health, 'failing');
  assert.equal(detail.body.data.connector.config.url, 'http://127.0.0.1:1/nothing');
});

test('shop-PC agent: sends a folder export once and saves online orders as files', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const os = await import('node:os');
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const run = promisify(execFile);

  const created = await call('POST', '/admin/integrations/connections', { name: 'Back-office PC', door: 'agent' }, { token: t.admin });
  const id = created.body.data.connection.id;
  await call('PATCH', `/admin/integrations/connections/${id}`, { file: { columns: { code: 'Barcode', quantity: 'Qty' } } }, { token: t.admin });

  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'shop-agent-'));
  const exports = path.join(tmp, 'exports');
  const ordersDir = path.join(tmp, 'orders');
  await fs.mkdir(exports);
  const csv = path.join(exports, 'stock.csv');
  await fs.writeFile(csv, 'Barcode,Qty\nSHIRT-L,6\n');
  const old = new Date(Date.now() - 60_000);
  await fs.utimes(csv, old, old);
  const config = path.join(tmp, 'config.json');
  await fs.writeFile(config, JSON.stringify({
    apiUrl: apiUrl.replace(/\/api$/, ''),
    apiKey: created.body.data.apiKey,
    autoUpdate: false,
    source: { type: 'folder', path: exports, pattern: '*.csv' },
    orders: { exportFolder: ordersDir, format: 'csv', statuses: ['pending', 'preparing'] },
  }));
  const env = { ...process.env, SHOP_AGENT_CONFIG: config, SHOP_AGENT_DATA: path.join(tmp, 'data') };
  const agent = path.resolve('integrations-agent/shop-agent.mjs');

  const test1 = await run(process.execPath, [agent, '--test'], { env });
  assert.match(test1.stdout, /Connected as "Back-office PC"/);

  await run(process.execPath, [agent, '--once'], { env });
  const shirt = await m.Product.findById(t.shirt._id).lean();
  assert.equal(shirt.variants.find((v) => v.valueEn === 'L').stock, 6);
  const files = await fs.readdir(ordersDir);
  assert.ok(files.some((f) => /^order-INT-\d+\.csv$/.test(f)), 'open online orders saved for the cashier');

  const conn = await m.IntegrationConnection.findById(id).lean();
  assert.ok(conn.agent.lastSeenAt);
  assert.equal(conn.agent.version, '1.0.0');

  // Second round: same file → nothing sent again.
  const before = await m.IntegrationLog.countDocuments({ connection: id, kind: 'file' });
  await run(process.execPath, [agent, '--once'], { env });
  assert.equal(await m.IntegrationLog.countDocuments({ connection: id, kind: 'file' }), before);
  await fs.rm(tmp, { recursive: true, force: true });
});

test('a store without branches still syncs (store-wide stock)', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  await m.FulfillmentLocation.updateMany({}, { $set: { isActive: false } });
  try {
    const created = await call('POST', '/admin/integrations/connections', { name: 'No-branch POS', door: 'api' }, { token: t.admin });
    const key = created.body.data.apiKey;
    const res = await call('PUT', '/integrations/v1/stock', { items: [{ code: 'MILK-1', quantity: 14, location: 'ANY' }] }, { key });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.updated, 1);
    assert.equal(await m.LocationStock.countDocuments({ product: t.milk._id, location: null }), 1);

    // Branches are added later: the first branch report replaces the store-wide row.
    await m.FulfillmentLocation.updateOne({ _id: t.main._id }, { $set: { isActive: true } });
    await call('PUT', '/integrations/v1/stock', { items: [{ code: 'MILK-1', quantity: 9 }] }, { key });
    assert.equal(await m.LocationStock.countDocuments({ product: t.milk._id, location: null }), 0);
  } finally {
    await m.FulfillmentLocation.updateMany({}, { $set: { isActive: true } });
  }
});
