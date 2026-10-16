/**
 * Seller fees & profit — plans, commission rules, fixed/payment fees, VAT, the fee preview,
 * the profit report, penalties, monthly plan fees and automatic payout runs, through real
 * checkouts. Skips itself when MongoDB is not reachable.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

const MONGO_BASE = (process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/marketplus').replace(/\/[^/?]*(\?.*)?$/, '');
const TEST_DB_URI = `${MONGO_BASE}/marketplus_marketplace_fees_test`;

let mongoose;
let api;
let apiUrl;
let skip = false;
let Shipment;
let SellerLedgerEntry;
let SellerPayout;
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

const deliveryDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date(Date.now() + 2 * 86400000));
const line = (p, quantity) => ({ productId: String(p._id), quantity, price: p.price, name: p.nameAr, nameEn: p.nameEn });

before(async () => {
  Object.assign(process.env, {
    NODE_ENV: 'test',
    MONGODB_URI: TEST_DB_URI,
    JWT_SECRET: 'marketplace_fees_jwt_secret_at_least_32_chars_ok',
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
  ({ default: SellerLedgerEntry } = await import('../src/models/SellerLedgerEntry.js'));
  ({ default: SellerPayout } = await import('../src/models/SellerPayout.js'));
  const { default: app } = await import('../src/app.js');
  const { generateToken } = await import('../src/utils/generateToken.js');

  api = await new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
  apiUrl = `http://127.0.0.1:${api.address().port}/api`;

  const admin = await User.create({ name: 'Admin', username: 'admin_fees', role: 'super_admin', password: 'adminpass123' });
  t.adminToken = generateToken(admin._id);
  const customer = await User.create({ name: 'Omar', phone: '+201077778888' });
  t.customerToken = generateToken(customer._id);

  t.category = await Category.create({ nameAr: 'عسل', nameEn: 'Honey', slug: 'honey-fees', isActive: true });
  const makeSeller = async (n, allowed) => {
    const seller = await Seller.create({
      nameAr: `بائع ${n}`, nameEn: `Seller ${n}`, slug: `fees-seller-${n}`, status: 'active', approvedAt: new Date('2025-01-01'),
      allowedFulfillment: allowed, defaultFulfillment: allowed[0], email: `fees${n}@x.test`,
      bank: { bankName: 'CIB', accountName: `Seller ${n}`, accountNumber: `5002003${n.charCodeAt(0)}` },
    });
    const owner = await User.create({ name: `Owner ${n}`, email: `fees${n}@x.test`, password: 'sellerpass123', role: 'seller_owner', seller: seller._id });
    return { seller, token: generateToken(owner._id) };
  };
  t.A = await makeSeller('a', ['store']);
  t.B = await makeSeller('b', ['seller']);

  const product = (o) => Product.create({
    nameAr: 'منتج', nameEn: 'Item', price: 100, stock: 50, category: t.category._id,
    sku: `FE-${Math.random().toString(36).slice(2, 8)}`, slug: `fe-${Math.random().toString(36).slice(2, 8)}`, ...o,
  });
  t.aProduct = await product({ nameEn: 'A Honey', price: 120, seller: t.A.seller._id, fulfilledBy: 'store', listingStatus: 'approved' });
  t.bProduct = await product({ nameEn: 'B Oil', price: 200, seller: t.B.seller._id, fulfilledBy: 'seller', listingStatus: 'approved' });
});

after(async () => {
  if (mongoose?.connection?.readyState === 1) {
    if (!skip) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
  api?.close();
});

test('fee setup is validated and saved', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const bad = await call('PUT', '/admin/marketplace/settings', { fees: { minCommissionPerItem: 50, maxCommissionPerItem: 10 } }, t.adminToken);
  assert.equal(bad.status, 400);

  const { cairoDayParts } = await import('../src/utils/sellerFees.js');
  const res = await call('PUT', '/admin/marketplace/settings', {
    payoutHoldDays: 0,
    minPayoutAmount: 50,
    defaultCommissionRate: 10,
    fees: { fixedFeePerItem: 2, fixedFeePerShipment: 5, vatPercent: 14, paymentFees: [{ method: 'cod', percent: 0, fixed: 3 }] },
    plans: [
      { key: 'basic', nameEn: 'Basic', isDefault: true },
      { key: 'pro', nameEn: 'Pro', commissionRate: 7, fixedFeePerItem: 0, monthlyFee: 300 },
    ],
    commissionRules: [
      { name: 'Expired', rate: 1, endsAt: '2020-01-01' },
      { name: 'Honey week', rate: 4, categories: [String(t.category._id)] },
    ],
    payoutSchedule: { frequency: 'weekly', weekday: cairoDayParts(new Date()).weekday },
  }, t.adminToken);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.data.plans.length, 2);
  assert.equal(res.body.data.commissionRules[1].rate, 4);

  const plan = await call('PUT', `/admin/marketplace/sellers/${t.A.seller._id}`, { feePlan: 'pro' }, t.adminToken);
  assert.equal(plan.status, 200, JSON.stringify(plan.body));
  assert.equal(plan.body.data.feePlan, 'pro');
  assert.equal((await call('PUT', `/admin/marketplace/sellers/${t.A.seller._id}`, { feePlan: 'nope' }, t.adminToken)).status, 400);
  const deal = await call('PUT', `/admin/marketplace/sellers/${t.B.seller._id}`, { commissionRate: 15, feeOverrides: { fixedFeePerShipment: 1 } }, t.adminToken);
  assert.equal(deal.status, 200);
  assert.equal(deal.body.data.feeOverrides.fixedFeePerShipment, 1);
});

test('the fee preview matches what checkout charges', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const preview = await call('POST', '/admin/marketplace/fees/preview', {
    sellerId: String(t.A.seller._id), productId: String(t.aProduct._id), price: 120, fulfilledBy: 'store', paymentMethod: 'cod',
  }, t.adminToken);
  assert.equal(preview.status, 200, JSON.stringify(preview.body));
  assert.equal(preview.body.data.items[0].commissionRule, 'Honey week');
  assert.equal(preview.body.data.monthlyFee, 300);

  const res = await call('POST', '/orders', {
    items: [line(t.aProduct, 1), line(t.bProduct, 1)],
    shippingAddress: { street: '5 Nile St', city: 'Cairo', locationSource: 'manual' },
    phone: '+201077778888',
    paymentMethod: 'cod',
    deliveryMethod: 'scheduled',
    deliveryZoneId: 'cairo-helwan',
    timeSlotId: 'morning',
    scheduledDate: deliveryDate(),
  }, t.customerToken);
  assert.equal(res.status, 201, JSON.stringify(res.body));
  t.orderId = res.body.order.id;

  const a = await Shipment.findOne({ order: t.orderId, seller: t.A.seller._id }).lean();
  // Rule 4% of 120, pro plan: no per-item fee, 5 per shipment, 3 COD fee, 14% VAT on 12.8.
  assert.deepEqual(
    { c: a.commissionTotal, fixed: a.fixedFees, pay: a.paymentFee, vat: a.feeVat, net: a.sellerNet, plan: a.feePlan },
    { c: 4.8, fixed: 5, pay: 3, vat: 1.79, net: 105.41, plan: 'pro' },
  );
  assert.equal(a.sellerNet, preview.body.data.sellerNet);

  const b = await Shipment.findOne({ order: t.orderId, seller: t.B.seller._id }).lean();
  // Seller deal 15% beats the rule; basic plan → 2 per item; its own 1 per shipment.
  assert.deepEqual(
    { c: b.commissionTotal, fixed: b.fixedFees, pay: b.paymentFee, vat: b.feeVat, src: b.items[0].commissionSource },
    { c: 30, fixed: 3, pay: 3, vat: 5.04, src: 'seller' },
  );
});

test('delivery posts every fee and the profit report adds them up', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const b = await Shipment.findOne({ order: t.orderId, seller: t.B.seller._id });
  for (const status of ['confirmed', 'shipped', 'delivered']) {
    // eslint-disable-next-line no-await-in-loop
    const r = await call('POST', `/seller/shipments/${b._id}/status`, { status }, t.B.token);
    assert.equal(r.status, 200, JSON.stringify(r.body));
  }
  for (const status of ['preparing', 'out_for_delivery', 'delivered']) {
    // eslint-disable-next-line no-await-in-loop
    const r = await call('PUT', `/orders/admin/${t.orderId}/status`, { orderStatus: status }, t.adminToken);
    assert.equal(r.status, 200, JSON.stringify(r.body));
  }
  const aFin = await call('GET', '/seller/finance', null, t.A.token);
  assert.equal(aFin.body.data.balance.available, 105.41);
  assert.equal(aFin.body.data.fees.plan.key, 'pro');

  const pen = await call('POST', `/admin/marketplace/sellers/${t.B.seller._id}/penalties`, { amount: 50, reason: 'late_shipment', note: 'Shipped 3 days late' }, t.adminToken);
  assert.equal(pen.status, 201, JSON.stringify(pen.body));
  assert.equal((await call('POST', `/admin/marketplace/sellers/${t.B.seller._id}/penalties`, { amount: 5, reason: 'mood' }, t.adminToken)).status, 400);

  const report = await call('GET', '/admin/marketplace/profit', null, t.adminToken);
  assert.equal(report.status, 200, JSON.stringify(report.body));
  const tot = report.body.data.totals;
  assert.equal(tot.sales, 320);
  assert.equal(tot.commission, 34.8);
  assert.equal(tot.fixedFees, 8);
  assert.equal(tot.paymentFees, 6);
  assert.equal(tot.penalties, 50);
  assert.equal(tot.feeIncome, 98.8);
  assert.equal(tot.vat, 6.83);
  assert.equal(report.body.data.sellers.length, 2);
  assert.equal(report.body.data.categories[0].nameEn, 'Honey');

  const one = await call('GET', `/admin/marketplace/profit?sellerId=${t.A.seller._id}`, null, t.adminToken);
  assert.equal(one.body.data.totals.feeIncome, 12.8);

  const csv = await call('GET', '/admin/marketplace/profit/export', null, t.adminToken);
  assert.equal(csv.status, 200);
  assert.match(csv.text, /Seller a/);
});

test('automatic payout runs once per run; plan fees once per month', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const { runScheduledPayouts, runSubscriptionFees } = await import('../src/services/sellerLedger.service.js');
  assert.equal(await runScheduledPayouts(), 1, 'seller A has 105.41 payable; B owes money');
  assert.equal(await runScheduledPayouts(), 0, 'same run → no second payout');
  const payout = await SellerPayout.findOne({ seller: t.A.seller._id }).lean();
  assert.equal(payout.amount, 105.41);
  assert.ok(payout.scheduleKey);

  assert.equal(await runSubscriptionFees(), 1, 'only the pro plan has a monthly fee');
  assert.equal(await runSubscriptionFees(), 0);
  const sub = await SellerLedgerEntry.findOne({ seller: t.A.seller._id, type: 'subscription_fee' }).lean();
  assert.equal(sub.amount, -300);
});
