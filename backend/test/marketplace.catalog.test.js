/**
 * Seller catalog — the seller's own store sections, optional marketplace category (staff place
 * it on review), section filters on the public store page, duplicate and bulk section edits.
 * Skips itself when MongoDB is not reachable.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

const MONGO_BASE = (process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/marketplus').replace(/\/[^/?]*(\?.*)?$/, '');
const TEST_DB_URI = `${MONGO_BASE}/marketplus_marketplace_catalog_test`;

let mongoose;
let api;
let apiUrl;
let skip = false;
let Product;
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
    JWT_SECRET: 'marketplace_catalog_jwt_secret_at_least_32!',
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
  const { default: app } = await import('../src/app.js');
  const { generateToken } = await import('../src/utils/generateToken.js');

  api = await new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
  apiUrl = `http://127.0.0.1:${api.address().port}/api`;

  const admin = await User.create({ name: 'Admin', username: 'admin_cat', role: 'super_admin', password: 'adminpass123' });
  t.adminToken = generateToken(admin._id);
  t.category = await Category.create({ nameAr: 'عسل', nameEn: 'Honey', slug: 'honey-cat', isActive: true });

  const apply = await call('POST', '/sellers/apply', {
    nameAr: 'منحل الوادي', nameEn: 'Valley Apiary', contactName: 'Omar', email: 'omar@cat.test',
    phone: '+201022220000', password: 'sellerpass123', city: 'Fayoum', acceptTerms: true,
  });
  t.sellerId = apply.body.seller._id;
  t.slug = apply.body.seller.slug;
  t.ownerToken = apply.body.token;
  await call('POST', `/admin/marketplace/sellers/${t.sellerId}/status`, { status: 'active' }, t.adminToken);

  const other = await call('POST', '/sellers/apply', {
    nameAr: 'آخر', nameEn: 'Other Store', contactName: 'Nour', email: 'nour@cat.test',
    phone: '+201022220001', password: 'sellerpass123', city: 'Cairo', acceptTerms: true,
  });
  t.otherToken = other.body.token;
});

after(async () => {
  if (mongoose?.connection?.readyState === 1) {
    if (!skip) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
  api?.close();
});

test('sellers manage their own sections, nested one level, isolated per seller', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const honey = await call('POST', '/seller/categories', { nameAr: 'عسل', nameEn: 'Honey' }, t.ownerToken);
  assert.equal(honey.status, 201, JSON.stringify(honey.body));
  const raw = await call('POST', '/seller/categories', { nameAr: 'عسل خام', nameEn: 'Raw honey', parent: honey.body.data._id }, t.ownerToken);
  assert.equal(raw.status, 201);
  const gifts = await call('POST', '/seller/categories', { nameEn: 'Gift boxes' }, t.ownerToken);
  assert.equal(gifts.body.data.nameAr, 'Gift boxes', 'one name is enough');

  const dup = await call('POST', '/seller/categories', { nameEn: 'gift BOXES' }, t.ownerToken);
  assert.equal(dup.status, 409, 'names are unique per store');

  const deep = await call('POST', '/seller/categories', { nameEn: 'Too deep', parent: raw.body.data._id }, t.ownerToken);
  assert.equal(deep.status, 400);
  const foreign = await call('PUT', `/seller/categories/${honey.body.data._id}`, { nameEn: 'Mine' }, t.otherToken);
  assert.equal(foreign.status, 404, "another seller can't touch my sections");

  await call('PUT', '/seller/categories/reorder', { ids: [gifts.body.data._id, honey.body.data._id] }, t.ownerToken);
  const list = await call('GET', '/seller/categories', null, t.ownerToken);
  assert.deepEqual(list.body.data.map((c) => c.nameEn), ['Gift boxes', 'Honey', 'Raw honey']);
  Object.assign(t, { honey: honey.body.data, raw: raw.body.data, gifts: gifts.body.data });
});

test('the marketplace category is optional; staff place the product on approval', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const created = await call('POST', '/seller/products', {
    nameAr: 'عسل سدر', nameEn: 'Sidr Honey', price: 300, stock: 5,
    sellerCategories: [t.raw._id, String(new mongoose.Types.ObjectId())], submit: true,
  }, t.ownerToken);
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal(created.body.data.hasMarketplaceCategory, false);
  assert.deepEqual(created.body.data.sellerCategories, [t.raw._id], 'unknown section ids are dropped');
  assert.equal(created.body.data.listingStatus, 'pending_review');

  const id = created.body.data._id;
  const blocked = await call('POST', `/admin/marketplace/listings/${id}/approve`, {}, t.adminToken);
  assert.equal(blocked.status, 400, 'cannot go live without a marketplace category');
  const ok = await call('POST', `/admin/marketplace/listings/${id}/approve`, { category: String(t.category._id) }, t.adminToken);
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  const live = await Product.findById(id).lean();
  assert.equal(String(live.category), String(t.category._id));
  assert.equal(live.isActive, true);

  // A live listing keeps its category when the seller sends an empty one.
  await call('PUT', `/seller/products/${id}`, { category: '' }, t.ownerToken);
  assert.equal(String((await Product.findById(id).lean()).category), String(t.category._id));
  t.sidrId = id;
});

test('auto-approved sellers still go to review when no category is chosen', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  await call('PUT', `/admin/marketplace/sellers/${t.sellerId}`, { autoApproveListings: true }, t.adminToken);
  const noCat = await call('POST', '/seller/products', { nameAr: 'شمع', nameEn: 'Beeswax', price: 50, submit: true }, t.ownerToken);
  assert.equal(noCat.body.data.listingStatus, 'pending_review');
  const withCat = await call('POST', '/seller/products', {
    nameAr: 'عسل برسيم', nameEn: 'Clover Honey', price: 150, stock: 3, category: String(t.category._id),
    sellerCategories: [t.honey._id], submit: true,
  }, t.ownerToken);
  assert.equal(withCat.body.data.listingStatus, 'approved');
  await call('PUT', `/admin/marketplace/sellers/${t.sellerId}`, { autoApproveListings: false }, t.adminToken);
});

test('customers filter a store by section; a parent includes its sub-sections', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const sections = await call('GET', `/sellers/${t.slug}/categories`);
  assert.equal(sections.status, 200);
  assert.deepEqual(sections.body.data.map((c) => c.nameEn), ['Honey', 'Raw honey'], 'empty sections are hidden');

  const parent = await call('GET', `/products?seller=${t.slug}&sellerCategory=${t.honey.slug}`);
  assert.deepEqual(parent.body.data.map((p) => p.nameEn).sort(), ['Clover Honey', 'Sidr Honey']);
  const child = await call('GET', `/products?seller=${t.slug}&sellerCategory=${t.raw._id}`);
  assert.deepEqual(child.body.data.map((p) => p.nameEn), ['Sidr Honey']);

  await call('PUT', `/seller/categories/${t.raw._id}`, { isActive: false }, t.ownerToken);
  const hidden = await call('GET', `/products?seller=${t.slug}&sellerCategory=${t.raw._id}`);
  assert.equal(hidden.body.data.length, 0, 'hidden sections filter nothing');
  await call('PUT', `/seller/categories/${t.raw._id}`, { isActive: true }, t.ownerToken);
});

test('bulk section edits, duplicate, and deleting a section keeps the products', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const bulk = await call('POST', '/seller/products/bulk-categories', { ids: [t.sidrId], add: [t.gifts._id], remove: [t.raw._id] }, t.ownerToken);
  assert.equal(bulk.status, 200, JSON.stringify(bulk.body));
  assert.deepEqual((await Product.findById(t.sidrId).lean()).sellerCategories.map(String), [t.gifts._id]);

  const filtered = await call('GET', `/seller/products?sellerCategory=${t.gifts._id}`, null, t.ownerToken);
  assert.deepEqual(filtered.body.data.map((p) => p.nameEn), ['Sidr Honey']);

  const dup = await call('POST', `/seller/products/${t.sidrId}/duplicate`, null, t.ownerToken);
  assert.equal(dup.status, 201, JSON.stringify(dup.body));
  assert.equal(dup.body.data.listingStatus, 'draft');
  assert.equal(dup.body.data.stock, 0);
  assert.deepEqual(dup.body.data.sellerCategories, [t.gifts._id]);
  assert.match(dup.body.data.nameEn, /copy/);

  assert.equal((await call('DELETE', `/seller/categories/${t.gifts._id}`, null, t.ownerToken)).status, 200);
  const sidr = await Product.findById(t.sidrId).lean();
  assert.ok(sidr, 'product survives');
  assert.deepEqual(sidr.sellerCategories, []);
});

test('CSV import creates missing sections and no longer needs a category column', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const csv = [
    'nameAr,nameEn,price,storeCategory',
    'عسل زهور,Flower Honey,90,Honey|Gift boxes',
  ].join('\n');
  const res = await call('POST', '/seller/products/import', { csv }, t.ownerToken);
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const p = await Product.findOne({ nameEn: 'Flower Honey' }).populate('sellerCategories').lean();
  assert.deepEqual(p.sellerCategories.map((c) => c.nameEn).sort(), ['Gift boxes', 'Honey']);
  assert.equal(p.category, null);
});
