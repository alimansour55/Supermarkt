/**
 * One seller's work in its admin panel: products by state, activity, messages & replies with
 * unread counts, warnings with strikes (auto-suspend, withdraw), the at-risk notice job and the
 * performance trend. Skips itself when MongoDB is not reachable.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

const MONGO_BASE = (process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/marketplus').replace(/\/[^/?]*(\?.*)?$/, '');
const TEST_DB_URI = `${MONGO_BASE}/marketplus_marketplace_work_test`;

let mongoose;
let api;
let apiUrl;
let skip = false;
let Seller;
let Shipment;
let SellerMessage;
const t = {};

async function call(method, path, body, token) {
  const res = await fetch(`${apiUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON */ }
  return { status: res.status, body: json, text };
}

before(async () => {
  Object.assign(process.env, {
    NODE_ENV: 'test',
    MONGODB_URI: TEST_DB_URI,
    JWT_SECRET: 'marketplace_work_jwt_secret_at_least_32_chars_ok',
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
  const { default: User } = await import('../src/models/User.js');
  const { default: Category } = await import('../src/models/Category.js');
  const { default: Product } = await import('../src/models/Product.js');
  ({ default: Seller } = await import('../src/models/Seller.js'));
  ({ default: Shipment } = await import('../src/models/Shipment.js'));
  ({ default: SellerMessage } = await import('../src/models/SellerMessage.js'));
  const { default: app } = await import('../src/app.js');
  const { generateToken } = await import('../src/utils/generateToken.js');

  api = await new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
  apiUrl = `http://127.0.0.1:${api.address().port}/api`;

  const admin = await User.create({ name: 'Boss', username: 'boss_work', role: 'super_admin', password: 'adminpass123' });
  t.token = generateToken(admin._id);

  t.seller = await Seller.create({ nameAr: 'متجر', nameEn: 'Shop', slug: 'work-shop', status: 'active', approvedAt: new Date('2026-01-01') });
  const owner = await User.create({ name: 'Owner', email: 'work@x.test', password: 'sellerpass123', role: 'seller_owner', seller: t.seller._id });
  t.seller.owner = owner._id;
  await t.seller.save();
  t.sellerToken = generateToken(owner._id, { sv: 0 });

  const cat = await Category.create({ nameAr: 'عسل', nameEn: 'Honey', slug: 'honey-work', isActive: true });
  const product = (o) => Product.create({
    nameAr: 'منتج', nameEn: 'Item', price: 100, stock: 5, category: cat._id, seller: t.seller._id,
    sku: `WK-${Math.random().toString(36).slice(2, 8)}`, slug: `wk-${Math.random().toString(36).slice(2, 8)}`, ...o,
  });
  await product({ nameEn: 'Clover honey', listingStatus: 'approved' });
  await product({ nameEn: 'Empty jar', listingStatus: 'approved', stock: 0 });
  await product({ nameEn: 'New comb', listingStatus: 'pending_review', submittedAt: new Date() });
  await product({ nameEn: 'Bad photo', listingStatus: 'rejected' });
});

after(async () => {
  if (mongoose?.connection?.readyState === 1) {
    if (!skip) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
  api?.close();
});

const base = () => `/admin/marketplace/sellers/${t.seller._id}`;

test('products by state with counts and search', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const q = (state, extra = '') => call('GET', `/admin/marketplace/listings?seller=${t.seller._id}&state=${state}${extra}`, null, t.token);
  const all = await q('all');
  assert.equal(all.status, 200, all.text);
  assert.equal(all.body.data.length, 4);
  assert.equal(all.body.counts.all, 4);
  assert.equal(all.body.counts.pending, 1);
  assert.equal(all.body.counts.out_of_stock, 1);
  assert.equal(all.body.counts.rejected, 1);
  assert.deepEqual((await q('out_of_stock')).body.data.map((p) => p.nameEn), ['Empty jar']);
  assert.deepEqual((await q('all', '&q=comb')).body.data.map((p) => p.nameEn), ['New comb']);
  assert.equal((await call('GET', '/admin/marketplace/listings', null, t.token)).body.counts, undefined, 'no counts without a seller');
});

test('messages: staff → seller (read receipts), seller reply → unread for staff', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  assert.equal((await call('POST', `${base()}/messages`, { body: '  ' }, t.token)).status, 400);
  const sent = await call('POST', `${base()}/messages`, { body: 'Please update your return address.' }, t.token);
  assert.equal(sent.status, 201, sent.text);

  const summary = await call('GET', '/seller/summary', null, t.sellerToken);
  assert.equal(summary.body.data.unreadStoreMessages, 1);
  const thread = await call('GET', '/seller/messages', null, t.sellerToken);
  assert.equal(thread.body.data.messages.length, 1);
  assert.equal((await call('GET', '/seller/summary', null, t.sellerToken)).body.data.unreadStoreMessages, 0, 'opening marks read');

  assert.equal((await call('POST', '/seller/messages', { body: 'Done, thanks!' }, t.sellerToken)).status, 201);
  const list = await call('GET', '/admin/marketplace/sellers', null, t.token);
  assert.equal(list.body.summary.unreadMessages, 1);
  assert.equal(list.body.data.find((s) => s.slug === 'work-shop').unreadMessages, 1);
  const adminThread = await call('GET', `${base()}/messages`, null, t.token);
  assert.equal(adminThread.body.data.messages.length, 2);
  assert.equal((await call('GET', '/admin/marketplace/sellers', null, t.token)).body.summary.unreadMessages, 0);

  const activity = await call('GET', `${base()}/activity`, null, t.token);
  assert.ok(activity.body.data.some((a) => a.action === 'store.message'));
});

test('strikes: auto-suspend at the limit only when switched on; withdraw stops counting', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  await call('PUT', '/admin/marketplace/settings', { enforcement: { maxStrikes: 2, strikeWindowDays: 30, autoSuspend: false } }, t.token);
  const w1 = await call('POST', `${base()}/messages`, { body: 'Late shipping again', kind: 'warning', strike: true, reason: 'late_shipping' }, t.token);
  assert.equal(w1.body.data.strikes, 1);
  const w2 = await call('POST', `${base()}/messages`, { body: 'Cancelled orders', kind: 'warning', strike: true, reason: 'cancellations' }, t.token);
  assert.equal(w2.body.data.strikes, 2);
  assert.equal(w2.body.suspended, false, 'auto-suspend is off');
  assert.equal((await Seller.findById(t.seller._id)).status, 'active');

  const id = w2.body.data.messages.find((m) => m.body === 'Cancelled orders')._id;
  const back = await call('POST', `${base()}/messages/${id}/withdraw`, {}, t.token);
  assert.equal(back.body.data.strikes, 1);

  await call('PUT', '/admin/marketplace/settings', { enforcement: { autoSuspend: true } }, t.token);
  const w3 = await call('POST', `${base()}/messages`, { body: 'Counterfeit report', kind: 'warning', strike: true, reason: 'counterfeit' }, t.token);
  assert.equal(w3.body.suspended, true);
  const s = await Seller.findById(t.seller._id);
  assert.equal(s.status, 'suspended');
  assert.match(s.statusReason, /Automatic: 2 warnings/);

  const seen = await call('GET', '/seller/messages', null, t.sellerToken);
  assert.equal(seen.body.data.strikes, 2);
  assert.equal(seen.body.data.autoSuspend, true);
  await call('PUT', '/admin/marketplace/settings', { enforcement: { autoSuspend: false } }, t.token);
  await call('POST', `${base()}/status`, { status: 'active' }, t.token);
});

