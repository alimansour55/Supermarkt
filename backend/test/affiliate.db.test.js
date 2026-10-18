/**
 * Share & earn end to end: a customer joins and gets a link, a friend orders through it,
 * the reward waits for delivery and the return window, is paid to the wallet or points,
 * and is cancelled / taken back on refunds. Skips itself when MongoDB is not reachable.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

const MONGO_BASE = (process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/marketplus').replace(/\/[^/?]*(\?.*)?$/, '');
const TEST_DB_URI = `${MONGO_BASE}/marketplus_affiliate_test`;

let mongoose;
let api;
let apiUrl;
let skip = false;
const m = {};
const t = {};

async function call(method, path, body, { token } = {}) {
  const res = await fetch(`${apiUrl}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
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
    JWT_SECRET: 'affiliate_db_test_jwt_secret_at_least_32_chars',
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
  for (const name of ['User', 'Order', 'Affiliate', 'AffiliateCommission', 'WalletTransaction']) {
    // eslint-disable-next-line no-await-in-loop
    m[name] = (await import(`../src/models/${name}.js`)).default;
  }
  m.svc = await import('../src/services/affiliate.service.js');

  const { default: app } = await import('../src/app.js');
  const { generateToken } = await import('../src/utils/generateToken.js');
  api = await new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
  apiUrl = `http://127.0.0.1:${api.address().port}/api`;

  const admin = await m.User.create({ name: 'Admin', username: 'admin_aff', role: 'super_admin', password: 'adminpass123' });
  t.admin = generateToken(admin._id);
  t.owner = await m.User.create({ name: 'Mona Sharer', phone: '+201011110001' });
  t.ownerToken = generateToken(t.owner._id);
  t.buyer = await m.User.create({ name: 'Friend Buyer', phone: '+201011110002' });
  t.buyer2 = await m.User.create({ name: 'Second Buyer', phone: '+201011110003' });
});

after(async () => {
  if (mongoose?.connection?.readyState === 1) {
    if (!skip) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
  api?.close();
});

let seq = 0;
async function placeOrder(user, extra = {}) {
  seq += 1;
  return m.Order.create({
    orderNumber: `AFF-${seq}`,
    user: user._id,
    items: [{ product: new mongoose.Types.ObjectId(), nameAr: 'منتج', price: 200, quantity: 2 }],
    shippingAddress: { street: '1 Nile St', city: 'Cairo' },
    phone: user.phone,
    subtotal: 400,
    deliveryFee: 30,
    total: 430,
    paymentMethod: 'cod',
    ...extra,
  });
}

async function deliver(order) {
  order.orderStatus = 'delivered';
  order.paymentStatus = 'paid';
  order.deliveredAt = new Date();
  await order.save();
  return m.svc.approveAffiliateCommission(order);
}

const walletOf = async (user) => (await m.User.findById(user._id).lean()).walletBalance;

test('program off: customers cannot join; admin turns it on', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const me = await call('GET', '/affiliates/me?lang=en', undefined, { token: t.ownerToken });
  assert.equal(me.status, 200);
  assert.equal(me.body.data.program.enabled, false);
  assert.equal((await call('POST', '/affiliates/me/join', {}, { token: t.ownerToken })).status, 400);

  assert.equal((await call('PUT', '/affiliates/admin/settings', { enabled: true }, { token: t.ownerToken })).status, 403);
  const saved = await call('PUT', '/affiliates/admin/settings', {
    enabled: true, rewardType: 'wallet', calcType: 'percent', percent: 5, maxRewardPerOrder: 0, minOrderTotal: 100, holdDays: 7,
  }, { token: t.admin });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.data.percent, 5);
});

test('join, custom code, click tracking', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const joined = await call('POST', '/affiliates/me/join', {}, { token: t.ownerToken });
  assert.equal(joined.status, 201);
  assert.equal(joined.body.data.status, 'active');
  // joining twice keeps the same link
  const again = await call('POST', '/affiliates/me/join', {}, { token: t.ownerToken });
  assert.equal(again.body.data.code, joined.body.data.code);

  assert.equal((await call('PATCH', '/affiliates/me', { code: 'x' }, { token: t.ownerToken })).status, 400);
  const renamed = await call('PATCH', '/affiliates/me', { code: 'mona2026' }, { token: t.ownerToken });
  assert.equal(renamed.status, 200);
  assert.equal(renamed.body.data.code, 'MONA2026');

  const click = await call('POST', '/affiliates/click', { code: 'mona2026' });
  assert.equal(click.body.valid, true);
  assert.equal(click.body.attributionDays, 7);
  assert.equal((await call('POST', '/affiliates/click', { code: 'NOPE1234' })).body.valid, false);
  assert.equal((await m.Affiliate.findOne({ code: 'MONA2026' })).clicks, 1);
});

test('self-referral earns nothing; friend order is attached as pending', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const own = await placeOrder(t.owner);
  assert.equal(await m.svc.attachAffiliateToOrder(own, 'MONA2026'), null);

  t.order = await placeOrder(t.buyer);
  const c = await m.svc.attachAffiliateToOrder(t.order, 'mona2026');
  assert.equal(c.status, 'pending');
  assert.equal(c.rewardAmount, 20); // 5% of 400 products, delivery fee excluded
  assert.equal((await m.Order.findById(t.order._id)).affiliateCode, 'MONA2026');
  // attaching twice does nothing
  assert.equal(await m.svc.attachAffiliateToOrder(t.order, 'MONA2026'), null);
});

test('delivered → held for the return window → paid into the wallet', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const held = await deliver(t.order);
  assert.equal(held.status, 'holding');
  assert.ok(held.holdUntil > new Date(Date.now() + 6 * 24 * 3600 * 1000));

  assert.equal(await m.svc.releaseDueAffiliateCommissions(new Date()), 0);
  assert.equal(await walletOf(t.owner), 0);

  const later = new Date(Date.now() + 8 * 24 * 3600 * 1000);
  assert.equal(await m.svc.releaseDueAffiliateCommissions(later), 1);
  assert.equal(await m.svc.releaseDueAffiliateCommissions(later), 0); // never twice
  assert.equal(await walletOf(t.owner), 20);
  const txn = await m.WalletTransaction.findOne({ user: t.owner._id, type: 'reward' });
  assert.equal(txn.amount, 20);

  const me = await call('GET', '/affiliates/me?lang=en', undefined, { token: t.ownerToken });
  assert.equal(me.body.data.stats.paidReward, 20);
  assert.equal(me.body.data.commissions[0].orderNumber, undefined, 'owner never sees the buyer order number');
});

test('full refund after payout takes the reward back', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  t.order.refundAmount = t.order.total;
  t.order.paymentStatus = 'refunded';
  await m.svc.syncAffiliateCommissionWithOrder(t.order, { reason: 'refund' });
  const c = await m.AffiliateCommission.findOne({ order: t.order._id });
  assert.equal(c.status, 'reversed');
  assert.equal(await walletOf(t.owner), 0);
});

test('cancel before delivery and partial return shrink or cancel the reward', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const cancelled = await placeOrder(t.buyer2);
  await m.svc.attachAffiliateToOrder(cancelled, 'MONA2026');
  cancelled.orderStatus = 'cancelled';
  await m.svc.syncAffiliateCommissionWithOrder(cancelled);
  assert.equal((await m.AffiliateCommission.findOne({ order: cancelled._id })).status, 'cancelled');

  const partial = await placeOrder(t.buyer2);
  await m.svc.attachAffiliateToOrder(partial, 'MONA2026');
  partial.refundAmount = 200; // half the products came back
  await m.svc.syncAffiliateCommissionWithOrder(partial);
  assert.equal((await m.AffiliateCommission.findOne({ order: partial._id })).rewardAmount, 10);
});

test('points reward, hold 0 = paid on delivery; admin lists and cancels', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  await call('PUT', '/affiliates/admin/settings', { rewardType: 'points', calcType: 'fixed', fixedAmount: 50, holdDays: 0 }, { token: t.admin });
  const order = await placeOrder(t.buyer);
  await m.svc.attachAffiliateToOrder(order, 'MONA2026');
  const before = (await m.User.findById(t.owner._id).lean()).pointsBalance || 0;
  const paid = await deliver(order);
  assert.equal(paid.status, 'paid');
  const after = await m.User.findById(t.owner._id).lean();
  assert.equal(after.pointsBalance - before, 50);
  assert.equal(after.pointsHistory.at(-1).type, 'referral');

  const list = await call('GET', '/affiliates/admin/affiliates?search=mona', undefined, { token: t.admin });
  assert.equal(list.status, 200);
  assert.equal(list.body.data[0].code, 'MONA2026');
  const commissions = await call('GET', '/affiliates/admin/commissions?status=paid', undefined, { token: t.admin });
  const row = commissions.body.data.find((c) => c.orderNumber === order.orderNumber);
  assert.ok(row);
  const cancelled = await call('POST', `/affiliates/admin/commissions/${row.id}/cancel`, { reason: 'fraud' }, { token: t.admin });
  assert.equal(cancelled.body.data.status, 'reversed');
  assert.equal((await m.User.findById(t.owner._id).lean()).pointsBalance, before);

  const overview = await call('GET', '/affiliates/admin/overview', undefined, { token: t.admin });
  assert.equal(overview.status, 200);
  assert.equal(overview.body.data.affiliates.active, 1);

  const blocked = await call('PATCH', `/affiliates/admin/affiliates/${list.body.data[0].id}`, { status: 'blocked' }, { token: t.admin });
  assert.equal(blocked.body.data.status, 'blocked');
  const next = await placeOrder(t.buyer2);
  assert.equal(await m.svc.attachAffiliateToOrder(next, 'MONA2026'), null);
});
