/**
 * Homepage builder API — visibility rules on the public response, live preview
 * and duplicate. Skips itself when MongoDB is not reachable.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

const MONGO_BASE = (process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/marketplus').replace(/\/[^/?]*(\?.*)?$/, '');
const TEST_DB_URI = `${MONGO_BASE}/marketplus_homepage_sections_test`;

let mongoose;
let api;
let apiUrl;
let skip = false;
let HomepageSection;
let clearCache;
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
    JWT_SECRET: 'homepage_sections_jwt_secret_at_least_32_chars',
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
  ({ default: HomepageSection } = await import('../src/models/HomepageSection.js'));
  ({ clearPublicHomepageCache: clearCache } = await import('../src/controllers/homepageSection.controller.js'));
  const { default: app } = await import('../src/app.js');
  const { generateToken } = await import('../src/utils/generateToken.js');

  api = await new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
  apiUrl = `http://127.0.0.1:${api.address().port}/api`;

  const admin = await User.create({ name: 'Admin', username: 'admin_home', role: 'super_admin', password: 'adminpass123' });
  t.admin = generateToken(admin._id);
  const customer = await User.create({ name: 'Customer', phone: '+201011112222' });
  t.customer = generateToken(customer._id);
});

after(async () => {
  if (mongoose?.connection?.readyState === 1) {
    if (!skip) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
  api?.close();
});

const base = (o) => ({ type: 'rich_text_block', titleEn: 'Block', seoContent: { bodyEn: 'Hello', bodyAr: 'مرحبا' }, ...o });

test('only staff can use the builder endpoints', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  assert.equal((await call('POST', '/homepage-sections/admin/preview', base())).status, 401);
  assert.equal((await call('POST', '/homepage-sections/admin/preview', base(), t.customer)).status, 403);
});

test('visibility and appearance are saved, and the public response honours the schedule', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  await HomepageSection.deleteMany({});

  const live = await call('POST', '/homepage-sections/admin', base({
    titleEn: 'Live',
    sortOrder: 10,
    adminLabel: 'Main text',
    adminNotes: 'internal only',
    visibility: { audience: 'guests', devices: 'mobile', zones: ['z1'] },
    appearance: { background: 'soft', spaceAbove: 'md', anchor: 'Hello There' },
  }), t.admin);
  assert.equal(live.status, 201);
  assert.equal(live.body.data.visibility.audience, 'guests');
  assert.equal(live.body.data.visibility.devices, 'mobile');
  assert.equal(live.body.data.appearance.anchor, 'hello-there');
  assert.equal(live.body.data.adminLabel, 'Main text');

  const future = await call('POST', '/homepage-sections/admin', base({
    titleEn: 'Future',
    sortOrder: 20,
    visibility: { startsAt: '2099-01-01T10:00' },
  }), t.admin);
  assert.equal(future.status, 201);
  const ended = await call('POST', '/homepage-sections/admin', base({
    titleEn: 'Ended',
    sortOrder: 30,
    visibility: { startsAt: '2020-01-01T10:00', endsAt: '2020-02-01T10:00' },
  }), t.admin);
  assert.equal(ended.status, 201);

  const bad = await call('POST', '/homepage-sections/admin', base({
    visibility: { startsAt: '2030-01-02T10:00', endsAt: '2030-01-01T10:00' },
  }), t.admin);
  assert.equal(bad.status, 400);

  clearCache();
  const pub = await call('GET', '/homepage-sections');
  assert.deepEqual(pub.body.data.map((s) => s.titleEn), ['Live']);
  const [section] = pub.body.data;
  assert.equal(section.adminNotes, undefined, 'admin notes never reach the storefront');
  assert.equal(section.adminLabel, undefined);
  assert.equal(section.visibility.audience, 'guests', 'the browser needs the audience rule');

  const admin = await call('GET', '/homepage-sections/admin', null, t.admin);
  assert.equal(admin.body.data.length, 3, 'the admin still sees scheduled and ended sections');
});

test('the legacy mobile toggle and the device rule stay in sync', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const created = await call('POST', '/homepage-sections/admin', base({ titleEn: 'Sync' }), t.admin);
  const id = created.body.data._id;
  const off = await call('PUT', `/homepage-sections/admin/${id}`, { showOnMobile: false }, t.admin);
  assert.equal(off.body.data.visibility.devices, 'desktop');
  const mobile = await call('PUT', `/homepage-sections/admin/${id}`, { visibility: { ...off.body.data.visibility, devices: 'mobile' } }, t.admin);
  assert.equal(mobile.body.data.showOnMobile, true);
  assert.equal(mobile.body.data.visibility.devices, 'mobile');
});

test('preview renders an unsaved section without writing anything', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const before = await HomepageSection.countDocuments();
  const res = await call('POST', '/homepage-sections/admin/preview', base({ titleEn: 'Draft' }), t.admin);
  assert.equal(res.status, 200);
  assert.equal(res.body.data.titleEn, 'Draft');
  assert.equal(res.body.data.seoContent.bodyEn, 'Hello');
  assert.equal(await HomepageSection.countDocuments(), before);
  assert.equal((await call('POST', '/homepage-sections/admin/preview', { type: 'nope' }, t.admin)).status, 400);
});

test('duplicate puts a hidden copy right below the original', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  await HomepageSection.deleteMany({});
  const a = await call('POST', '/homepage-sections/admin', base({ titleEn: 'A', sortOrder: 10, adminLabel: 'First', appearance: { anchor: 'first' } }), t.admin);
  await call('POST', '/homepage-sections/admin', base({ titleEn: 'B', sortOrder: 20 }), t.admin);

  const dup = await call('POST', `/homepage-sections/admin/${a.body.data._id}/duplicate`, null, t.admin);
  assert.equal(dup.status, 201);
  const list = dup.body.data;
  assert.deepEqual(list.map((s) => s.titleEn), ['A', 'A', 'B']);
  assert.deepEqual(list.map((s) => s.sortOrder), [10, 20, 30]);
  const copy = list.find((s) => s._id === dup.body.createdId);
  assert.equal(copy.isActive, false);
  assert.equal(copy.adminLabel, 'First (copy)');
  assert.equal(copy.appearance.anchor, '', 'anchors stay unique');

  const deal = await HomepageSection.create({ type: 'daily_offers', titleEn: 'Deals' });
  const refused = await call('POST', `/homepage-sections/admin/${deal._id}/duplicate`, null, t.admin);
  assert.equal(refused.status, 400);
  assert.equal((await call('POST', '/homepage-sections/admin/000000000000000000000000/duplicate', null, t.admin)).status, 404);
});
