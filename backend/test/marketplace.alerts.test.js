/**
 * Seller Center — returns of the seller's items, seller notes, payout statements, ship-by
 * reminders and low-stock alerts (background jobs), notification preferences.
 * Skips itself when MongoDB is not reachable.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

const MONGO_BASE = (process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/marketplus').replace(/\/[^/?]*(\?.*)?$/, '');
const TEST_DB_URI = `${MONGO_BASE}/marketplus_marketplace_alerts_test`;
const DAY = 86400000;

let mongoose;
let api;
let apiUrl;
let skip = false;
const m = {};
const t = {};

async function call(method, path, body, token, { raw = false } = {}) {
  const res = await fetch(`${apiUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (raw) return { status: res.status, text };
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON */ }
  return { status: res.status, body: json };
}

before(async () => {
  Object.assign(process.env, {
    NODE_ENV: 'test',
    MONGODB_URI: TEST_DB_URI,
    JWT_SECRET: 'marketplace_alerts_jwt_secret_at_least_32!',
    CLIENT_URL: 'http://client.test',
  });
  delete process.env.MEILI_HOST;

  mongoose = (await import('mongoose')).default;
  try {
    await mongoose.connect(TEST_DB_URI, { serverSelectionTimeoutMS: 2000 });
  } catch {
    skip = true;
    return;
  }
  await mongoose.connection.dropDatabase();
  for (const [k, file] of [['User', 'User'], ['Category', 'Category'], ['Product', 'Product'], ['Shipment', 'Shipment'], ['Seller', 'Seller'],
    ['UserNotification', 'UserNotification'], ['SellerPayout', 'SellerPayout'], ['SellerLedgerEntry', 'SellerLedgerEntry']]) {
    // eslint-disable-next-line no-await-in-loop
    m[k] = (await import(`../src/models/${file}.js`)).default;
  }
  m.alerts = await import('../src/services/sellerAlerts.service.js');
  const { default: app } = await import('../src/app.js');
  const { generateToken } = await import('../src/utils/generateToken.js');

  api = await new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
  apiUrl = `http://127.0.0.1:${api.address().port}/api`;

  const admin = await m.User.create({ name: 'Admin', username: 'admin_alerts', role: 'super_admin', password: 'adminpass123' });
  t.adminToken = generateToken(admin._id);
  const category = await m.Category.create({ nameAr: 'تمور', nameEn: 'Dates', slug: 'dates-alerts', isActive: true });

  const apply = async (n) => (await call('POST', '/sellers/apply', {
    nameAr: `بائع ${n}`, nameEn: `Seller ${n}`, contactName: `Owner ${n}`, email: `owner${n}@alerts.test`,
    phone: `+20105555000${n}`, password: 'sellerpass123', city: 'Cairo', acceptTerms: true,
  })).body;
  const a = await apply(1);
  const b = await apply(2);
  t.sellerId = a.seller._id;
  t.otherSellerId = b.seller._id;
  t.ownerToken = a.token;
  t.ownerId = a.user.id;
  for (const id of [t.sellerId, t.otherSellerId]) {
    // eslint-disable-next-line no-await-in-loop
    await call('POST', `/admin/marketplace/sellers/${id}/status`, { status: 'active' }, t.adminToken);
  }
  await call('PUT', `/admin/marketplace/sellers/${t.sellerId}`, { autoApproveListings: true }, t.adminToken);

  const p = await call('POST', '/seller/products', { nameAr: 'تمر', nameEn: 'Dates Box', price: 90, stock: 3, category: String(category._id), submit: true }, t.ownerToken);
  t.productId = p.body.data._id;
});

after(async () => {
  if (mongoose?.connection?.readyState === 1) {
    if (!skip) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
  api?.close();
});

test('returns: sellers see returns of their own items only and can answer', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const orderId = new mongoose.Types.ObjectId();
  await m.Shipment.create({
    order: orderId, orderNumber: 'R-1', shipmentNumber: 'R-1-S1', seller: t.sellerId, fulfilledBy: 'seller', status: 'delivered',
    items: [{ itemIndex: 0, product: t.productId, nameAr: 'تمر', nameEn: 'Dates Box', price: 90, quantity: 1, lineTotal: 90 }], subtotal: 90,
  });
  await m.Shipment.create({
    order: orderId, orderNumber: 'R-1', shipmentNumber: 'R-1-S2', seller: t.otherSellerId, fulfilledBy: 'seller', status: 'delivered',
    items: [{ itemIndex: 1, nameAr: 'آخر', nameEn: 'Other', price: 10, quantity: 1, lineTotal: 10 }], subtotal: 10,
  });
  const r1 = new mongoose.Types.ObjectId();
  await mongoose.connection.collection('orders').insertOne({
    _id: orderId,
    orderNumber: 'R-1',
    sellerIds: [new mongoose.Types.ObjectId(t.sellerId), new mongoose.Types.ObjectId(t.otherSellerId)],
    returns: [
      { _id: r1, itemIndex: 0, quantity: 1, nameAr: 'تمر', nameEn: 'Dates Box', reasonEn: 'Damaged', status: 'pending', requestedAt: new Date(), lineTotal: 90 },
      { _id: new mongoose.Types.ObjectId(), itemIndex: 1, quantity: 1, nameEn: 'Other', status: 'pending', requestedAt: new Date() },
    ],
  });

  const list = await call('GET', '/seller/returns', null, t.ownerToken);
  assert.equal(list.status, 200, JSON.stringify(list.body));
  assert.deepEqual(list.body.data.map((r) => r.nameEn), ['Dates Box']);
  assert.equal(list.body.data[0].shipmentNumber, 'R-1-S1');
  assert.equal(list.body.counts.pending, 1);

  const note = await call('POST', `/seller/returns/${orderId}/${r1}/note`, { note: 'Sealed when shipped — photos please' }, t.ownerToken);
  assert.equal(note.status, 200, JSON.stringify(note.body));
  const saved = await mongoose.connection.collection('orders').findOne({ _id: orderId });
  assert.equal(saved.returns[0].sellerNote, 'Sealed when shipped — photos please');

  const summary = await call('GET', '/seller/summary', null, t.ownerToken);
  assert.equal(summary.body.data.pendingReturns, 1);
});

