/**
 * Marketplace phase 4 — seller store browsing filters, seller sitemap, seller ratings and
 * seller performance. Skips itself when MongoDB is not reachable.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

const MONGO_BASE = (process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/marketplus').replace(/\/[^/?]*(\?.*)?$/, '');
const TEST_DB_URI = `${MONGO_BASE}/marketplus_marketplace_storefront_test`;

let mongoose;
let api;
let apiUrl;
let skip = false;
let Shipment;
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

const deliveryDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date(Date.now() + 2 * 86400000));
const line = (p, quantity) => ({ productId: String(p._id), quantity, price: p.price, name: p.nameAr, nameEn: p.nameEn });

before(async () => {
  Object.assign(process.env, {
    NODE_ENV: 'test',
    MONGODB_URI: TEST_DB_URI,
    JWT_SECRET: 'marketplace_storefront_jwt_secret_at_least_32',
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
  const { default: Seller } = await import('../src/models/Seller.js');
  const { default: Product } = await import('../src/models/Product.js');
  ({ default: Shipment } = await import('../src/models/Shipment.js'));
  const { default: app } = await import('../src/app.js');
  const { generateToken } = await import('../src/utils/generateToken.js');

  api = await new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
  apiUrl = `http://127.0.0.1:${api.address().port}/api`;

  const admin = await User.create({ name: 'Admin', username: 'admin_sf', role: 'super_admin', password: 'adminpass123' });
  t.adminToken = generateToken(admin._id);
  const customer = await User.create({ name: 'Laila Hassan', phone: '+201077778888' });
  t.customerToken = generateToken(customer._id);
  const other = await User.create({ name: 'Someone', phone: '+201077779999' });
  t.otherToken = generateToken(other._id);

  const category = await Category.create({ nameAr: 'مخبوزات', nameEn: 'Bakery', slug: 'bakery-sf', isActive: true });
  t.seller = await Seller.create({ nameAr: 'مخبز النور', nameEn: 'Nour Bakery', slug: 'nour-bakery', status: 'active', allowedFulfillment: ['seller'], email: 'nour@x.test', handlingDays: 1 });
  const owner = await User.create({ name: 'Nour', email: 'nour@x.test', password: 'sellerpass123', role: 'seller_owner', seller: t.seller._id });
  t.sellerToken = generateToken(owner._id);
  t.hidden = await Seller.create({ nameAr: 'موقوف', nameEn: 'Paused Co', slug: 'paused-co', status: 'suspended', email: 'p@x.test' });

  const product = (o) => Product.create({ nameAr: 'منتج', nameEn: 'Item', price: 50, stock: 30, category: category._id, sku: `S-${Math.random().toString(36).slice(2, 8)}`, slug: `s-${Math.random().toString(36).slice(2, 8)}`, ...o });
  t.storeBread = await product({ nameEn: 'Store Bread' });
  t.sellerCake = await product({ nameEn: 'Nour Cake', price: 150, seller: t.seller._id, fulfilledBy: 'seller', listingStatus: 'approved', sellerNameEn: 'Nour Bakery', sellerNameAr: 'مخبز النور', sellerSlug: 'nour-bakery' });
});

after(async () => {
  if (mongoose?.connection?.readyState === 1) {
    if (!skip) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
  api?.close();
});

test('product lists filter by seller, by store vs marketplace and by who ships', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const names = async (qs) => (await call('GET', `/products?${qs}`)).body.data.map((p) => p.nameEn).sort();
  assert.deepEqual(await names('seller=nour-bakery'), ['Nour Cake']);
  assert.deepEqual(await names(`seller=${t.seller._id}`), ['Nour Cake']);
  assert.deepEqual(await names('seller=paused-co'), [], 'suspended sellers show nothing');
  assert.deepEqual(await names('seller=no-such-seller'), []);
  assert.deepEqual(await names('soldBy=store'), ['Store Bread']);
  assert.deepEqual(await names('soldBy=marketplace'), ['Nour Cake']);
  assert.deepEqual(await names('fulfilledBy=seller'), ['Nour Cake']);

  const card = await call('GET', '/sellers/nour-bakery');
  assert.equal(card.status, 200);
  assert.equal(card.body.data.productCount, 1);
  assert.equal(card.body.data.email, undefined, 'public card never exposes contact or legal data');
  assert.equal((await call('GET', '/sellers/paused-co')).status, 404);
});

test('the sitemap lists active sellers only', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const res = await call('GET', '/sitemap/sellers');
  assert.deepEqual(res.body.data.map((s) => s.slug), ['nour-bakery']);
});

test('customers rate a seller once per delivered shipment; staff can hide abusive reviews', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const order = await call('POST', '/orders', {
    items: [line(t.sellerCake, 1)],
    shippingAddress: { street: '1 Tahrir', city: 'Cairo', locationSource: 'manual' },
    phone: '+201077778888',
    paymentMethod: 'cod',
    deliveryMethod: 'scheduled',
    deliveryZoneId: 'cairo-helwan',
    timeSlotId: 'morning',
    scheduledDate: deliveryDate(),
  }, t.customerToken);
  assert.equal(order.status, 201, JSON.stringify(order.body));
  const orderId = order.body.order.id;
  const shipment = await Shipment.findOne({ order: orderId });
  const rate = (body, token = t.customerToken) => call('POST', `/orders/${orderId}/shipments/${shipment._id}/review`, body, token);

  assert.equal((await rate({ rating: 5 })).status, 400, 'not delivered yet');
  for (const status of ['confirmed', 'shipped', 'delivered']) {
    // eslint-disable-next-line no-await-in-loop
    await call('POST', `/seller/shipments/${shipment._id}/status`, { status }, t.sellerToken);
  }
  assert.equal((await rate({ rating: 4 }, t.otherToken)).status, 404, 'only the buyer can rate');
  assert.equal((await rate({ rating: 9 })).status, 400);
  const ok = await rate({ rating: 4, comment: 'Fresh and on time' });
  assert.equal(ok.status, 201, JSON.stringify(ok.body));
  assert.equal(ok.body.data.userName, 'Laila', 'first name only');
  assert.equal((await rate({ rating: 1 })).status, 409);

  let card = await call('GET', '/sellers/nour-bakery');
  assert.equal(card.body.data.rating, 4);
  assert.equal(card.body.data.ratingCount, 1);

  const myOrder = await call('GET', `/orders/${orderId}`, null, t.customerToken);
  assert.equal(myOrder.body.order.shipments[0].myRating, 4);

  const reviews = await call('GET', '/sellers/nour-bakery/reviews');
  assert.equal(reviews.body.data.length, 1);
  assert.equal(reviews.body.distribution.find((d) => d.rating === 4).count, 1);

  const hide = await call('PUT', `/admin/marketplace/seller-reviews/${ok.body.data._id}`, { status: 'hidden' }, t.adminToken);
  assert.equal(hide.status, 200);
  card = await call('GET', '/sellers/nour-bakery');
  assert.equal(card.body.data.ratingCount, 0);
});

test('performance tracks seller cancellations and late shipments', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const { getSellerPerformance } = await import('../src/services/sellerReputation.service.js');
  const base = { seller: t.seller._id, sellerNameEn: 'Nour Bakery', fulfilledBy: 'seller', customer: null, subtotal: 10, sellerNet: 9 };
  const daysAgo = (d) => new Date(Date.now() - d * 86400000);
  await Shipment.collection.insertMany([
    { ...base, order: new mongoose.Types.ObjectId(), orderNumber: 'X1', shipmentNumber: 'X1-S1', status: 'shipped', createdAt: daysAgo(10), shippedAt: daysAgo(5) },
    { ...base, order: new mongoose.Types.ObjectId(), orderNumber: 'X2', shipmentNumber: 'X2-S1', status: 'cancelled', cancelledByRole: 'seller', createdAt: daysAgo(3) },
    { ...base, order: new mongoose.Types.ObjectId(), orderNumber: 'X3', shipmentNumber: 'X3-S1', status: 'pending', createdAt: daysAgo(4) },
  ]);
  const perf = await getSellerPerformance(t.seller._id);
  assert.equal(perf.sellerCancelled, 1);
  assert.equal(perf.lateShipments, 2, 'shipped after 5 days and still unshipped after 4 (handling 1 day)');
  assert.equal(perf.health, 'at_risk');

  const mine = await call('GET', '/seller/reviews', null, t.sellerToken);
  assert.equal(mine.status, 200);
  assert.equal(mine.body.performance.sellerCancelled, 1);
});
