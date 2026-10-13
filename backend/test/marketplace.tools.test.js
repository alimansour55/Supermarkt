/**
 * Seller catalog tools — CSV export + update-by-id/SKU import, product Q&A, replies to product
 * reviews and vacation mode (hides listings, ends itself). Skips when MongoDB is down.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

const MONGO_BASE = (process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/marketplus').replace(/\/[^/?]*(\?.*)?$/, '');
const TEST_DB_URI = `${MONGO_BASE}/marketplus_marketplace_tools_test`;

let mongoose;
let api;
let apiUrl;
let skip = false;
let Product;
let Seller;
let endExpiredVacations;
const t = {};

async function call(method, path, body, token, { raw = false } = {}) {
  const res = await fetch(`${apiUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (raw) return { status: res.status, text };
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON */ }
  return { status: res.status, body: json };
}

before(async () => {
  Object.assign(process.env, {
    NODE_ENV: 'test',
    MONGODB_URI: TEST_DB_URI,
    JWT_SECRET: 'marketplace_tools_jwt_secret_at_least_32!!',
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
  ({ default: Seller } = await import('../src/models/Seller.js'));
  ({ endExpiredVacations } = await import('../src/controllers/sellerCatalog.controller.js'));
  const { default: app } = await import('../src/app.js');
  const { generateToken } = await import('../src/utils/generateToken.js');

  api = await new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
  apiUrl = `http://127.0.0.1:${api.address().port}/api`;

  const admin = await User.create({ name: 'Admin', username: 'admin_tools', role: 'super_admin', password: 'adminpass123' });
  t.adminToken = generateToken(admin._id);
  const customer = await User.create({ name: 'Hoda', phone: '+201066660000', role: 'user' });
  t.customerToken = generateToken(customer._id);
  t.customerId = customer._id;
  const category = await Category.create({ nameAr: 'جبن', nameEn: 'Cheese', slug: 'cheese-tools', isActive: true });

  const apply = await call('POST', '/sellers/apply', {
    nameAr: 'ألبان', nameEn: 'Dairy Farm', contactName: 'Samy', email: 'samy@tools.test',
    phone: '+201066661111', password: 'sellerpass123', city: 'Mansoura', acceptTerms: true,
  });
  t.sellerId = apply.body.seller._id;
  t.slug = apply.body.seller.slug;
  t.ownerToken = apply.body.token;
  await call('POST', `/admin/marketplace/sellers/${t.sellerId}/status`, { status: 'active' }, t.adminToken);
  await call('PUT', `/admin/marketplace/sellers/${t.sellerId}`, { autoApproveListings: true }, t.adminToken);

  const make = async (o) => (await call('POST', '/seller/products', { price: 50, stock: 10, category: String(category._id), submit: true, ...o }, t.ownerToken)).body.data;
  t.feta = await make({ nameAr: 'فيتا', nameEn: 'Feta', sku: 'FETA-1' });
  t.gouda = await make({ nameAr: 'جودة', nameEn: 'Gouda', sku: 'GOUDA-1' });
});

after(async () => {
  if (mongoose?.connection?.readyState === 1) {
    if (!skip) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
  api?.close();
});

test('catalog export → edit in Excel → import updates existing products by id or SKU', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const csv = await call('GET', '/seller/products/export', null, t.ownerToken, { raw: true });
  assert.equal(csv.status, 200);
  assert.match(csv.text, /^﻿?id,sku,nameAr,nameEn,price/);
  assert.match(csv.text, /Feta,50/);

  const edited = [
    'id,sku,price,oldPrice,stock,lowStockThreshold,storeCategory',
    `${t.feta._id},,45,55,30,8,Cheeses|Offers`,
    ',GOUDA-1,70,,,,',
    `${new mongoose.Types.ObjectId()},,10,,,,`,
  ].join('\n');
  const res = await call('POST', '/seller/products/import', { csv: edited }, t.ownerToken);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.updated, 2);
  assert.equal(res.body.created, 0);
  assert.equal(res.body.failed, 1, 'unknown ids fail, they never create');

  const feta = await Product.findById(t.feta._id).populate('sellerCategories').lean();
  assert.equal(feta.price, 45);
  assert.equal(feta.oldPrice, 55);
  assert.equal(feta.stock, 30);
  assert.equal(feta.lowStockThreshold, 8);
  assert.deepEqual(feta.sellerCategories.map((c) => c.nameEn).sort(), ['Cheeses', 'Offers']);
  const gouda = await Product.findById(t.gouda._id).lean();
  assert.equal(gouda.price, 70);
  assert.equal(gouda.stock, 10, 'empty cells leave values alone');
});

test('customers ask, the seller answers, answered questions show publicly', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  assert.equal((await call('POST', '/product-questions', { product: t.feta._id, question: 'Is it salty?' })).status, 401);
  const ask = await call('POST', '/product-questions', { product: t.feta._id, question: 'Is it made from cow milk?' }, t.customerToken);
  assert.equal(ask.status, 201, JSON.stringify(ask.body));

  let pub = await call('GET', `/product-questions?product=${t.feta._id}`);
  assert.equal(pub.body.data.length, 0, 'unanswered questions stay private');

  const inbox = await call('GET', '/seller/questions?state=unanswered', null, t.ownerToken);
  assert.equal(inbox.body.unanswered, 1);
  assert.equal(inbox.body.data[0].product.nameEn, 'Feta');
  const id = inbox.body.data[0]._id;
  assert.equal((await call('POST', `/seller/questions/${id}/answer`, { answer: 'Yes, 100% cow milk.' }, t.ownerToken)).status, 200);

  pub = await call('GET', `/product-questions?product=${t.feta._id}`);
  assert.equal(pub.body.data[0].answer, 'Yes, 100% cow milk.');

  await call('POST', `/seller/questions/${id}/visibility`, { hidden: true }, t.ownerToken);
  pub = await call('GET', `/product-questions?product=${t.feta._id}`);
  assert.equal(pub.body.data.length, 0, 'hidden questions disappear');
});