test('at-risk notice job: once a week, never a strike', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const now = new Date();
  const docs = Array.from({ length: 10 }, (_, i) => ({
    seller: t.seller._id, order: new mongoose.Types.ObjectId(), orderNumber: `ORD-W${i}`, shipmentNumber: `SH-W${i}`,
    fulfilledBy: 'seller', status: i < 3 ? 'cancelled' : 'delivered', cancelledByRole: i < 3 ? 'seller' : '',
    shippedAt: i < 3 ? null : new Date(now.getTime() - 86400000), subtotal: 100, createdAt: new Date(now.getTime() - 2 * 86400000),
  }));
  await Shipment.collection.insertMany(docs);
  const { runSellerEnforcement } = await import('../src/services/sellerMessage.service.js');
  assert.equal(await runSellerEnforcement(now, { force: true }), 1);
  assert.equal(await runSellerEnforcement(now, { force: true }), 0, 'not again within a week');
  const notice = await SellerMessage.findOne({ seller: t.seller._id, from: 'system' }).lean();
  assert.equal(notice.kind, 'notice');
  assert.equal(notice.strike, false);

  const trend = await call('GET', `${base()}/trend?months=3`, null, t.token);
  assert.equal(trend.status, 200);
  const last = trend.body.data[trend.body.data.length - 1];
  assert.equal(last.parcels, 10);
  assert.equal(last.cancelRate, 30);
});
