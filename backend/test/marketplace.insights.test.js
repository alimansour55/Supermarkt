/**
 * Seller Center insights — menu badges, home dashboard, sales report (JSON + CSV), quick search,
 * inventory bulk edit and order bulk actions / export. Skips itself when MongoDB is not reachable.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

const MONGO_BASE = (process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/marketplus').replace(/\/[^/?]*(\?.*)?$/, '');
const TEST_DB_URI = `${MONGO_BASE}/marketplus_marketplace_insights_test`;

let mongoose;
let api;
let apiUrl;
let skip = false;
let Product;
let Shipment;
const t = {};

async function call(method, path, body, token, { raw = false } = {}) {
  const res = await fetch(`${apiUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (raw) return { status: res.status, text, type: res.headers.get('content-type') };
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON */ }
  return { status: res.status, body: json };
}

before(async () => {
  Object.assign(process.env, {
    NODE_ENV: 'test',
    MONGODB_URI: TEST_DB_URI,
    JWT_SECRET: 'marketplace_insights_jwt_secret_at_least_32!',
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
  ({ default: Shipment } = await import('../src/models/Shipment.js'));
  const { default: app } = await import('../src/app.js');
  const { generateToken } = await import('../src/utils/generateToken.js');

  api = await new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
  apiUrl = `http://127.0.0.1:${api.address().port}/api`;

  const admin = await User.create({ name: 'Admin', username: 'admin_ins', role: 'super_admin', password: 'adminpass123' });
  t.adminToken = generateToken(admin._id);
  t.category = await Category.create({ nameAr: 'زيوت', nameEn: 'Oils', slug: 'oils-ins', isActive: true });

  const apply = await call('POST', '/sellers/apply', {
    nameAr: 'معصرة', nameEn: 'Oil Press', contactName: 'Sara', email: 'sara@ins.test',
    phone: '+201033330000', password: 'sellerpass123', city: 'Alex', acceptTerms: true,
  });
  t.sellerId = apply.body.seller._id;
  t.ownerToken = apply.body.token;
  await call('POST', `/admin/marketplace/sellers/${t.sellerId}/status`, { status: 'active' }, t.adminToken);
  await call('PUT', `/admin/marketplace/sellers/${t.sellerId}`, { autoApproveListings: true }, t.adminToken);

  const section = await call('POST', '/seller/categories', { nameEn: 'Olive oil' }, t.ownerToken);
  t.sectionId = section.body.data._id;
  const olive = await call('POST', '/seller/products', {
    nameAr: 'زيت زيتون', nameEn: 'Olive Oil', price: 200, stock: 10, category: String(t.category._id),
    sellerCategories: [t.sectionId], submit: true,
  }, t.ownerToken);
  t.oliveId = olive.body.data._id;
  const sesame = await call('POST', '/seller/products', {
    nameAr: 'زيت سمسم', nameEn: 'Sesame Oil', price: 80, category: String(t.category._id), submit: true,
    variants: [{ type: 'size', valueAr: '250 مل', valueEn: '250 ml', price: 80, stock: 3 }, { type: 'size', valueAr: '1 لتر', valueEn: '1 L', price: 250, stock: 0 }],
  }, t.ownerToken);
  t.sesame = sesame.body.data;

  // Sales: two orders today, one 40 days ago (previous period), one cancelled.
  const ship = (n, o) => Shipment.create({
    order: new mongoose.Types.ObjectId(),
    orderNumber: `ORD-${n}`,
    shipmentNumber: `ORD-${n}-S1`,
    seller: t.sellerId,
    fulfilledBy: 'seller',
    status: 'pending',
    items: [{ itemIndex: 0, product: t.oliveId, nameAr: 'زيت زيتون', nameEn: 'Olive Oil', sku: 'OLV', price: 200, quantity: 2, lineTotal: 400, commission: 40 }],
    subtotal: 400,
    sellerNet: 360,
    ...o,
  });
  t.s1 = await ship(1, {});
  // The bulk confirm only reads the parent order's status.
  await mongoose.connection.collection('orders').insertOne({ _id: t.s1.order, orderNumber: 'ORD-1', orderStatus: 'pending' });
  t.s2 = await ship(2, { status: 'delivered' });
  await ship(3, { status: 'cancelled' });
  const old = await ship(4, { status: 'delivered' });
  await Shipment.collection.updateOne({ _id: old._id }, { $set: { createdAt: new Date(Date.now() - 40 * 86400000) } });
});

after(async () => {
  if (mongoose?.connection?.readyState === 1) {
    if (!skip) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
  api?.close();
});

test('menu badges count work waiting for the seller', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const res = await call('GET', '/seller/summary', null, t.ownerToken);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.data.toConfirm, 1);
  assert.equal(res.body.data.toShip, 0);
});

test('home dashboard compares with the previous period and lists top products', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const res = await call('GET', '/seller/home?days=30', null, t.ownerToken);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const d = res.body.data;
  assert.equal(d.sales.orders, 2, 'cancelled shipments are excluded');
  assert.equal(d.sales.gross, 800);
  assert.equal(d.sales.units, 4);
  assert.equal(d.sales.previous.orders, 1);
  assert.equal(d.sales.change.orders, 100);
  assert.ok(d.series.length >= 30 && d.series.length <= 32, `daily buckets: ${d.series.length}`);
  assert.equal(d.series.reduce((n, r) => n + r.orders, 0), 2);
  assert.equal(d.topProducts[0].nameEn, 'Olive Oil');
  assert.equal(d.listings.approved, 2);
  assert.ok(d.checklist.find((c) => c.id === 'sections').done);
});

