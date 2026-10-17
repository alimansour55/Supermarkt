/**
 * Staff support for seller logins and the admin seller profile editor: temporary passwords
 * (forced change), sign out everywhere, turn off/on, lockout + unlock, 2-step reset, email
 * change, team add/remove, owner transfer, profile/bank edits with change history.
 * Skips itself when MongoDB is not reachable.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

const MONGO_BASE = (process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/marketplus').replace(/\/[^/?]*(\?.*)?$/, '');
const TEST_DB_URI = `${MONGO_BASE}/marketplus_marketplace_access_test`;

let mongoose;
let api;
let apiUrl;
let skip = false;
let User;
let AuditLog;
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

const signIn = (email, password) => call('POST', '/auth/seller-login', { email, password });

before(async () => {
  Object.assign(process.env, {
    NODE_ENV: 'test',
    MONGODB_URI: TEST_DB_URI,
    JWT_SECRET: 'marketplace_access_jwt_secret_at_least_32_chars',
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
  ({ default: User } = await import('../src/models/User.js'));
  ({ default: AuditLog } = await import('../src/models/AuditLog.js'));
  const { default: Seller } = await import('../src/models/Seller.js');
  const { default: app } = await import('../src/app.js');
  const { generateToken } = await import('../src/utils/generateToken.js');

  api = await new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
  apiUrl = `http://127.0.0.1:${api.address().port}/api`;

  const superAdmin = await User.create({ name: 'Boss', username: 'boss_access', role: 'super_admin', password: 'adminpass123' });
  t.superToken = generateToken(superAdmin._id);
  const manager = await User.create({
    name: 'Mona', username: 'mona_access', role: 'manager', password: 'adminpass123',
    permissions: ['sellers:read', 'sellers:write'],
  });
  t.managerToken = generateToken(manager._id);

  t.seller = await Seller.create({
    nameAr: 'متجر', nameEn: 'Shop', slug: 'access-shop', status: 'active', email: 'shop@x.test',
    bank: { bankName: 'CIB', accountName: 'Shop', accountNumber: '1234567890' },
    vacation: { enabled: true, startedAt: new Date() },
  });
  t.owner = await User.create({ name: 'Owner', email: 'owner@x.test', password: 'sellerpass123', role: 'seller_owner', seller: t.seller._id });
  t.seller.owner = t.owner._id;
  await t.seller.save();
  t.base = `/admin/marketplace/sellers/${t.seller._id}`;
});

after(async () => {
  if (mongoose?.connection?.readyState === 1) {
    if (!skip) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
  api?.close();
});

test('temporary password: sign-in works, change is required, old sessions die', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const first = await signIn('owner@x.test', 'sellerpass123');
  assert.equal(first.status, 200);
  const oldToken = first.body.token;

  const weak = await call('POST', `${t.base}/users/${t.owner._id}/password`, { password: 'short' }, t.managerToken);
  assert.equal(weak.status, 400);
  const set = await call('POST', `${t.base}/users/${t.owner._id}/password`, { password: 'Temp12345' }, t.managerToken);
  assert.equal(set.status, 200);
  assert.equal(set.body.data.find((u) => String(u._id) === String(t.owner._id)).mustChangePassword, true);

  assert.equal((await call('GET', '/seller/me', null, oldToken)).status, 401, 'old device signed out');
  assert.equal((await signIn('owner@x.test', 'sellerpass123')).status, 401, 'old password gone');
  const next = await signIn('owner@x.test', 'Temp12345');
  assert.equal(next.status, 200);
  assert.equal(next.body.user.mustChangePassword, true);
  const me = await call('GET', '/seller/me', null, next.body.token);
  assert.equal(me.body.data.user.mustChangePassword, true);

  const changed = await call('PUT', '/seller/me/password', { currentPassword: 'Temp12345', newPassword: 'MyOwn12345' }, next.body.token);
  assert.equal(changed.status, 200);
  assert.equal(changed.body.user.mustChangePassword, false);
  t.ownerPassword = 'MyOwn12345';
});

test('lockout after repeated wrong passwords; staff unlock', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const { MAX_PASSWORD_ATTEMPTS } = await import('../src/controllers/sellerAuth.controller.js');
  for (let i = 0; i < MAX_PASSWORD_ATTEMPTS; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    assert.equal((await signIn('owner@x.test', 'wrongpass1')).status, 401);
  }
  const locked = await signIn('owner@x.test', t.ownerPassword);
  assert.equal(locked.status, 429, 'even the right password waits while locked');

  const team = await call('GET', t.base, null, t.managerToken);
  const row = team.body.data.team.find((u) => String(u._id) === String(t.owner._id));
  assert.ok(row.lockedUntil, 'staff see the lock');

  assert.equal((await call('PUT', `${t.base}/users/${t.owner._id}`, { unlock: true }, t.managerToken)).status, 200);
  assert.equal((await signIn('owner@x.test', t.ownerPassword)).status, 200);
});

test('turn off / on, sign out everywhere, 2-step reset, email change', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const session = (await signIn('owner@x.test', t.ownerPassword)).body.token;
  assert.equal((await call('POST', `${t.base}/users/${t.owner._id}/sign-out`, {}, t.managerToken)).status, 200);
  assert.equal((await call('GET', '/seller/me', null, session)).status, 401);

  assert.equal((await call('PUT', `${t.base}/users/${t.owner._id}`, { isActive: false }, t.managerToken)).status, 200);
  assert.equal((await signIn('owner@x.test', t.ownerPassword)).status, 401);
  assert.equal((await call('POST', `${t.base}/users/${t.owner._id}/password`, { password: 'Temp99999' }, t.managerToken)).status, 400, 'turned-off login');
  assert.equal((await call('PUT', `${t.base}/users/${t.owner._id}`, { isActive: true }, t.managerToken)).status, 200);

  await User.updateOne({ _id: t.owner._id }, { $set: { twoFactorEnabled: true } });
  assert.equal((await call('PUT', `${t.base}/users/${t.owner._id}`, { twoFactorEnabled: true }, t.managerToken)).status, 200, 'no-op when already on');
  const off = await call('PUT', `${t.base}/users/${t.owner._id}`, { twoFactorEnabled: false }, t.managerToken);
  assert.equal(off.body.data.find((u) => u.role === 'seller_owner').twoFactorEnabled, false);

  await User.create({ name: 'Other', email: 'taken@x.test', phone: '+201011112222' });
  assert.equal((await call('PUT', `${t.base}/users/${t.owner._id}`, { email: 'taken@x.test' }, t.managerToken)).status, 409);
  assert.equal((await call('PUT', `${t.base}/users/${t.owner._id}`, { email: 'new-owner@x.test' }, t.managerToken)).status, 200);
  assert.equal((await signIn('new-owner@x.test', t.ownerPassword)).status, 200);
});

test('team: add with invite or password, permissions, owner transfer, remove', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const invited = await call('POST', `${t.base}/users`, { name: 'Mai', email: 'mai@x.test', permissions: ['orders'] }, t.managerToken);
  assert.equal(invited.status, 201);
  assert.ok(invited.body.access.setupUrl.includes('/seller-center/reset-password/'));
  const mai = invited.body.data.find((u) => u.email === 'mai@x.test');
  assert.equal(mai.role, 'seller_staff');
  assert.deepEqual(mai.permissions, ['orders']);

  const withPw = await call('POST', `${t.base}/users`, { name: 'Sara', email: 'sara@x.test', password: 'Sara12345' }, t.managerToken);
  assert.equal(withPw.status, 201);
  const sara = withPw.body.data.find((u) => u.email === 'sara@x.test');
  assert.equal(sara.mustChangePassword, true);

  const perms = await call('PUT', `${t.base}/users/${mai._id}`, { permissions: ['orders', 'products'] }, t.managerToken);
  assert.deepEqual(perms.body.data.find((u) => u.email === 'mai@x.test').permissions, ['orders', 'products']);
  assert.equal((await call('PUT', `${t.base}/users/${t.owner._id}`, { permissions: ['orders'] }, t.managerToken)).status, 400);

  assert.equal((await call('DELETE', `${t.base}/users/${t.owner._id}`, null, t.managerToken)).status, 400, 'owner cannot be removed');
  const moved = await call('POST', `${t.base}/owner`, { userId: sara._id }, t.managerToken);
  assert.equal(moved.status, 200);
  const roles = Object.fromEntries(moved.body.data.map((u) => [u.email, u.role]));
  assert.equal(roles['sara@x.test'], 'seller_owner');
  assert.equal(roles['new-owner@x.test'], 'seller_staff');
  const { default: Seller } = await import('../src/models/Seller.js');
  assert.equal(String((await Seller.findById(t.seller._id)).owner), String(sara._id));

  assert.equal((await call('DELETE', `${t.base}/users/${mai._id}`, null, t.managerToken)).status, 200);
  assert.equal(await User.countDocuments({ email: 'mai@x.test' }), 0);

  const other = await User.create({ name: 'X', email: 'x-other@x.test', password: 'sellerpass123', role: 'seller_owner' });
  assert.equal((await call('PUT', `${t.base}/users/${other._id}`, { isActive: false }, t.managerToken)).status, 404, 'only this seller\'s logins');
});

test('profile edit: contact, address, vacation off, bank needs super admin, history logged', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const bad = await call('PUT', t.base, { phone: 'abc' }, t.managerToken);
  assert.equal(bad.status, 400);

  const res = await call('PUT', t.base, {
    contactName: 'Hany', phone: '01012345678', email: 'store@x.test',
    address: { street: '1 Nile St', city: 'Giza', governorate: 'Giza' },
    vacationOff: true, commissionRate: 7,
  }, t.managerToken);
  assert.equal(res.status, 200);
  assert.equal(res.body.data.address.city, 'Giza');
  assert.equal(res.body.data.vacation?.enabled, false);

  assert.equal((await call('PUT', t.base, { bank: { iban: 'EG000111' } }, t.managerToken)).status, 403);
  assert.equal((await call('PUT', t.base, { bank: { iban: 'EG3800190005000000263180002' } }, t.superToken)).status, 200);

  const logs = await AuditLog.find({ entityType: 'seller', entityId: t.seller._id, action: 'update' }).sort({ createdAt: 1 }).lean();
  const all = Object.assign({}, ...logs.map((l) => l.changes || {}));
  assert.deepEqual(all.commissionRate, { from: null, to: 7 });
  assert.equal(all['address.city'].to, 'Giza');
  assert.ok(all['bank.iban'].to.startsWith('••••'), 'bank numbers are masked in the log');
  assert.ok(all['login.password_set'], 'login actions are in the same history');
});

test('create seller: English name optional; problems come back per field in both languages', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const base = { nameAr: 'متجر عربي', contactName: 'Hany', email: 'arabic-only@x.test', phone: '01055556666', city: 'Cairo' };
  const ok = await call('POST', '/admin/marketplace/sellers', base, t.managerToken);
  assert.equal(ok.status, 201, ok.text);
  assert.equal(ok.body.data.nameEn, 'متجر عربي', 'Arabic name used when English is empty');
  assert.ok(ok.body.data.slug, 'a slug is still generated');

  const dup = await call('POST', '/admin/marketplace/sellers', { ...base, nameAr: 'متجر ثاني', phone: '01055556667' }, t.managerToken);
  assert.equal(dup.status, 409);
  assert.equal(dup.body.fields[0].field, 'email');
  assert.match(dup.body.fields[0].ar, /مستخدم لحساب آخر/);

  const bad = await call('POST', '/admin/marketplace/sellers', { nameAr: 'م', email: 'nope', phone: 'x', city: '', password: 'abcdefgh' }, t.managerToken);
  assert.equal(bad.status, 400);
  assert.deepEqual(bad.body.fields.map((f) => f.field).sort(), ['city', 'contactName', 'email', 'nameAr', 'password', 'phone']);
});
