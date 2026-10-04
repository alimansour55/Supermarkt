/**
 * Marketplace phase 1 — seller onboarding, listing moderation, visibility and tenant isolation,
 * against a throwaway MongoDB database. Skips itself when MongoDB is not reachable.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

const MONGO_BASE = (process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/marketplus').replace(/\/[^/?]*(\?.*)?$/, '');
const TEST_DB_URI = `${MONGO_BASE}/marketplus_marketplace_test`;

let mongoose;
let app;
let api;
let apiUrl;
let skip = false;
let adminToken;
let customerToken;
let category;
let Product;

const state = {};

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

const application = (n) => ({
  nameAr: `متجر ${n}`,
  nameEn: `Store ${n}`,
  contactName: `Owner ${n}`,
  email: `owner${n}@sellers.test`,
  phone: `+20100000000${n}`,
  password: 'sellerpass123',
  city: 'Cairo',
  acceptTerms: true,
});

const productPayload = (overrides = {}) => ({
  nameAr: 'عسل نحل',
  nameEn: 'Bee Honey',
  descriptionAr: 'عسل طبيعي',
  descriptionEn: 'Natural honey',
  price: 120,
  stock: 10,
  category: String(category._id),
  ...overrides,
});

before(async () => {
  Object.assign(process.env, {
    NODE_ENV: 'test',
    MONGODB_URI: TEST_DB_URI,
    JWT_SECRET: 'marketplace_test_jwt_secret_at_least_32_chars',
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
  ({ default: app } = await import('../src/app.js'));
  const { generateToken } = await import('../src/utils/generateToken.js');

  api = await new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
  apiUrl = `http://127.0.0.1:${api.address().port}/api`;

  const admin = await User.create({ name: 'Admin', username: 'admin_mp', role: 'super_admin', password: 'adminpass123' });
  adminToken = generateToken(admin._id);
  const customer = await User.create({ name: 'Customer', phone: '+201099999999' });
  customerToken = generateToken(customer._id);
  category = await Category.create({ nameAr: 'أغذية', nameEn: 'Food', slug: 'food-mp', isActive: true });
});

after(async () => {
  if (mongoose?.connection?.readyState === 1) {
    if (!skip) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
  api?.close();
});

test('a seller applies, gets signed in, and can log in with email + password', async (t) => {
  if (skip) return t.skip('MongoDB not reachable');

  const noTerms = await call('POST', '/sellers/apply', { ...application(1), acceptTerms: false });
  assert.equal(noTerms.status, 400);

  const res = await call('POST', '/sellers/apply', application(1));
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.seller.status, 'applied');
  assert.ok(res.body.token);
  state.sellerA = { id: res.body.seller._id };

  const dup = await call('POST', '/sellers/apply', application(1));
  assert.equal(dup.status, 409);

  const login = await call('POST', '/auth/seller-login', { email: 'OWNER1@sellers.test', password: 'sellerpass123' });
  assert.equal(login.status, 200, JSON.stringify(login.body));
  assert.equal(login.body.user.role, 'seller_owner');
  state.sellerA.token = login.body.token;

  const bad = await call('POST', '/auth/seller-login', { email: 'owner1@sellers.test', password: 'wrong-password' });
  assert.equal(bad.status, 401);

  const me = await call('GET', '/seller/me', null, state.sellerA.token);
  assert.equal(me.status, 200);
  assert.equal(me.body.data.seller.status, 'applied');
});

test('customers and staff cannot use the seller portal; sellers cannot use admin APIs', async (t) => {
  if (skip) return t.skip('MongoDB not reachable');
  assert.equal((await call('GET', '/seller/me', null, customerToken)).status, 403);
  assert.equal((await call('GET', '/seller/me', null, adminToken)).status, 403);
  assert.equal((await call('GET', '/seller/me')).status, 401);
  assert.equal((await call('GET', '/admin/marketplace/sellers', null, state.sellerA.token)).status, 403);
  assert.equal((await call('GET', '/products/admin', null, state.sellerA.token)).status, 403);
});

test('a submitted listing stays hidden until the seller and the listing are both approved', async (t) => {
  if (skip) return t.skip('MongoDB not reachable');
  const { token } = state.sellerA;

  const created = await call('POST', '/seller/products', productPayload({ isFeatured: true, isActive: true, soldCount: 99 }), token);
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const product = created.body.data;
  assert.equal(product.listingStatus, 'draft');
  assert.equal(product.isActive, false);
  assert.equal(product.isFeatured, false, 'merchandising flags are staff-only');
  assert.equal(product.soldCount, 0);
  state.productId = product._id;

  assert.equal((await call('GET', `/products/${product._id}`)).status, 404, 'drafts are not public');

  // A bulk "activate" by staff must not publish a seller draft.
  await call('POST', '/products/admin/bulk', { ids: [product._id], action: 'activate' }, adminToken);
  assert.equal((await call('GET', `/products/${product._id}`)).status, 404);

  const submitted = await call('POST', `/seller/products/${product._id}/submit`, null, token);
  assert.equal(submitted.body.data.listingStatus, 'pending_review');

  const queue = await call('GET', '/admin/marketplace/listings', null, adminToken);
  assert.ok(queue.body.data.some((p) => p._id === product._id));

  const early = await call('POST', `/admin/marketplace/listings/${product._id}/approve`, {}, adminToken);
  assert.equal(early.status, 400, 'listing approval needs an active seller');

  const noReason = await call('POST', `/admin/marketplace/sellers/${state.sellerA.id}/status`, { status: 'rejected' }, adminToken);
  assert.equal(noReason.status, 400);

  const activated = await call('POST', `/admin/marketplace/sellers/${state.sellerA.id}/status`, { status: 'active' }, adminToken);
  assert.equal(activated.status, 200, JSON.stringify(activated.body));
  assert.equal(activated.body.data.status, 'active');

  const approved = await call('POST', `/admin/marketplace/listings/${product._id}/approve`, {}, adminToken);
  assert.equal(approved.status, 200, JSON.stringify(approved.body));
  assert.equal(approved.body.data.listingStatus, 'approved');

  const pub = await call('GET', `/products/${product._id}`);
  assert.equal(pub.status, 200);
  assert.equal(pub.body.data.nameEn, 'Bee Honey');
});

test('content edits to a live listing wait for review; price and stock apply immediately', async (t) => {
  if (skip) return t.skip('MongoDB not reachable');
  const { token } = state.sellerA;
  const id = state.productId;

  const edit = await call('PUT', `/seller/products/${id}`, { nameEn: 'Premium Bee Honey', price: 150, stock: 4 }, token);
  assert.equal(edit.status, 200, JSON.stringify(edit.body));
  assert.equal(edit.body.pendingReview, true);
  assert.equal(edit.body.data.pendingChanges.nameEn, 'Premium Bee Honey');

  const pub = await call('GET', `/products/${id}`);
  assert.equal(pub.body.data.nameEn, 'Bee Honey', 'live name unchanged until approved');
  assert.equal(pub.body.data.price, 150, 'price is live immediately');
  assert.equal(pub.body.data.stock, 4);

  const reject = await call('POST', `/admin/marketplace/listings/${id}/reject`, { note: '' }, adminToken);
  assert.equal(reject.status, 400, 'rejection needs a note');

  const approve = await call('POST', `/admin/marketplace/listings/${id}/approve`, {}, adminToken);
  assert.equal(approve.status, 200);
  assert.equal(approve.body.data.nameEn, 'Premium Bee Honey');
  assert.equal(approve.body.data.pendingChanges, null);
  assert.equal((await call('GET', `/products/${id}`)).body.data.nameEn, 'Premium Bee Honey');
});

test('pausing and suspending a seller hides its listings; reactivation restores them', async (t) => {
  if (skip) return t.skip('MongoDB not reachable');
  const { token, id: sellerId } = state.sellerA;
  const id = state.productId;

  await call('POST', `/seller/products/${id}/pause`, null, token);
  assert.equal((await call('GET', `/products/${id}`)).status, 404);
  await call('POST', `/seller/products/${id}/unpause`, null, token);
  assert.equal((await call('GET', `/products/${id}`)).status, 200);

  const suspend = await call('POST', `/admin/marketplace/sellers/${sellerId}/status`, { status: 'suspended', reason: 'Late shipments' }, adminToken);
  assert.equal(suspend.status, 200);
  assert.equal((await call('GET', `/products/${id}`)).status, 404);

  // Staff saving the product through the admin form must not resurface it.
  await call('PUT', `/products/admin/${id}`, { isActive: true }, adminToken);
  assert.equal((await call('GET', `/products/${id}`)).status, 404);

  const blocked = await call('PUT', `/seller/products/${id}`, { price: 10 }, token);
  assert.equal(blocked.status, 403, 'suspended sellers cannot edit the catalog');

  await call('POST', `/admin/marketplace/sellers/${sellerId}/status`, { status: 'active' }, adminToken);
  assert.equal((await call('GET', `/products/${id}`)).status, 200);
});

test('a seller can never see or change another seller\'s products', async (t) => {
  if (skip) return t.skip('MongoDB not reachable');
  const res = await call('POST', '/sellers/apply', application(2));
  const tokenB = res.body.token;
  const id = state.productId;

  assert.equal((await call('GET', `/seller/products/${id}`, null, tokenB)).status, 404);
  assert.equal((await call('PUT', `/seller/products/${id}`, { price: 1 }, tokenB)).status, 404);
  assert.equal((await call('PUT', `/seller/products/${id}/stock`, { stock: 0 }, tokenB)).status, 404);
  assert.equal((await call('POST', `/seller/products/${id}/pause`, null, tokenB)).status, 404);
  assert.equal((await call('DELETE', `/seller/products/${id}`, null, tokenB)).status, 404);

  const list = await call('GET', '/seller/products', null, tokenB);
  assert.equal(list.body.data.length, 0);

  const own = await call('POST', '/seller/products', productPayload({ nameEn: 'B Olive Oil', nameAr: 'زيت زيتون' }), tokenB);
  assert.equal(own.status, 201);
  const listA = await call('GET', '/seller/products', null, state.sellerA.token);
  assert.ok(listA.body.data.every((p) => p._id !== own.body.data._id));

  const stored = await Product.findById(id).lean();
  assert.equal(stored.price, 150, 'untouched by seller B');
});

test('a seller cannot choose a fulfillment mode staff have not enabled', async (t) => {
  if (skip) return t.skip('MongoDB not reachable');
  const { token, id: sellerId } = state.sellerA;
  const denied = await call('PUT', `/seller/products/${state.productId}`, { fulfilledBy: 'store' }, token);
  assert.equal(denied.status, 400);

  await call('PUT', `/admin/marketplace/sellers/${sellerId}`, { allowedFulfillment: ['seller', 'store'] }, adminToken);
  const allowed = await call('PUT', `/seller/products/${state.productId}`, { fulfilledBy: 'store' }, token);
  assert.equal(allowed.status, 200);
  assert.equal(allowed.body.data.fulfilledBy, 'store');
});

test('commission resolves seller×category, seller, marketplace×category, then default', async () => {
  const { resolveCommissionRate } = await import('../src/services/marketplace.service.js');
  const product = { category: 'leaf', categoryAncestors: ['root', 'mid', 'leaf'], mainCategory: 'root' };
  const settings = { defaultCommissionRate: 10, categoryCommissions: [{ category: 'root', rate: 8 }] };
  assert.equal(resolveCommissionRate({ seller: {}, product: {}, settings }), 10);
  assert.equal(resolveCommissionRate({ seller: {}, product, settings }), 8);
  assert.equal(resolveCommissionRate({ seller: { commissionRate: 12 }, product, settings }), 12);
  assert.equal(resolveCommissionRate({
    seller: { commissionRate: 12, categoryCommissions: [{ category: 'root', rate: 5 }, { category: 'mid', rate: 6 }] },
    product,
    settings,
  }), 6, 'deepest matching category wins');
});
