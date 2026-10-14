/**
 * Admin customers page (/admin/users): search, suspension, edits and delete-vs-anonymize.
 * DB tests run against a throwaway MongoDB database and skip themselves when it is not reachable.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

const MONGO_BASE = (process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/marketplus').replace(/\/[^/?]*(\?.*)?$/, '');
const TEST_DB_URI = `${MONGO_BASE}/marketplus_admin_users_test`;
process.env.JWT_SECRET ||= 'admin-users-test-secret';

let mongoose;
let skip = false;
let ctrl;
let protect;
let generateToken;
let User;
let Order;
let WalletTransaction;
let admin;
let phoneSeq = 10000000;
let orderSeq = 1;

const nextPhone = () => `+20100${String(phoneSeq++).slice(-7)}`;
/** Bare order rows for aggregation tests — skip full Order validation. */
const rawOrder = (fields) => ({ orderNumber: `T-${orderSeq++}`, ...fields });

before(async () => {
  ctrl = await import('../src/controllers/user.controller.js');
  mongoose = (await import('mongoose')).default;
  try {
    await mongoose.connect(TEST_DB_URI, { serverSelectionTimeoutMS: 2000 });
  } catch {
    skip = true;
    return;
  }
  await mongoose.connection.dropDatabase();
  ({ protect } = await import('../src/middleware/auth.js'));
  ({ generateToken } = await import('../src/utils/generateToken.js'));
  ({ default: User } = await import('../src/models/User.js'));
  ({ default: Order } = await import('../src/models/Order.js'));
  ({ default: WalletTransaction } = await import('../src/models/WalletTransaction.js'));
  await User.syncIndexes();
  admin = await User.create({ name: 'Boss', username: 'boss', role: 'super_admin', password: 'secret123' });
});

after(async () => {
  if (mongoose?.connection?.readyState === 1) {
    if (!skip) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});

/** Run an asyncHandler-wrapped controller and resolve with { status, body } or the thrown error. */
function call(handler, { params = {}, body = {}, query = {} } = {}) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(payload) { resolve({ status: this.statusCode, body: payload }); },
    };
    handler({ params, body, query, user: admin, headers: {} }, res, (err) => resolve({ error: err }));
  });
}

function runProtect(token) {
  return new Promise((resolve) => {
    const req = { headers: { authorization: `Bearer ${token}` }, cookies: {} };
    protect(req, {}, (err) => resolve({ err, user: req.user }));
  });
}

const customer = (extra = {}) => User.create({ name: 'Mona', phone: nextPhone(), ...extra });

// ── Pure search helper ─────────────────────────────────────────────────────

test('search treats regex characters literally', () => {
  const conditions = ctrl.buildUserSearchConditions('a(b');
  assert.equal(conditions[0].name.$regex, 'a\\(b');
  assert.doesNotThrow(() => new RegExp(conditions[0].name.$regex));
});

test('a full local phone number matches the stored +20 form', () => {
  const conditions = ctrl.buildUserSearchConditions('0100 123 4567');
  assert.ok(conditions.some((c) => c.phone === '+201001234567'));
});

test('a partial local number drops the leading 0', () => {
  const conditions = ctrl.buildUserSearchConditions('0100');
  assert.ok(conditions.some((c) => c.phone?.$regex === '100'));
});

test('blank search adds no conditions', () => {
  assert.equal(ctrl.buildUserSearchConditions('   '), null);
});

// ── Suspension ─────────────────────────────────────────────────────────────

test('protect rejects a suspended account even with a valid token', async (t) => {
  if (skip) return t.skip('MongoDB not reachable');
  const u = await customer();
  const token = generateToken(u._id, { sv: u.sessionVersion });
  assert.ok((await runProtect(token)).user);

  await User.updateOne({ _id: u._id }, { isActive: false });
  const { err } = await runProtect(token);
  assert.equal(err?.statusCode, 403);
});

