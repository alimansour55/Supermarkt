/**
 * Seller deals through the admin API: deal summary, field-level history, scheduled changes
 * (applied by the job, cancellable), bulk change now / on a date, seller notified.
 * Skips itself when MongoDB is not reachable.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

const MONGO_BASE = (process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/marketplus').replace(/\/[^/?]*(\?.*)?$/, '');
const TEST_DB_URI = `${MONGO_BASE}/marketplus_marketplace_deal_test`;

let mongoose;
let api;
let apiUrl;
let skip = false;
let Seller;
let UserNotification;
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
    JWT_SECRET: 'marketplace_deal_jwt_secret_at_least_32_chars_ok',
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
  ({ default: Seller } = await import('../src/models/Seller.js'));
  ({ default: UserNotification } = await import('../src/models/UserNotification.js'));
  const { default: app } = await import('../src/app.js');
  const { generateToken } = await import('../src/utils/generateToken.js');

  api = await new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
  apiUrl = `http://127.0.0.1:${api.address().port}/api`;

  const admin = await User.create({ name: 'Boss', username: 'boss_deal', role: 'super_admin', password: 'adminpass123' });
  t.token = generateToken(admin._id);
  t.food = await Category.create({ nameAr: 'طعام', nameEn: 'Food', slug: 'food-deal', isActive: true });
  t.home = await Category.create({ nameAr: 'منزل', nameEn: 'Home', slug: 'home-deal', isActive: true });

  const make = async (n) => {
    const seller = await Seller.create({ nameAr: `بائع ${n}`, nameEn: `Seller ${n}`, slug: `deal-${n}`, status: 'active' });
    const owner = await User.create({ name: `Owner ${n}`, email: `deal${n}@x.test`, password: 'sellerpass123', role: 'seller_owner', seller: seller._id });
    seller.owner = owner._id;
    await seller.save();
    return { seller, owner };
  };
  t.A = await make('a');
  t.B = await make('b');
  t.C = await make('c');

  const settings = await call('PUT', '/admin/marketplace/settings', {
    defaultCommissionRate: 10,
    categoryCommissions: [{ category: String(t.food._id), rate: 6 }],
    plans: [{ key: 'pro', nameEn: 'Pro', nameAr: 'برو', commissionRate: 8 }],
  }, t.token);
  assert.equal(settings.status, 200, settings.text);
});

after(async () => {
  if (mongoose?.connection?.readyState === 1) {
    if (!skip) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
  api?.close();
});

const A = () => `/admin/marketplace/sellers/${t.A.seller._id}`;

test('deal summary shows each category rate and where it comes from', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  await call('PUT', A(), { categoryCommissions: [{ category: String(t.home._id), rate: 3 }] }, t.token);
  const res = await call('GET', `${A()}/deal`, null, t.token);
  assert.equal(res.status, 200);
  const by = Object.fromEntries(res.body.data.categories.map((c) => [c.nameEn, c]));
  assert.deepEqual([by.Food.rate, by.Food.source], [6, 'category']);
  assert.deepEqual([by.Home.rate, by.Home.source], [3, 'seller_category']);
  assert.equal(res.body.data.baseRate.rate, 10);
  assert.deepEqual(res.body.data.scheduled, []);
});

test('panel save writes deal history and tells the seller', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  await UserNotification.deleteMany({});
  assert.equal((await call('PUT', A(), { commissionRate: 7, feeOverrides: { fixedFeePerItem: 1.5 } }, t.token)).status, 200);
  const hist = await call('GET', `${A()}/history?type=deal`, null, t.token);
  const latest = hist.body.data[0];
  assert.deepEqual(latest.changes.commissionRate, { from: null, to: 7 });
  assert.deepEqual(latest.changes['feeOverrides.fixedFeePerItem'], { from: null, to: 1.5 });
  assert.equal(latest.actorName, 'Boss');
  assert.equal(await UserNotification.countDocuments({ user: t.A.owner._id, type: 'seller_account' }), 1);

  await call('PUT', A(), { internalNote: 'call on Sundays' }, t.token);
  const dealOnly = await call('GET', `${A()}/history?type=deal`, null, t.token);
  assert.ok(dealOnly.body.data.every((r) => !r.changes.internalNote), 'non-deal edits are left out of the deal history');
  const all = await call('GET', `${A()}/history`, null, t.token);
  assert.ok(all.body.data.some((r) => r.changes.internalNote));
});

test('scheduled change waits for its date, then the job applies it once', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const past = await call('POST', `${A()}/deal-schedule`, { applyAt: new Date(Date.now() - 60000).toISOString(), changes: { commissionRate: 5 } }, t.token);
  assert.equal(past.status, 400);
  const bad = await call('POST', `${A()}/deal-schedule`, { applyAt: new Date(Date.now() + 86400000).toISOString(), changes: { feePlan: 'nope' } }, t.token);
  assert.equal(bad.status, 400, 'an invalid change is rejected today, not on its date');

  const when = new Date(Date.now() + 86400000);
  const res = await call('POST', `${A()}/deal-schedule`, {
    applyAt: when.toISOString(), changes: { commissionRate: 5, feePlan: 'pro', feeOverrides: { commissionFreeUntil: null } }, note: 'Q4 deal',
  }, t.token);
  assert.equal(res.status, 201, res.text);
  assert.equal(res.body.data.find((d) => d.status === 'pending').note, 'Q4 deal');

  const { runScheduledDealChanges } = await import('../src/services/sellerDeal.service.js');
  assert.equal(await runScheduledDealChanges(new Date()), 0, 'not due yet');
  assert.equal((await Seller.findById(t.A.seller._id)).commissionRate, 7);

  assert.equal(await runScheduledDealChanges(new Date(when.getTime() + 1000)), 1);
  const after1 = await Seller.findById(t.A.seller._id);
  assert.equal(after1.commissionRate, 5);
  assert.equal(after1.feePlan, 'pro');
  assert.equal(after1.feeOverrides.fixedFeePerItem, 1.5, 'partial deal terms merge onto the existing ones');
  assert.equal(await runScheduledDealChanges(new Date(when.getTime() + 2000)), 0, 'applied once');

  const hist = await call('GET', `${A()}/history?type=deal`, null, t.token);
  assert.equal(hist.body.data[0].changes.via.to, 'schedule');
  assert.deepEqual(hist.body.data[0].changes.commissionRate, { from: 7, to: 5 });
});

test('a waiting change can be cancelled', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const res = await call('POST', `${A()}/deal-schedule`, { applyAt: new Date(Date.now() + 3 * 86400000).toISOString(), changes: { commissionRate: 2 } }, t.token);
  const id = res.body.data.find((d) => d.status === 'pending')._id;
  const cancel = await call('DELETE', `${A()}/deal-schedule/${id}`, null, t.token);
  assert.equal(cancel.status, 200);
  assert.equal(cancel.body.data.find((d) => String(d._id) === String(id)).status, 'cancelled');
  assert.equal((await call('DELETE', `${A()}/deal-schedule/${id}`, null, t.token)).status, 404);
  const { runScheduledDealChanges } = await import('../src/services/sellerDeal.service.js');
  assert.equal(await runScheduledDealChanges(new Date(Date.now() + 4 * 86400000)), 0);
});

test('bulk: same deal for many sellers now, or scheduled for each', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const ids = [t.B.seller._id, t.C.seller._id].map(String);
  assert.equal((await call('POST', '/admin/marketplace/sellers/bulk-deal', { sellerIds: [], changes: { commissionRate: 4 } }, t.token)).status, 400);
  assert.equal((await call('POST', '/admin/marketplace/sellers/bulk-deal', { sellerIds: ids, changes: {} }, t.token)).status, 400);

  const now = await call('POST', '/admin/marketplace/sellers/bulk-deal', { sellerIds: ids, changes: { feePlan: 'pro', commissionRate: null } }, t.token);
  assert.equal(now.status, 200, now.text);
  assert.deepEqual([now.body.data.updated, now.body.data.scheduled, now.body.data.failed.length], [2, 0, 0]);
  assert.equal((await Seller.findById(t.B.seller._id)).feePlan, 'pro');

  const later = await call('POST', '/admin/marketplace/sellers/bulk-deal', {
    sellerIds: ids, changes: { feeOverrides: { payoutFrequency: 'monthly' } }, applyAt: new Date(Date.now() + 86400000).toISOString(),
  }, t.token);
  assert.equal(later.body.data.scheduled, 2);
  const c = await Seller.findById(t.C.seller._id);
  assert.equal(c.scheduledDeals.filter((d) => d.status === 'pending').length, 1);
  assert.equal(c.feeOverrides.payoutFrequency, '', 'not applied yet');
});
