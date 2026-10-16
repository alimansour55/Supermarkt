/**
 * Seller lifecycle and paperwork: closing (blocked by open parcels, balance acknowledgement,
 * logins off) and reopening (logins back), terms versions, document expiry reminders,
 * per-product commission, monthly statements & fee invoices, bulk status / message, and the
 * Sellers-list filters. Skips itself when MongoDB is not reachable.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

const MONGO_BASE = (process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/marketplus').replace(/\/[^/?]*(\?.*)?$/, '');
const TEST_DB_URI = `${MONGO_BASE}/marketplus_marketplace_lifecycle_test`;

let mongoose;
let api;
let apiUrl;
let skip = false;
let User;
let Seller;
let Shipment;
let SellerLedgerEntry;
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
  return { status: res.status, body: json, text };
}

before(async () => {
  Object.assign(process.env, {
    NODE_ENV: 'test',
    MONGODB_URI: TEST_DB_URI,
    JWT_SECRET: 'marketplace_lifecycle_jwt_secret_at_least_32_ch',
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
  ({ default: Seller } = await import('../src/models/Seller.js'));
  ({ default: Shipment } = await import('../src/models/Shipment.js'));
  ({ default: SellerLedgerEntry } = await import('../src/models/SellerLedgerEntry.js'));
  ({ default: Product } = await import('../src/models/Product.js'));
  const { default: Category } = await import('../src/models/Category.js');
  const { default: app } = await import('../src/app.js');
  const { generateToken } = await import('../src/utils/generateToken.js');

  api = await new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
  apiUrl = `http://127.0.0.1:${api.address().port}/api`;

  const admin = await User.create({ name: 'Boss', username: 'boss_life', role: 'super_admin', password: 'adminpass123' });
  t.token = generateToken(admin._id);

  const make = async (n, extra = {}) => {
    const seller = await Seller.create({ nameAr: `بائع ${n}`, nameEn: `Seller ${n}`, slug: `life-${n}`, status: 'active', ...extra });
    const owner = await User.create({ name: `Owner ${n}`, email: `life${n}@x.test`, password: 'sellerpass123', role: 'seller_owner', seller: seller._id });
    const staff = await User.create({ name: `Staff ${n}`, email: `staff${n}@x.test`, password: 'sellerpass123', role: 'seller_staff', seller: seller._id });
    seller.owner = owner._id;
    await seller.save();
    return { seller, owner, staff, token: generateToken(owner._id, { sv: 0 }) };
  };
  t.A = await make('a');
  t.B = await make('b', { feePlan: 'pro' });
  t.C = await make('c');

  const cat = await Category.create({ nameAr: 'عسل', nameEn: 'Honey', slug: 'honey-life', isActive: true });
  t.product = await Product.create({
    nameAr: 'عسل', nameEn: 'Honey jar', price: 200, stock: 10, category: cat._id, seller: t.A.seller._id,
    listingStatus: 'approved', fulfilledBy: 'seller', sku: 'LF-1', slug: 'lf-1',
  });
});

after(async () => {
  if (mongoose?.connection?.readyState === 1) {
    if (!skip) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
  api?.close();
});

const S = (x) => `/admin/marketplace/sellers/${x.seller._id}`;

test('per-product commission beats the seller deal at checkout pricing', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  await call('PUT', S(t.A), { commissionRate: 12 }, t.token);
  assert.equal((await call('PUT', `/admin/marketplace/listings/${t.product._id}/commission`, { rate: 140 }, t.token)).status, 400);
  const set = await call('PUT', `/admin/marketplace/listings/${t.product._id}/commission`, { rate: 4 }, t.token);
  assert.equal(set.status, 200, set.text);
  const preview = await call('POST', '/admin/marketplace/fees/preview', { sellerId: String(t.A.seller._id), productId: String(t.product._id), price: 200, quantity: 1 }, t.token);
  assert.equal(preview.status, 200, preview.text);
  assert.deepEqual([preview.body.data.items[0].commissionRate, preview.body.data.items[0].commissionSource], [4, 'product']);
  assert.equal((await call('PUT', `/admin/marketplace/listings/${t.product._id}/commission`, { rate: null }, t.token)).status, 200);
  assert.equal((await Product.findById(t.product._id)).sellerCommissionRate, null);
});

test('closing: blocked by open parcels, needs balance OK, turns logins off; reopening turns them on', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const parcel = await Shipment.collection.insertOne({
    seller: t.A.seller._id, order: new mongoose.Types.ObjectId(), orderNumber: 'ORD-L1', shipmentNumber: 'SH-L1',
    fulfilledBy: 'seller', status: 'confirmed', subtotal: 100, createdAt: new Date(),
  });
  const check = await call('GET', `${S(t.A)}/closure-check`, null, t.token);
  assert.equal(check.body.data.openParcels, 1);
  const blocked = await call('POST', `${S(t.A)}/status`, { status: 'closed', reason: 'Owner asked' }, t.token);
  assert.equal(blocked.status, 400);
  assert.match(blocked.body.message, /open parcel/);

  await Shipment.collection.updateOne({ _id: parcel.insertedId }, { $set: { status: 'delivered' } });
  await SellerLedgerEntry.create({ seller: t.A.seller._id, type: 'sale', amount: 150, availableAt: new Date(Date.now() - 1000), key: 'life-sale-1' });
  const needsOk = await call('POST', `${S(t.A)}/status`, { status: 'closed', reason: 'Owner asked' }, t.token);
  assert.equal(needsOk.status, 409);

  const closed = await call('POST', `${S(t.A)}/status`, { status: 'closed', reason: 'Owner asked', acknowledgeBalance: true }, t.token);
  assert.equal(closed.status, 200, closed.text);
  assert.equal(closed.body.result.loginsTurnedOff, 2);
  assert.equal(closed.body.result.owed, 150);
  assert.equal(await User.countDocuments({ seller: t.A.seller._id, isActive: true }), 0);
  assert.equal((await call('POST', '/auth/seller-login', { email: 'lifea@x.test', password: 'sellerpass123' })).status, 401);
  assert.equal((await Product.findById(t.product._id)).isActive, false, 'listings hidden');

  // Money still owed can be paid out after closing.
  assert.equal((await call('POST', `${S(t.A)}/payouts`, {}, t.token)).status, 201);

  const reopened = await call('POST', `${S(t.A)}/status`, { status: 'active', reason: 'Back in business' }, t.token);
  assert.equal(reopened.status, 200, reopened.text);
  assert.equal(reopened.body.result.loginsTurnedOn, 2);
  assert.equal((await call('POST', '/auth/seller-login', { email: 'lifea@x.test', password: 'sellerpass123' })).status, 200);
});

test('terms versions: publish → owner must accept; the list can filter who has not', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  await call('PUT', '/admin/marketplace/settings', { termsAr: 'الشروط', termsEn: 'Terms v2', publishTermsVersion: true }, t.token);
  const me = await call('GET', '/seller/me', null, t.B.token);
  assert.equal(me.body.data.marketplace.needsTerms, true);
  assert.equal(me.body.data.marketplace.termsVersion, 2);

  const pending = await call('GET', '/admin/marketplace/sellers?terms=pending', null, t.token);
  assert.equal(pending.body.data.length, 3);

  const staffToken = (await import('../src/utils/generateToken.js')).generateToken(t.B.staff._id, { sv: 0 });
  assert.equal((await call('POST', '/seller/me/accept-terms', {}, staffToken)).status, 403, 'only the owner accepts');
  assert.equal((await call('POST', '/seller/me/accept-terms', {}, t.B.token)).status, 200);
  assert.equal((await call('GET', '/seller/me', null, t.B.token)).body.data.marketplace.needsTerms, false);
  const detail = await call('GET', S(t.B), null, t.token);
  assert.deepEqual([detail.body.data.terms.acceptedVersion, detail.body.data.terms.needsAcceptance], [2, false]);
  assert.equal((await call('GET', '/admin/marketplace/sellers?terms=pending', null, t.token)).body.data.length, 2);
});

test('document expiry: staff set a date; reminders at 30 and 7 days, then expired', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const seller = await Seller.findById(t.C.seller._id);
  seller.documents.push({ type: seller.schema.path('documents').schema.path('type').enumValues[0], publicId: 'x', status: 'pending' });
  await seller.save();
  const docId = seller.documents[0]._id;
  const now = new Date();
  const expires = new Date(now.getTime() + 40 * 86400000);
  const res = await call('PUT', `${S(t.C)}/documents/${docId}`, { status: 'accepted', expiresAt: expires.toISOString() }, t.token);
  assert.equal(res.status, 200, res.text);

  const { runDocumentExpiry } = await import('../src/services/sellerLifecycle.service.js');
  const day = 86400000;
  assert.deepEqual(await runDocumentExpiry(now), { reminded: 0, expired: 0 });
  assert.deepEqual(await runDocumentExpiry(new Date(now.getTime() + 11 * day)), { reminded: 1, expired: 0 }, '29 days left');
  assert.deepEqual(await runDocumentExpiry(new Date(now.getTime() + 12 * day)), { reminded: 0, expired: 0 }, 'not twice');
  assert.deepEqual(await runDocumentExpiry(new Date(now.getTime() + 34 * day)), { reminded: 1, expired: 0 }, '6 days left');
  assert.equal((await call('GET', '/admin/marketplace/sellers?docs=expiring', null, t.token)).body.data.length, 0, '40 days away by the real clock');
  assert.deepEqual(await runDocumentExpiry(new Date(now.getTime() + 41 * day)), { reminded: 0, expired: 1 });
  assert.equal((await Seller.findById(t.C.seller._id)).documents[0].status, 'expired');
  const expiringList = await call('GET', '/admin/marketplace/sellers?docs=expiring', null, t.token);
  assert.deepEqual(expiringList.body.data.map((s) => s.slug), ['life-c'], 'expired documents are listed');
});

test('monthly statement and fee invoice totals; CSV', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const at = new Date();
  const month = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit' }).format(at);
  await SellerLedgerEntry.insertMany([
    { seller: t.C.seller._id, type: 'sale', amount: 1000, availableAt: at, key: 'st-1' },
    { seller: t.C.seller._id, type: 'commission', amount: -100, availableAt: at, key: 'st-2' },
    { seller: t.C.seller._id, type: 'fixed_fee', amount: -10, availableAt: at, key: 'st-3' },
    { seller: t.C.seller._id, type: 'fee_vat', amount: -15.4, availableAt: at, key: 'st-4' },
    { seller: t.C.seller._id, type: 'commission_reversal', amount: 20, availableAt: at, key: 'st-5' },
    { seller: t.C.seller._id, type: 'penalty', amount: -50, availableAt: at, key: 'st-6' },
  ]);
  const res = await call('GET', `${S(t.C)}/statement?month=${month}`, null, t.token);
  assert.equal(res.status, 200, res.text);
  const tot = res.body.data.totals;
  assert.deepEqual([tot.sales, tot.fees, tot.vat, tot.penalties, tot.net], [1000, 90, 15.4, 50, 844.6]);
  assert.deepEqual(res.body.data.totals.invoiceLines.map((l) => [l.type, l.amount]), [['commission', 100], ['commission_reversal', -20], ['fixed_fee', 10]]);
  assert.equal(res.body.data.closingBalance, 844.6);
  assert.match(res.body.data.invoiceNumber, /^SF-LIFE-C-\d{6}$/);
  assert.equal((await call('GET', `${S(t.C)}/statement?month=2026-13`, null, t.token)).status, 400);

  const csv = await call('GET', `${S(t.C)}/statement?month=${month}&format=csv`, null, t.token);
  assert.match(csv.text, /opening_balance/);
  assert.match(csv.text, /closing_balance,.*844\.6/);
  const mine = await call('GET', `/seller/finance/statement?month=${month}`, null, t.C.token);
  assert.equal(mine.body.data.totals.net, 844.6);
});

test('bulk suspend / activate and bulk message; list filters by plan and money owed', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const ids = [t.B.seller._id, t.C.seller._id].map(String);
  assert.equal((await call('POST', '/admin/marketplace/sellers/bulk-status', { sellerIds: ids, status: 'suspended' }, t.token)).status, 400, 'reason needed');
  const sus = await call('POST', '/admin/marketplace/sellers/bulk-status', { sellerIds: ids, status: 'suspended', reason: 'Audit' }, t.token);
  assert.equal(sus.body.data.updated, 2);
  const back = await call('POST', '/admin/marketplace/sellers/bulk-status', { sellerIds: [...ids, String(t.A.seller._id)], status: 'active' }, t.token);
  assert.deepEqual([back.body.data.updated, back.body.data.skipped.length], [2, 1]);

  const msg = await call('POST', '/admin/marketplace/sellers/bulk-message', { sellerIds: ids, body: 'Ramadan hours change' }, t.token);
  assert.equal(msg.body.data.sent, 2);
  assert.equal((await call('GET', '/seller/summary', null, t.B.token)).body.data.unreadStoreMessages, 1);

  assert.deepEqual((await call('GET', '/admin/marketplace/sellers?plan=pro', null, t.token)).body.data.map((s) => s.slug), ['life-b']);
  const owed = await call('GET', '/admin/marketplace/sellers?balance=owed', null, t.token);
  assert.deepEqual(owed.body.data.map((s) => s.slug), ['life-c']);
});
