/**
 * Seller Center security — staff permissions, 2-step sign-in, forgot / reset / change password,
 * sign out everywhere (session versions) and the activity log. Skips when MongoDB is down.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';

const MONGO_BASE = (process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/marketplus').replace(/\/[^/?]*(\?.*)?$/, '');
const TEST_DB_URI = `${MONGO_BASE}/marketplus_marketplace_security_test`;
const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex');

let mongoose;
let api;
let apiUrl;
let skip = false;
let User;
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
  return { status: res.status, body: json };
}

before(async () => {
  Object.assign(process.env, {
    NODE_ENV: 'test',
    MONGODB_URI: TEST_DB_URI,
    JWT_SECRET: 'marketplace_security_jwt_secret_at_least_32!',
    CLIENT_URL: 'http://client.test',
  });
  delete process.env.MEILI_HOST;
  delete process.env.SMTP_HOST;

  mongoose = (await import('mongoose')).default;
  try {
    await mongoose.connect(TEST_DB_URI, { serverSelectionTimeoutMS: 2000 });
  } catch {
    skip = true;
    return;
  }
  await mongoose.connection.dropDatabase();
  ({ default: User } = await import('../src/models/User.js'));
  const { default: app } = await import('../src/app.js');

  api = await new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
  apiUrl = `http://127.0.0.1:${api.address().port}/api`;

  const apply = await call('POST', '/sellers/apply', {
    nameAr: 'متجر آمن', nameEn: 'Safe Store', contactName: 'Laila', email: 'laila@sec.test',
    phone: '+201044440000', password: 'ownerpass123', city: 'Cairo', acceptTerms: true,
  });
  t.ownerToken = apply.body.token;
});

after(async () => {
  if (mongoose?.connection?.readyState === 1) {
    if (!skip) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
  api?.close();
});

test('staff only reach the areas the owner allowed', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const weak = await call('POST', '/seller/team', { name: 'Omar', email: 'omar@sec.test', password: 'password' }, t.ownerToken);
  assert.equal(weak.status, 400, 'passwords need letters and numbers');

  const add = await call('POST', '/seller/team', { name: 'Omar', email: 'omar@sec.test', password: 'staffpass123', permissions: ['orders'] }, t.ownerToken);
  assert.equal(add.status, 201, JSON.stringify(add.body));
  assert.deepEqual(add.body.data.permissions, ['orders']);
  t.staffId = add.body.data._id;

  const login = await call('POST', '/auth/seller-login', { email: 'omar@sec.test', password: 'staffpass123' });
  assert.equal(login.status, 200);
  t.staffToken = login.body.token;

  assert.equal((await call('GET', '/seller/shipments', null, t.staffToken)).status, 200);
  assert.equal((await call('GET', '/seller/products', null, t.staffToken)).status, 403);
  assert.equal((await call('GET', '/seller/finance', null, t.staffToken)).status, 403);
  assert.equal((await call('GET', '/seller/activity', null, t.staffToken)).status, 403, 'activity log is owner-only');
  const me = await call('GET', '/seller/me', null, t.staffToken);
  assert.deepEqual(me.body.data.user.permissions, ['orders']);
  const home = await call('GET', '/seller/home', null, t.staffToken);
  assert.equal(home.body.data.balance, null, 'no money figures without finance');

  await call('PUT', `/seller/team/${t.staffId}`, { permissions: ['orders', 'products'] }, t.ownerToken);
  assert.equal((await call('GET', '/seller/products', null, t.staffToken)).status, 200);
});

test('deactivating a staff login ends its sessions immediately', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  await call('PUT', `/seller/team/${t.staffId}`, { isActive: false }, t.ownerToken);
  assert.equal((await call('GET', '/seller/shipments', null, t.staffToken)).status, 401);
});

test('2-step sign-in asks for an emailed code', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const wrongPw = await call('PUT', '/seller/me/two-factor', { enabled: true, currentPassword: 'nope' }, t.ownerToken);
  assert.equal(wrongPw.status, 400);
  const on = await call('PUT', '/seller/me/two-factor', { enabled: true, currentPassword: 'ownerpass123' }, t.ownerToken);
  assert.equal(on.body.data.twoFactorEnabled, true);

  const step1 = await call('POST', '/auth/seller-login', { email: 'laila@sec.test', password: 'ownerpass123' });
  assert.equal(step1.status, 200);
  assert.equal(step1.body.twoFactorRequired, true);
  assert.equal(step1.body.token, undefined, 'no token before the code');
  assert.match(step1.body.sentTo, /•/);

  // The code went by email — plant a known one.
  await User.updateOne({ email: 'laila@sec.test' }, { $set: { loginCodeHash: sha256('123456'), loginCodeExpires: new Date(Date.now() + 60000) } });
  assert.equal((await call('POST', '/auth/seller-login/verify', { challenge: step1.body.challenge, code: '000000' })).status, 400);
  const ok = await call('POST', '/auth/seller-login/verify', { challenge: step1.body.challenge, code: '123456' });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.ok(ok.body.token);
  assert.equal((await call('POST', '/auth/seller-login/verify', { challenge: step1.body.challenge, code: '123456' })).status, 401, 'codes are single-use');

  const sec = await call('GET', '/seller/me/security', null, ok.body.token);
  assert.equal(sec.body.data.twoFactorEnabled, true);
  assert.ok(sec.body.data.loginHistory.length >= 1);
  await call('PUT', '/seller/me/two-factor', { enabled: false, currentPassword: 'ownerpass123' }, ok.body.token);
});

test('changing the password signs out other devices', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const other = (await call('POST', '/auth/seller-login', { email: 'laila@sec.test', password: 'ownerpass123' })).body.token;
  const res = await call('PUT', '/seller/me/password', { currentPassword: 'ownerpass123', newPassword: 'newpass2026' }, t.ownerToken);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal((await call('GET', '/seller/me', null, other)).status, 401);
  assert.equal((await call('GET', '/seller/me', null, t.ownerToken)).status, 401);
  t.ownerToken = res.body.token;
  assert.equal((await call('GET', '/seller/me', null, t.ownerToken)).status, 200);

  const all = await call('POST', '/seller/me/sign-out-everywhere', null, t.ownerToken);
  assert.equal((await call('GET', '/seller/me', null, t.ownerToken)).status, 401);
  t.ownerToken = all.body.token;
  assert.equal((await call('GET', '/seller/me', null, t.ownerToken)).status, 200);
});

test('forgot / reset password', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const unknown = await call('POST', '/auth/seller/forgot-password', { email: 'nobody@sec.test' });
  const known = await call('POST', '/auth/seller/forgot-password', { email: 'laila@sec.test' });
  assert.equal(unknown.status, 200);
  assert.deepEqual(unknown.body, known.body, 'the answer never reveals which emails exist');
  const saved = await User.findOne({ email: 'laila@sec.test' }).select('+resetPasswordToken').lean();
  assert.ok(saved.resetPasswordToken);

  await User.updateOne({ email: 'laila@sec.test' }, { $set: { resetPasswordToken: sha256('reset-me') } });
  assert.equal((await call('POST', '/auth/seller/reset-password', { token: 'reset-me', password: 'short' })).status, 400);
  assert.equal((await call('POST', '/auth/seller/reset-password', { token: 'wrong', password: 'brandnew2026' })).status, 400);
  const reset = await call('POST', '/auth/seller/reset-password', { token: 'reset-me', password: 'brandnew2026' });
  assert.equal(reset.status, 200, JSON.stringify(reset.body));
  assert.equal((await call('GET', '/seller/me', null, t.ownerToken)).status, 401, 'old sessions end');
  assert.equal((await call('POST', '/auth/seller/reset-password', { token: 'reset-me', password: 'brandnew2026' })).status, 400, 'links are single-use');
  t.ownerToken = reset.body.token;
});

test('activity log shows who did what', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const res = await call('GET', '/seller/activity?limit=50', null, t.ownerToken);
  assert.equal(res.status, 200);
  const actions = res.body.data.map((a) => a.action);
  for (const a of ['team.add', 'team.update', 'security.2fa_on', 'security.password_change', 'security.sign_out_all', 'security.password_reset', 'security.login']) {
    assert.ok(actions.includes(a), `missing ${a}`);
  }
  const team = await call('GET', '/seller/activity?area=team', null, t.ownerToken);
  assert.ok(team.body.data.every((a) => a.action.startsWith('team.')));
  assert.equal(team.body.data.find((a) => a.action === 'team.add').actorName, 'Laila');
});