test('sales report groups by product and section, and exports CSV', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const res = await call('GET', '/seller/reports/sales?days=90', null, t.ownerToken);
  assert.equal(res.status, 200);
  assert.equal(res.body.data.totals.orders, 3);
  assert.equal(res.body.data.totals.cancelled, 1);
  assert.equal(res.body.data.products[0].units, 6);
  assert.equal(res.body.data.bySection[0].nameEn, 'Olive oil');

  const csv = await call('GET', '/seller/reports/sales?days=30&format=csv&view=products', null, t.ownerToken, { raw: true });
  assert.match(csv.type, /text\/csv/);
  assert.match(csv.text, /Olive Oil,2,4,800,80/);
});

test('quick search finds products and orders', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const res = await call('GET', '/seller/search?q=olive', null, t.ownerToken);
  assert.equal(res.body.data.products[0].nameEn, 'Olive Oil');
  const orders = await call('GET', '/seller/search?q=ORD-2', null, t.ownerToken);
  assert.equal(orders.body.data.orders[0].shipmentNumber, 'ORD-2-S1');
});

test('inventory bulk edit updates prices, stock and variants; bad rows fail alone', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const variant = t.sesame.variants[1];
  const res = await call('PUT', '/seller/products/bulk-inventory', {
    items: [
      { id: t.oliveId, price: 190, oldPrice: 220, stock: 25 },
      { id: t.sesame._id, variants: [{ _id: variant._id, stock: 7, price: 240 }] },
      { id: t.oliveId, price: 0 },
      { id: String(new mongoose.Types.ObjectId()), price: 5 },
    ],
  }, t.ownerToken);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.saved, 2);
  assert.equal(res.body.failed, 2);
  const olive = await Product.findById(t.oliveId).lean();
  assert.equal(olive.price, 190);
  assert.equal(olive.oldPrice, 220);
  assert.equal(olive.stock, 25);
  const sesame = await Product.findById(t.sesame._id).lean();
  assert.equal(sesame.variants[1].stock, 7);
  assert.equal(sesame.variants[1].price, 240);
  assert.equal(sesame.variants[0].stock, 3, 'untouched variants keep their values');
});

test('orders: bulk confirm and CSV export with date filters', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const res = await call('POST', '/seller/shipments/bulk-status', { ids: [String(t.s1._id), String(t.s2._id)], status: 'confirmed' }, t.ownerToken);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.updated, 1, 'only the pending one can be confirmed');
  assert.equal((await Shipment.findById(t.s1._id).lean()).status, 'confirmed');

  const today = new Date().toISOString().slice(0, 10);
  const csv = await call('GET', `/seller/shipments/export?from=${today}`, null, t.ownerToken, { raw: true });
  assert.match(csv.type, /text\/csv/);
  assert.equal(csv.text.trim().split(/\r?\n/).length, 4, 'header + 3 shipments from today');
});
