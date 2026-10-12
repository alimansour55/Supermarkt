/**
 * Marketplace phase 5 — seller notifications, staff logins, warehouse (inbound) stock for
 * store-fulfilled items and CSV import. Skips itself when MongoDB is not reachable.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

const MONGO_BASE = (process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/marketplus').replace(/\/[^/?]*(\?.*)?$/, '');
const TEST_DB_URI = `${MONGO_BASE}/marketplus_marketplace_ops_test`;

let mongoose;
let api;
let apiUrl;
let skip = false;
let Product;
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
  return { status: res.status, body: json };
}

before(async () => {
  Object.assign(process.env, {
    NODE_ENV: 'test',
    MONGODB_URI: TEST_DB_URI,
    JWT_SECRET: 'marketplace_ops_jwt_secret_at_least_32_chars!',
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
  ({ default: Product } = await import('../src/models/Product.js'));
  ({ default: UserNotification } = await import('../src/models/UserNotification.js'));
  const { default: app } = await import('../src/app.js');
  const { generateToken } = await import('../src/utils/generateToken.js');

  api = await new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
  apiUrl = `http://127.0.0.1:${api.address().port}/api`;

  const admin = await User.create({ name: 'Admin', username: 'admin_ops', role: 'super_admin', password: 'adminpass123' });
  t.adminToken = generateToken(admin._id);
  t.category = await Category.create({ nameAr: 'توابل', nameEn: 'Spices', slug: 'spices-ops', isActive: true });

  const apply = await call('POST', '/sellers/apply', {
    nameAr: 'بهارات الشرق', nameEn: 'East Spices', contactName: 'Hany', email: 'hany@ops.test',
    phone: '+201011110000', password: 'sellerpass123', city: 'Giza', acceptTerms: true,
  });
  t.sellerId = apply.body.seller._id;
  t.ownerToken = apply.body.token;
  t.ownerId = apply.body.user.id;
  await call('PUT', `/admin/marketplace/sellers/${t.sellerId}`, { allowedFulfillment: ['seller', 'store'] }, t.adminToken);
});

after(async () => {
  if (mongoose?.connection?.readyState === 1) {
    if (!skip) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
  api?.close();
});

test('sellers are notified of account decisions and listing reviews', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  await call('POST', `/admin/marketplace/sellers/${t.sellerId}/status`, { status: 'active' }, t.adminToken);
  const created = await call('POST', '/seller/products', {
    nameAr: 'كمون', nameEn: 'Cumin', price: 40, category: String(t.category._id), submit: true,
  }, t.ownerToken);
  assert.equal(created.status, 201);
  await call('POST', `/admin/marketplace/listings/${created.body.data._id}/reject`, { note: 'Add a clear photo' }, t.adminToken);

  const notes = await UserNotification.find({ user: t.ownerId }).sort({ createdAt: 1 }).lean();
  assert.deepEqual(notes.map((n) => n.type), ['seller_account', 'seller_listing_review']);
  assert.match(notes[1].messageEn, /Add a clear photo/);
});

test('owners add staff logins; staff manage products but not money or the team', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const add = await call('POST', '/seller/team', { name: 'Mai', email: 'mai@ops.test', password: 'staffpass123' }, t.ownerToken);
  assert.equal(add.status, 201, JSON.stringify(add.body));
  assert.equal((await call('POST', '/seller/team', { name: 'Mai 2', email: 'mai@ops.test', password: 'staffpass123' }, t.ownerToken)).status, 409);

  const login = await call('POST', '/auth/seller-login', { email: 'mai@ops.test', password: 'staffpass123' });
  assert.equal(login.status, 200);
  t.staffToken = login.body.token;
  assert.equal(login.body.user.role, 'seller_staff');

  assert.equal((await call('GET', '/seller/products', null, t.staffToken)).status, 200);
  assert.equal((await call('GET', '/seller/team', null, t.staffToken)).status, 403);
  assert.equal((await call('PUT', '/seller/me/bank', { iban: 'EG00' }, t.staffToken)).status, 403);
  assert.equal((await call('POST', '/seller/team', { name: 'X', email: 'x@ops.test', password: 'staffpass123' }, t.staffToken)).status, 403);

  const off = await call('PUT', `/seller/team/${add.body.data._id}`, { isActive: false }, t.ownerToken);
  assert.equal(off.status, 200);
  assert.equal((await call('POST', '/auth/seller-login', { email: 'mai@ops.test', password: 'staffpass123' })).status, 401);
  assert.equal((await call('GET', '/seller/products', null, t.staffToken)).status, 403, 'deactivated sessions stop working');
  assert.equal((await call('PUT', `/seller/team/${t.ownerId}`, { isActive: false }, t.ownerToken)).status, 404, 'the owner login is not editable here');
});

test('store-fulfilled stock only changes through received inbound shipments', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const created = await call('POST', '/seller/products', {
    nameAr: 'فلفل', nameEn: 'Black Pepper', price: 60, stock: 50, fulfilledBy: 'store', category: String(t.category._id),
  }, t.ownerToken);
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const id = created.body.data._id;
  assert.equal(created.body.data.stock, 0, 'warehouse stock starts at zero');
  assert.equal((await call('PUT', `/seller/products/${id}/stock`, { stock: 30 }, t.ownerToken)).status, 400);

  const own = await call('POST', '/seller/products', {
    nameAr: 'قرفة', nameEn: 'Cinnamon', price: 30, stock: 10, fulfilledBy: 'seller', category: String(t.category._id),
  }, t.ownerToken);
  const wrong = await call('POST', '/seller/inbound', { items: [{ productId: own.body.data._id, quantity: 5 }] }, t.ownerToken);
  assert.equal(wrong.status, 400, 'seller-shipped products are not sent to the warehouse');

  const inbound = await call('POST', '/seller/inbound', { items: [{ productId: id, quantity: 20 }], carrier: 'Bosta' }, t.ownerToken);
  assert.equal(inbound.status, 201, JSON.stringify(inbound.body));
  assert.match(inbound.body.data.inboundNumber, /^IN-\d{5}$/);

  const overCount = await call('POST', `/admin/marketplace/inbound/${inbound.body.data._id}/receive`, { items: [{ index: 0, receivedQuantity: 25 }] }, t.adminToken);
  assert.equal(overCount.status, 400);
  const receive = await call('POST', `/admin/marketplace/inbound/${inbound.body.data._id}/receive`, { items: [{ index: 0, receivedQuantity: 18 }], note: '2 damaged' }, t.adminToken);
  assert.equal(receive.status, 200, JSON.stringify(receive.body));
  assert.equal((await Product.findById(id).lean()).stock, 18);

  assert.equal((await call('POST', `/admin/marketplace/inbound/${inbound.body.data._id}/receive`, {}, t.adminToken)).status, 400, 'received only once');
  assert.equal((await Product.findById(id).lean()).stock, 18);
  assert.equal((await call('POST', `/seller/inbound/${inbound.body.data._id}/cancel`, null, t.ownerToken)).status, 400);

  const switchBack = await call('PUT', `/seller/products/${id}`, { fulfilledBy: 'seller' }, t.ownerToken);
  assert.equal(switchBack.status, 400, 'units in the warehouse must come back first');

  const toStore = await call('PUT', `/seller/products/${own.body.data._id}`, { fulfilledBy: 'store' }, t.ownerToken);
  assert.equal(toStore.status, 200);
  assert.equal(toStore.body.data.stock, 0, "the seller's own stock doesn't move into the warehouse");
});

test('CSV import creates drafts and reports bad rows', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const csv = [
    'nameAr,nameEn,price,category,stock,brand',
    'زعتر,Thyme,25,spices-ops,40,East',
    '"شطة, حارة","Hot Chili, extra",35.5,توابل,12,',
    'ملح,Salt,10,no-such-category,5,',
  ].join('\n');
  const res = await call('POST', '/seller/products/import', { csv }, t.ownerToken);
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.created, 2);
  assert.equal(res.body.failed, 1);
  assert.equal(res.body.results[2].line, 4);
  assert.match(res.body.results[2].error, /Unknown category/);

  const chili = await Product.findOne({ nameEn: 'Hot Chili, extra' }).lean();
  assert.equal(chili.price, 35.5);
  assert.equal(chili.listingStatus, 'draft');

  const missing = await call('POST', '/seller/products/import', { csv: 'nameEn,price\nX,1' }, t.ownerToken);
  assert.equal(missing.status, 400);
});