test('suspending from the panel signs the user out of every device', async (t) => {
  if (skip) return t.skip('MongoDB not reachable');
  const u = await customer();
  const token = generateToken(u._id, { sv: u.sessionVersion });

  const res = await call(ctrl.updateAdminUser, { params: { id: u._id }, body: { isActive: false } });
  assert.equal(res.status, 200);
  await User.updateOne({ _id: u._id }, { isActive: true }); // reactivated, but the old token stays dead
  assert.equal((await runProtect(token)).err?.statusCode, 401);
});

test('bulk suspend bumps the session version only for accounts that change', async (t) => {
  if (skip) return t.skip('MongoDB not reachable');
  const active = await customer();
  const already = await customer({ isActive: false, sessionVersion: 3 });

  const res = await call(ctrl.bulkAdminUsers, { body: { ids: [active._id, already._id], action: 'suspend' } });
  assert.equal(res.body.affected, 1);
  assert.equal((await User.findById(active._id)).sessionVersion, 1);
  assert.equal((await User.findById(already._id)).sessionVersion, 3);
});

// ── Edits ──────────────────────────────────────────────────────────────────

test('editing a phone normalizes it and rejects duplicates', async (t) => {
  if (skip) return t.skip('MongoDB not reachable');
  const a = await customer({ isPhoneVerified: true });
  const b = await customer();

  const ok = await call(ctrl.updateAdminUser, { params: { id: a._id }, body: { phone: '01112223334' } });
  assert.equal(ok.body.data.phone, '+201112223334');
  assert.equal(ok.body.data.isPhoneVerified, false);

  const dup = await call(ctrl.updateAdminUser, { params: { id: b._id }, body: { phone: '01112223334' } });
  assert.equal(dup.error?.statusCode, 409);

  const bad = await call(ctrl.updateAdminUser, { params: { id: b._id }, body: { phone: '123' } });
  assert.equal(bad.error?.statusCode, 400);
});

test('the customers page cannot hand out staff roles', async (t) => {
  if (skip) return t.skip('MongoDB not reachable');
  const u = await customer();
  const promote = await call(ctrl.updateAdminUser, { params: { id: u._id }, body: { role: 'admin' } });
  assert.equal(promote.error?.statusCode, 400);

  const driver = await call(ctrl.updateAdminUser, { params: { id: u._id }, body: { role: 'driver' } });
  assert.equal(driver.body.data.role, 'driver');
});

// ── Delete vs anonymize ────────────────────────────────────────────────────

test('a customer with no history is deleted outright', async (t) => {
  if (skip) return t.skip('MongoDB not reachable');
  const u = await customer();
  const res = await call(ctrl.deleteAdminUser, { params: { id: u._id } });
  assert.equal(res.body.outcome, 'deleted');
  assert.equal(await User.findById(u._id), null);
});

test('a customer with orders is anonymized and leaves the list', async (t) => {
  if (skip) return t.skip('MongoDB not reachable');
  const u = await customer({ email: 'mona@example.com', addresses: [{ street: 'Nile St', city: 'Cairo' }] });
  await Order.collection.insertOne(rawOrder({ user: u._id, total: 100, orderStatus: 'delivered' }));

  const res = await call(ctrl.deleteAdminUser, { params: { id: u._id } });
  assert.equal(res.body.outcome, 'anonymized');

  const kept = await User.findById(u._id);
  assert.equal(kept.name, 'Deleted customer');
  assert.equal(kept.phone, undefined);
  assert.equal(kept.email, undefined);
  assert.equal(kept.addresses.length, 0);
  assert.equal(kept.isActive, false);
  assert.ok(kept.deletedAt);

  const list = await call(ctrl.getAdminUsers, { query: {} });
  assert.ok(!list.body.data.some((row) => String(row._id) === String(u._id)));
});

test('a customer with wallet balance cannot be deleted; bulk delete skips them', async (t) => {
  if (skip) return t.skip('MongoDB not reachable');
  const rich = await customer({ walletBalance: 50 });
  const plain = await customer();

  const one = await call(ctrl.deleteAdminUser, { params: { id: rich._id } });
  assert.equal(one.error?.statusCode, 400);

  const bulk = await call(ctrl.bulkAdminUsers, { body: { ids: [rich._id, plain._id], action: 'delete' } });
  assert.equal(bulk.body.deleted, 1);
  assert.equal(bulk.body.skipped.length, 1);
  assert.ok(await User.findById(rich._id));
});