test('payout statement lists the entries settled in that payout (JSON + CSV)', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const payout = await m.SellerPayout.create({ payoutNumber: 'PO-T1', seller: t.sellerId, amount: 81, periodEnd: new Date() });
  await m.SellerLedgerEntry.create([
    { seller: t.sellerId, type: 'sale', amount: 90, payout: payout._id, reference: 'R-1-S1', key: 'k1' },
    { seller: t.sellerId, type: 'commission', amount: -9, payout: payout._id, reference: 'R-1-S1', key: 'k2' },
    { seller: t.sellerId, type: 'sale', amount: 50, key: 'k3' },
  ]);
  const res = await call('GET', `/seller/finance/payouts/${payout._id}/statement`, null, t.ownerToken);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.data.entries.length, 2);
  assert.deepEqual(res.body.data.totals, { sale: 90, commission: -9 });
  const csv = await call('GET', `/seller/finance/payouts/${payout._id}/statement?format=csv`, null, t.ownerToken, { raw: true });
  assert.match(csv.text, /commission,R-1-S1,,-9/);
});

test('ship-by reminder goes out once, a few hours before the deadline', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const due = await m.Shipment.create({
    order: new mongoose.Types.ObjectId(), orderNumber: 'S-1', shipmentNumber: 'S-1-S1', seller: t.sellerId, fulfilledBy: 'seller', status: 'confirmed',
    items: [{ itemIndex: 0, nameEn: 'X', price: 1, quantity: 1, lineTotal: 1 }],
  });
  const fresh = await m.Shipment.create({
    order: new mongoose.Types.ObjectId(), orderNumber: 'S-2', shipmentNumber: 'S-2-S1', seller: t.sellerId, fulfilledBy: 'seller', status: 'pending',
    items: [{ itemIndex: 0, nameEn: 'X', price: 1, quantity: 1, lineTotal: 1 }],
  });
  // handlingDays 2 → due 3 days after the order; this one is 2 days 20 hours old.
  await m.Shipment.collection.updateOne({ _id: due._id }, { $set: { createdAt: new Date(Date.now() - (2 * DAY + 20 * 3600000)) } });

  assert.equal(await m.alerts.runShipByReminders(), 1);
  assert.equal(await m.alerts.runShipByReminders(), 0, 'never twice');
  assert.ok((await m.Shipment.findById(due._id).lean()).shipByReminderAt);
  assert.equal((await m.Shipment.findById(fresh._id).lean()).shipByReminderAt, null);
  assert.ok(await m.UserNotification.exists({ user: t.ownerId, title: { $exists: false }, titleEn: 'Ship within hours' }));
});

test('low-stock alert fires once per dip and re-arms after restock; level is per product', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  assert.equal(await m.alerts.runLowStockCheck(), 1, 'stock 3 ≤ default 5');
  assert.equal(await m.alerts.runLowStockCheck(), 0);
  assert.ok(await m.UserNotification.exists({ user: t.ownerId, type: 'seller_low_stock' }));

  const res = await call('PUT', '/seller/products/bulk-inventory', { items: [{ id: t.productId, stock: 20, lowStockThreshold: 25 }] }, t.ownerToken);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.results[0].data.lowStockThreshold, 25);
  assert.equal(await m.alerts.runLowStockCheck(), 1, '20 ≤ custom level 25');

  await call('PUT', '/seller/products/bulk-inventory', { items: [{ id: t.productId, stock: 40 }] }, t.ownerToken);
  await m.alerts.runLowStockCheck();
  assert.equal((await m.Product.findById(t.productId).lean()).lowStockAlertedAt, null, 're-armed above the level');
});

test('notification preferences are saved on the store', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const res = await call('PUT', '/seller/me', { notificationPrefs: { whatsappOrders: true, emailLowStock: false } }, t.ownerToken);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body.data.notificationPrefs, { emailOrders: true, whatsappOrders: true, emailLowStock: false, shipByReminders: true });
});