test('sellers read and reply to reviews of their products', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  await Product.updateOne({ _id: t.feta._id }, {
    $push: { reviews: [
      { user: t.customerId, rating: 2, comment: 'Too salty', status: 'approved' },
      { user: t.customerId, rating: 5, comment: 'hidden one', status: 'pending' },
    ] },
  });
  const list = await call('GET', '/seller/product-reviews', null, t.ownerToken);
  assert.equal(list.status, 200, JSON.stringify(list.body));
  assert.equal(list.body.data.length, 1, 'only approved reviews');
  assert.equal(list.body.data[0].review.comment, 'Too salty');
  assert.equal(list.body.distribution.find((d) => d.rating === 2).count, 1);

  const { productId, review } = list.body.data[0];
  const reply = await call('POST', `/seller/product-reviews/${productId}/${review._id}/reply`, { message: 'Thanks — try soaking it in water.' }, t.ownerToken);
  assert.equal(reply.status, 200);
  assert.equal(reply.body.data.byRole, 'seller');
  const unreplied = await call('GET', '/seller/product-reviews?unreplied=true', null, t.ownerToken);
  assert.equal(unreplied.body.data.length, 0);
});

test('vacation mode hides every listing and ends on the return date', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const past = await call('PUT', '/seller/me/vacation', { enabled: true, until: '2020-01-01' }, t.ownerToken);
  assert.equal(past.status, 400);
  const until = new Date(Date.now() + 3 * 86400000).toISOString();
  const on = await call('PUT', '/seller/me/vacation', { enabled: true, until, messageEn: 'Back on Sunday' }, t.ownerToken);
  assert.equal(on.status, 200, JSON.stringify(on.body));
  assert.equal(await Product.countDocuments({ seller: t.sellerId, isActive: true }), 0);
  const store = await call('GET', `/sellers/${t.slug}`);
  assert.equal(store.body.data.vacation.messageEn, 'Back on Sunday');

  // New listings created on vacation stay hidden too.
  const extra = await call('POST', '/seller/products', { nameAr: 'زبدة', nameEn: 'Butter', price: 30, category: (await Product.findById(t.feta._id).lean()).category, submit: true }, t.ownerToken);
  assert.equal((await Product.findById(extra.body.data._id).lean()).isActive, false);

  await Seller.updateOne({ _id: t.sellerId }, { $set: { 'vacation.until': new Date(Date.now() - 1000) } });
  assert.equal(await endExpiredVacations(), 1);
  assert.equal(await Product.countDocuments({ seller: t.sellerId, isActive: true }), 3);
  assert.equal((await call('GET', `/sellers/${t.slug}`)).body.data.vacation, null);
});