test('seller logins cannot be deleted from the customers page', async (t) => {
  if (skip) return t.skip('MongoDB not reachable');
  const seller = await User.create({ name: 'Shop owner', email: 'owner@shop.test', role: 'seller_owner' });
  const res = await call(ctrl.deleteAdminUser, { params: { id: seller._id } });
  assert.equal(res.error?.statusCode, 400);
  assert.ok(await User.findById(seller._id));
});

test('wallet history alone is enough to anonymize instead of delete', async (t) => {
  if (skip) return t.skip('MongoDB not reachable');
  const u = await customer();
  await WalletTransaction.collection.insertOne({ user: u._id, amount: 10, type: 'credit' });
  const res = await call(ctrl.deleteAdminUser, { params: { id: u._id } });
  assert.equal(res.body.outcome, 'anonymized');
});

// ── List rollup ────────────────────────────────────────────────────────────

test('lifetime spend leaves out cancelled and returned orders', async (t) => {
  if (skip) return t.skip('MongoDB not reachable');
  const u = await customer({ name: 'Spender Sam' });
  await Order.collection.insertMany([
    rawOrder({ user: u._id, total: 200, orderStatus: 'delivered' }),
    rawOrder({ user: u._id, total: 999, orderStatus: 'cancelled' }),
    rawOrder({ user: u._id, total: 500, orderStatus: 'returned' }),
  ]);

  const list = await call(ctrl.getAdminUsers, { query: { q: 'Spender' } });
  const row = list.body.data.find((r) => String(r._id) === String(u._id));
  assert.equal(row.orderCount, 3);
  assert.equal(row.totalSpent, 200);
});

test('searching by local phone finds the stored +20 number', async (t) => {
  if (skip) return t.skip('MongoDB not reachable');
  const u = await customer({ phone: '+201223334445' });
  const list = await call(ctrl.getAdminUsers, { query: { q: '01223334445' } });
  assert.ok(list.body.data.some((r) => String(r._id) === String(u._id)));
  const odd = await call(ctrl.getAdminUsers, { query: { q: '(' } });
  assert.equal(odd.status, 200);
});

// ── Segments, stat sorting, summary, export, bulk extras ───────────────────

test('segment stat conditions', () => {
  const now = Date.UTC(2026, 9, 14);
  assert.deepEqual(ctrl.buildSegmentStatsMatch('vip', now), { totalSpent: { $gte: 5000 } });
  assert.deepEqual(ctrl.buildSegmentStatsMatch('no_orders', now), { orderCount: 0 });
  const atRisk = ctrl.buildSegmentStatsMatch('at_risk', now);
  assert.equal(atRisk.lastOrderAt.$lt.getTime(), now - 60 * 24 * 60 * 60 * 1000);
  assert.equal(ctrl.buildSegmentStatsMatch('wallet', now), null);
});

test('list filter ignores operator objects smuggled in the role param', () => {
  const filter = ctrl.buildUserListFilter({ role: { $ne: 'x' } });
  assert.equal(typeof filter.role, 'string');
});

