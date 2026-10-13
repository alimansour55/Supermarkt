/**
 * Growth tools — seller promotions (approve, run as markdowns, lock prices, restore on end,
 * no stacking), store page design and product traffic. Skips when MongoDB is down.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

const MONGO_BASE = (process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/marketplus').replace(/\/[^/?]*(\?.*)?$/, '');
const TEST_DB_URI = `${MONGO_BASE}/marketplus_marketplace_growth_test`;
const DAY = 86400000;

let mongoose;
let api;
let apiUrl;
let skip = false;
let Product;
let SellerPromotion;
let runPromotionSchedule;
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
    JWT_SECRET: 'marketplace_growth_jwt_secret_at_least_32!',
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
  ({ default: SellerPromotion } = await import('../src/models/SellerPromotion.js'));
  ({ runPromotionSchedule } = await import('../src/services/sellerPromotion.service.js'));
  const { default: app } = await import('../src/app.js');
  const { generateToken } = await import('../src/utils/generateToken.js');

  api = await new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
  apiUrl = `http://127.0.0.1:${api.address().port}/api`;

  const admin = await User.create({ name: 'Admin', username: 'admin_growth', role: 'super_admin', password: 'adminpass123' });
  t.adminToken = generateToken(admin._id);
  const category = await Category.create({ nameAr: 'قهوة', nameEn: 'Coffee', slug: 'coffee-growth', isActive: true });

  const apply = async (n) => (await call('POST', '/sellers/apply', {
    nameAr: `بن ${n}`, nameEn: `Roastery ${n}`, contactName: `R ${n}`, email: `r${n}@growth.test`,
    phone: `+20107777000${n}`, password: 'sellerpass123', city: 'Cairo', acceptTerms: true,
  })).body;
  const a = await apply(1);
  const b = await apply(2);
  Object.assign(t, { sellerId: a.seller._id, slug: a.seller.slug, ownerToken: a.token, otherToken: b.token });
  for (const s of [a, b]) {
    // eslint-disable-next-line no-await-in-loop
    await call('POST', `/admin/marketplace/sellers/${s.seller._id}/status`, { status: 'active' }, t.adminToken);
    // eslint-disable-next-line no-await-in-loop
    await call('PUT', `/admin/marketplace/sellers/${s.seller._id}`, { autoApproveListings: true }, t.adminToken);
  }
  t.section = (await call('POST', '/seller/categories', { nameEn: 'Beans' }, t.ownerToken)).body.data;
  const make = async (o, token = t.ownerToken) => (await call('POST', '/seller/products', { price: 200, stock: 10, category: String(category._id), submit: true, ...o }, token)).body.data;
  t.arabica = await make({ nameAr: 'أرابيكا', nameEn: 'Arabica', sellerCategories: [t.section._id] });
  t.robusta = await make({ nameAr: 'روبوستا', nameEn: 'Robusta', oldPrice: 260 });
  t.foreign = await make({ nameAr: 'غريب', nameEn: 'Other seller beans' }, t.otherToken);
});

after(async () => {
  if (mongoose?.connection?.readyState === 1) {
    if (!skip) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
  api?.close();
});

test('a promotion needs approval, runs as a markdown, locks prices and restores them', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const bad = await call('POST', '/seller/promotions', { name: 'Huge', percent: 90, startsAt: new Date(), endsAt: new Date(Date.now() + DAY) }, t.ownerToken);
  assert.equal(bad.status, 400);

  const created = await call('POST', '/seller/promotions', {
    name: 'Beans week', percent: 20, scope: 'sections', sections: [t.section._id],
    startsAt: new Date(Date.now() - 60000), endsAt: new Date(Date.now() + 7 * DAY),
  }, t.ownerToken);
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal(created.body.data.status, 'pending');
  assert.equal(created.body.data.productCount, 1);
  t.promoId = created.body.data._id;
  assert.equal((await Product.findById(t.arabica._id).lean()).price, 200, 'nothing changes before approval');

  const list = await call('GET', '/admin/marketplace/promotions?status=pending', null, t.adminToken);
  assert.equal(list.body.data[0].seller.nameEn, 'Roastery 1');
  const ok = await call('POST', `/admin/marketplace/promotions/${t.promoId}/review`, { decision: 'approve' }, t.adminToken);
  assert.equal(ok.status, 200, JSON.stringify(ok.body));

  const live = await Product.findById(t.arabica._id).lean();
  assert.equal(live.price, 160);
  assert.equal(live.oldPrice, 200);
  assert.equal(live.discount, 20);
  assert.equal(live.isOffer, true);
  assert.equal((await Product.findById(t.robusta._id).lean()).price, 200, 'out of scope');

  const edit = await call('PUT', '/seller/products/bulk-inventory', { items: [{ id: t.arabica._id, price: 150 }] }, t.ownerToken);
  assert.equal(edit.body.results[0].ok, false);
  assert.match(edit.body.results[0].error, /active promotion/);
  const stockOnly = await call('PUT', '/seller/products/bulk-inventory', { items: [{ id: t.arabica._id, stock: 4 }] }, t.ownerToken);
  assert.equal(stockOnly.body.results[0].ok, true, 'stock can still change');

  const cancel = await call('POST', `/seller/promotions/${t.promoId}/cancel`, null, t.ownerToken);
  assert.equal(cancel.body.data.status, 'cancelled');
  const back = await Product.findById(t.arabica._id).lean();
  assert.equal(back.price, 200);
  assert.equal(back.oldPrice, null);
  assert.equal(back.sellerPromotion, null);
});

test('the scheduler starts and ends approved promotions; no product is discounted twice', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const make = async (name, percent) => (await call('POST', '/seller/promotions', {
    name, percent, scope: 'all', startsAt: new Date(Date.now() + DAY), endsAt: new Date(Date.now() + 3 * DAY),
  }, t.ownerToken)).body.data;
  const first = await make('Store-wide 10', 10);
  const second = await make('Store-wide 30', 30);
  for (const p of [first, second]) {
    // eslint-disable-next-line no-await-in-loop
    await call('POST', `/admin/marketplace/promotions/${p._id}/review`, { decision: 'approve' }, t.adminToken);
  }
  assert.equal((await Product.findById(t.robusta._id).lean()).price, 200, 'future promotions wait');

  await SellerPromotion.updateMany({ _id: { $in: [first._id, second._id] } }, { $set: { startsAt: new Date(Date.now() - 1000) } });
  await runPromotionSchedule();
  const robusta = await Product.findById(t.robusta._id).lean();
  assert.equal(robusta.price, 180, 'the first promotion wins');
  assert.equal(robusta.oldPrice, 260, 'a higher "was" price is kept');
  const secondDoc = await SellerPromotion.findById(second._id).lean();
  assert.equal(secondDoc.applied.length, 0);
  assert.equal(secondDoc.skipped, 2);
  assert.equal((await Product.findById(t.foreign._id).lean()).price, 200, "another seller's products are never touched");

  await SellerPromotion.updateMany({ _id: { $in: [first._id, second._id] } }, { $set: { endsAt: new Date(Date.now() - 1000) } });
  await runPromotionSchedule();
  const restored = await Product.findById(t.robusta._id).lean();
  assert.equal(restored.price, 200);
  assert.equal(restored.oldPrice, 260);
  assert.equal((await SellerPromotion.findById(first._id).lean()).status, 'ended');
});

test('store page design: tagline, safe banners and own featured products only', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const res = await call('PUT', '/seller/me/storefront', {
    taglineEn: 'Fresh roast every Monday',
    banners: [
      { url: 'https://res.cloudinary.com/demo/image/upload/banner.jpg', link: '/en/sellers/x' },
      { url: 'https://evil.example/banner.jpg' },
    ],
    featuredProducts: [t.robusta._id, t.foreign._id, t.arabica._id],
  }, t.ownerToken);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.data.banners.length, 1, 'only our own image host');
  assert.deepEqual(res.body.data.featuredProducts, [t.robusta._id, t.arabica._id]);

  const pub = await call('GET', `/sellers/${t.slug}`);
  assert.equal(pub.body.data.storefront.taglineEn, 'Fresh roast every Monday');
  assert.deepEqual(pub.body.data.featuredProducts.map((p) => p.nameEn), ['Robusta', 'Arabica'], 'in the chosen order');
});

test('traffic: views and add-to-cart are counted per product', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  for (const type of ['view', 'view', 'view', 'cart']) {
    // eslint-disable-next-line no-await-in-loop
    assert.equal((await call('POST', '/product-events', { product: t.arabica._id, type })).status, 204);
  }
  await call('POST', '/product-events', { product: 'nope', type: 'view' });
  const report = await call('GET', '/seller/reports/traffic?days=7', null, t.ownerToken);
  assert.equal(report.status, 200, JSON.stringify(report.body));
  const row = report.body.data.products.find((p) => p.nameEn === 'Arabica');
  assert.equal(row.views, 3);
  assert.equal(row.carts, 1);
  assert.equal(row.cartRate, 33.3);
});