test('segments and stat sorting work across pages', async (t) => {
  if (skip) return t.skip('MongoDB not reachable');
  const tag = `Seg${Date.now()}`;
  const big = await customer({ name: `${tag} big` });
  const small = await customer({ name: `${tag} small` });
  const idle = await customer({ name: `${tag} idle` });
  const fresh = await customer({ name: `${tag} fresh` });
  const old = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  await Order.collection.insertMany([
    rawOrder({ user: big._id, total: 6000, orderStatus: 'delivered', createdAt: new Date() }),
    rawOrder({ user: small._id, total: 100, orderStatus: 'delivered', createdAt: new Date() }),
    rawOrder({ user: small._id, total: 300, orderStatus: 'delivered', createdAt: new Date() }),
    rawOrder({ user: idle._id, total: 50, orderStatus: 'delivered', createdAt: old }),
  ]);

  const ids = (res) => res.body.data.map((r) => String(r._id));

  const vip = await call(ctrl.getAdminUsers, { query: { q: tag, segment: 'vip' } });
  assert.deepEqual(ids(vip), [String(big._id)]);

  const none = await call(ctrl.getAdminUsers, { query: { q: tag, segment: 'no_orders' } });
  assert.deepEqual(ids(none), [String(fresh._id)]);

  const risk = await call(ctrl.getAdminUsers, { query: { q: tag, segment: 'at_risk' } });
  assert.deepEqual(ids(risk), [String(idle._id)]);

  const bySpend = await call(ctrl.getAdminUsers, { query: { q: tag, sort: 'totalSpent', order: 'desc', limit: 2 } });
  assert.deepEqual(ids(bySpend), [String(big._id), String(small._id)]);
  assert.equal(bySpend.body.pagination.total, 4);
  assert.equal(bySpend.body.data[1].avgOrderValue, 200);
  assert.ok(!('password' in bySpend.body.data[0]));
});

test('summary counts customers who never ordered', async (t) => {
  if (skip) return t.skip('MongoDB not reachable');
  const res = await call(ctrl.getAdminUsersSummary);
  const expected = await User.countDocuments({
    role: 'user', deletedAt: null, _id: { $nin: await Order.distinct('user') },
  });
  assert.equal(res.body.data.noOrders, expected);
  assert.ok(res.body.data.customers >= expected);
});

test('CSV export neutralizes formula-looking names', async (t) => {
  if (skip) return t.skip('MongoDB not reachable');
  await customer({ name: '=HYPERLINK("x")' });
  const sent = await new Promise((resolve) => {
    const res = {
      headers: {},
      setHeader(k, v) { this.headers[k] = v; },
      send(body) { resolve({ headers: this.headers, body }); },
    };
    ctrl.exportAdminUsers({ query: { q: 'HYPERLINK' }, user: admin, headers: {} }, res, (err) => resolve({ err }));
  });
  assert.match(sent.headers['Content-Type'], /text\/csv/);
  assert.match(sent.body, /'=HYPERLINK/);
});

test('bulk sign-out and verify phone', async (t) => {
  if (skip) return t.skip('MongoDB not reachable');
  const u = await customer({ isPhoneVerified: false });
  const out = await call(ctrl.bulkAdminUsers, { body: { ids: [u._id], action: 'signout' } });
  assert.equal(out.body.affected, 1);
  const verify = await call(ctrl.bulkAdminUsers, { body: { ids: [u._id], action: 'verify_phone' } });
  assert.equal(verify.body.affected, 1);
  const after = await User.findById(u._id);
  assert.equal(after.sessionVersion, 1);
  assert.equal(after.isPhoneVerified, true);
});

test('only the owner can delete customers', async (t) => {
  if (skip) return t.skip('MongoDB not reachable');
  const u = await customer();
  const manager = { _id: new mongoose.Types.ObjectId(), role: 'admin', name: 'Admin' };
  const res = await new Promise((resolve) => {
    ctrl.deleteAdminUser(
      { params: { id: u._id }, body: {}, query: {}, user: manager, headers: {} },
      { status() { return this; }, json: (b) => resolve({ body: b }) },
      (err) => resolve({ error: err }),
    );
  });
  assert.equal(res.error?.statusCode, 403);
});

test('detail shows stats, recent orders, notes and activity', async (t) => {
  if (skip) return t.skip('MongoDB not reachable');
  const u = await customer();
  await Order.collection.insertOne(rawOrder({ user: u._id, total: 120, orderStatus: 'delivered', createdAt: new Date() }));
  await call(ctrl.updateAdminUser, { params: { id: u._id }, body: { adminNote: 'Prefers evening delivery' } });

  const res = await call(ctrl.getAdminUserById, { params: { id: u._id } });
  const d = res.body.data;
  assert.equal(d.orderCount, 1);
  assert.equal(d.totalSpent, 120);
  assert.equal(d.recentOrders.length, 1);
  assert.equal(d.adminNote, 'Prefers evening delivery');
  assert.ok(d.activity.some((a) => a.action === 'update'));
});
