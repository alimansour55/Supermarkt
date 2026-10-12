/**
 * Marketplace phase 3 — seller ledger, COD cash split, payouts and return reversals,
 * through real checkouts. Skips itself when MongoDB is not reachable.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

const MONGO_BASE = (process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/marketplus').replace(/\/[^/?]*(\?.*)?$/, '');
const TEST_DB_URI = `${MONGO_BASE}/marketplus_marketplace_finance_test`;

let mongoose;
let api;
let apiUrl;
let skip = false;
let Shipment;
let Order;
let SellerLedgerEntry;
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
const checkout = (items) => call('POST', '/orders', {
  items,
  shippingAddress: { street: '5 Nile St', city: 'Cairo', locationSource: 'manual' },
  phone: '+201033334444',
  paymentMethod: 'cod',
  deliveryMethod: 'scheduled',
  deliveryZoneId: 'cairo-helwan',
  timeSlotId: 'morning',
  scheduledDate: deliveryDate(),
}, t.customerToken);

before(async () => {
  Object.assign(process.env, {
    NODE_ENV: 'test',
    MONGODB_URI: TEST_DB_URI,
    JWT_SECRET: 'marketplace_finance_jwt_secret_at_least_32_chars',
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
  ({ default: Order } = await import('../src/models/Order.js'));
  ({ default: SellerLedgerEntry } = await import('../src/models/SellerLedgerEntry.js'));
  const { default: app } = await import('../src/app.js');
  const { generateToken } = await import('../src/utils/generateToken.js');

  api = await new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
  apiUrl = `http://127.0.0.1:${api.address().port}/api`;

  const admin = await User.create({ name: 'Admin', username: 'admin_fin', role: 'super_admin', password: 'adminpass123' });
  t.adminToken = generateToken(admin._id);
  const customer = await User.create({ name: 'Omar', phone: '+201033334444' });
  t.customerToken = generateToken(customer._id);
  const driver = await User.create({ name: 'Driver', username: 'driver_fin', role: 'driver', password: 'driverpass1', phone: '+201055556666' });
  t.driverId = driver._id;

  // No hold period and a low minimum, so earnings are payable as soon as they are delivered.
  const settings = await call('PUT', '/admin/marketplace/settings', { payoutHoldDays: 0, minPayoutAmount: 50 }, t.adminToken);
  assert.equal(settings.status, 200);

  const category = await Category.create({ nameAr: 'عسل', nameEn: 'Honey', slug: 'honey-fin', isActive: true });
  const makeSeller = async (n, allowed) => {
    const seller = await Seller.create({
      nameAr: `بائع ${n}`, nameEn: `Seller ${n}`, slug: `fin-seller-${n}`, status: 'active',
      allowedFulfillment: allowed, defaultFulfillment: allowed[0], email: `fin${n}@x.test`,
      bank: { bankName: 'CIB', accountName: `Seller ${n}`, accountNumber: `10020030${n.charCodeAt(0)}` },
    });
    const owner = await User.create({ name: `Owner ${n}`, email: `fin${n}@x.test`, password: 'sellerpass123', role: 'seller_owner', seller: seller._id });
    return { seller, token: generateToken(owner._id) };
  };
  t.A = await makeSeller('a', ['store']);
  t.B = await makeSeller('b', ['seller']);
  t.B.seller.commissionRate = 15;
  await t.B.seller.save();

  const product = (o) => Product.create({
    nameAr: 'منتج', nameEn: 'Item', price: 100, stock: 50, category: category._id,
    sku: `F-${Math.random().toString(36).slice(2, 8)}`, slug: `f-${Math.random().toString(36).slice(2, 8)}`, ...o,
  });
  t.storeProduct = await product({ nameEn: 'Store Tea', price: 80 });
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

test('COD cash is split: the seller collects its shipment, the driver collects the rest', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const res = await checkout([line(t.storeProduct, 1), line(t.aProduct, 1), line(t.bProduct, 2)]);
  assert.equal(res.status, 201, JSON.stringify(res.body));
  t.orderId = res.body.order.id;

  const order = await Order.findById(t.orderId).lean();
  const b = await Shipment.findOne({ order: t.orderId, seller: t.B.seller._id }).lean();
  assert.equal(b.collectAmount, 430, 'seller collects its lines + its delivery fee');
  assert.equal(order.sellerCollectAmount, 430);

  const { formatDriverOrder } = await import('../src/controllers/driver.controller.js');
  const driverView = formatDriverOrder(order);
  assert.equal(driverView.total, Math.round((order.total - 430) * 100) / 100, 'driver collects only the store share');
  assert.equal(driverView.items.length, 2, 'seller-shipped lines are not in the driver package');
  assert.equal(driverView.hasSellerShipments, true);
});

test('delivery posts the seller ledger once, netting cash the seller collected', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const b = await Shipment.findOne({ order: t.orderId, seller: t.B.seller._id });
  for (const status of ['confirmed', 'shipped', 'delivered']) {
    // eslint-disable-next-line no-await-in-loop
    const r = await call('POST', `/seller/shipments/${b._id}/status`, { status }, t.B.token);
    assert.equal(r.status, 200, JSON.stringify(r.body));
  }
  const fin = await call('GET', '/seller/finance', null, t.B.token);
  assert.equal(fin.status, 200);
  // 400 sale + 30 fee − 60 commission − 430 cash already collected = seller owes 60
  assert.equal(fin.body.data.balance.available, -60);

  const { postShipmentSettlement } = await import('../src/services/sellerLedger.service.js');
  await postShipmentSettlement(await Shipment.findById(b._id));
  assert.equal(await SellerLedgerEntry.countDocuments({ shipment: b._id }), 4, 'idempotent: no duplicates on re-post');
});

test('store-fulfilled seller items settle when the store delivers the order', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  for (const status of ['preparing', 'out_for_delivery', 'delivered']) {
    // eslint-disable-next-line no-await-in-loop
    const r = await call('PUT', `/orders/admin/${t.orderId}/status`, { orderStatus: status }, t.adminToken);
    assert.equal(r.status, 200, JSON.stringify(r.body));
  }
  const fin = await call('GET', '/seller/finance', null, t.A.token);
  assert.equal(fin.body.data.balance.available, 108, '120 sale − 12 commission, no cash collected');
});

test('payouts lock payable entries, refuse negative or tiny balances, and post on payment', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const refused = await call('POST', `/admin/marketplace/sellers/${t.B.seller._id}/payouts`, null, t.adminToken);
  assert.equal(refused.status, 400, 'seller B owes money — nothing to pay');

  const balances = await call('GET', '/admin/marketplace/finance/balances', null, t.adminToken);
  assert.equal(balances.body.data.find((r) => String(r.seller._id) === String(t.A.seller._id)).available, 108);

  const gen = await call('POST', `/admin/marketplace/sellers/${t.A.seller._id}/payouts`, null, t.adminToken);
  assert.equal(gen.status, 201, JSON.stringify(gen.body));
  assert.equal(gen.body.data.amount, 108);
  t.payoutId = gen.body.data._id;

  let fin = await call('GET', '/seller/finance', null, t.A.token);
  assert.equal(fin.body.data.balance.available, 0);
  assert.equal(fin.body.data.balance.inPayout, 108);

  const again = await call('POST', `/admin/marketplace/sellers/${t.A.seller._id}/payouts`, null, t.adminToken);
  assert.equal(again.status, 400, 'entries are locked in the pending payout');

  const csv = await call('GET', '/admin/marketplace/payouts/export', null, t.adminToken);
  assert.equal(csv.status, 200);
  assert.match(csv.text, /108\.00/);

  const paid = await call('POST', `/admin/marketplace/payouts/${t.payoutId}/paid`, { method: 'bank_transfer', referenceNumber: 'TRX-1' }, t.adminToken);
  assert.equal(paid.status, 200, JSON.stringify(paid.body));
  fin = await call('GET', '/seller/finance', null, t.A.token);
  assert.deepEqual(
    { available: fin.body.data.balance.available, inPayout: fin.body.data.balance.inPayout, paidOut: fin.body.data.balance.paidOut },
    { available: 0, inPayout: 0, paidOut: 108 },
  );
  assert.equal((await call('POST', `/admin/marketplace/payouts/${t.payoutId}/paid`, {}, t.adminToken)).status, 400);
});

test('cancelling a pending payout releases its entries', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const adj = await call('POST', `/admin/marketplace/sellers/${t.A.seller._id}/adjustments`, { amount: 75, note: 'Late-delivery compensation' }, t.adminToken);
  assert.equal(adj.status, 201);
  const gen = await call('POST', `/admin/marketplace/sellers/${t.A.seller._id}/payouts`, null, t.adminToken);
  assert.equal(gen.body.data.amount, 75);
  const cancel = await call('POST', `/admin/marketplace/payouts/${gen.body.data._id}/cancel`, null, t.adminToken);
  assert.equal(cancel.status, 200);
  const fin = await call('GET', '/seller/finance', null, t.A.token);
  assert.equal(fin.body.data.balance.available, 75);
});

test('a seller settling its debt clears the balance; sellers only ever see their own money', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const noNote = await call('POST', `/admin/marketplace/sellers/${t.B.seller._id}/adjustments`, { amount: 60 }, t.adminToken);
  assert.equal(noNote.status, 400);
  await call('POST', `/admin/marketplace/sellers/${t.B.seller._id}/adjustments`, { amount: 60, note: 'Commission paid in cash' }, t.adminToken);
  const fin = await call('GET', '/seller/finance', null, t.B.token);
  assert.equal(fin.body.data.balance.available, 0);

  const ledgerB = await call('GET', '/seller/finance/ledger', null, t.B.token);
  assert.ok(ledgerB.body.data.every((e) => String(e.seller) === String(t.B.seller._id)));
  assert.equal((await call('GET', `/admin/marketplace/sellers/${t.A.seller._id}/ledger`, null, t.B.token)).status, 403);
});

test('an approved return takes back the line value and gives back its commission', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const order = await Order.findById(t.orderId);
  const aIndex = order.items.findIndex((it) => String(it.seller) === String(t.A.seller._id));
  const { postReturnReversal } = await import('../src/services/sellerLedger.service.js');
  const returnDoc = { _id: new mongoose.Types.ObjectId(), itemIndex: aIndex, quantity: 1 };
  await postReturnReversal(order, returnDoc);
  await postReturnReversal(order, returnDoc);
  const entries = await SellerLedgerEntry.find({ key: { $regex: `^ret:${returnDoc._id}` } }).lean();
  assert.equal(entries.length, 2, 'idempotent per return');
  assert.equal(entries.find((e) => e.type === 'return').amount, -120);
  assert.equal(entries.find((e) => e.type === 'commission_reversal').amount, 12);
  const fin = await call('GET', '/seller/finance', null, t.A.token);
  assert.equal(fin.body.data.balance.available, 75 - 108);
});

test('seller-only orders cannot be driven by the store', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const res = await checkout([line(t.bProduct, 1)]);
  const orderId = res.body.order.id;
  const status = await call('PUT', `/orders/admin/${orderId}/status`, { orderStatus: 'out_for_delivery' }, t.adminToken);
  assert.equal(status.status, 400);
  const assign = await call('PUT', `/orders/admin/${orderId}/assign-driver`, { driverId: String(t.driverId) }, t.adminToken);
  assert.equal(assign.status, 400);

  // Seller cancels → the seller no longer collects that cash.
  const sh = await Shipment.findOne({ order: orderId });
  await call('POST', `/seller/shipments/${sh._id}/status`, { status: 'cancelled', note: 'Damaged stock' }, t.B.token);
  const after = await Order.findById(orderId).lean();
  assert.equal(after.sellerCollectAmount, 0);
  assert.equal(after.total, 0);
});

test('cancelling a shipment of a transfer-paid order flags a manual refund instead of lowering the total', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const { default: Product } = await import('../src/models/Product.js');
  const bProduct = await Product.findOne({ nameEn: 'B Oil' }).lean();
  const order = await Order.create({
    orderNumber: `TRF-${Date.now()}`,
    user: (await (await import('../src/models/User.js')).default.findOne({ phone: '+201033334444' }))._id,
    items: [{ product: bProduct._id, nameAr: 'زيت', nameEn: 'B Oil', price: 200, quantity: 1, seller: t.B.seller._id, fulfilledBy: 'seller' }],
    shippingAddress: { street: '5 Nile St', city: 'Cairo' },
    phone: '+201033334444',
    subtotal: 200,
    deliveryFee: 30,
    total: 230,
    paymentMethod: 'instapay',
    paymentStatus: 'pending',
    orderStatus: 'pending',
    hasStoreItems: false,
    sellerIds: [t.B.seller._id],
  });
  const shipment = await Shipment.create({
    order: order._id, orderNumber: order.orderNumber, shipmentNumber: `${order.orderNumber}-S1`,
    seller: t.B.seller._id, fulfilledBy: 'seller', paymentMethod: 'instapay',
    items: [{ itemIndex: 0, product: bProduct._id, price: 200, quantity: 1, lineTotal: 200 }],
    subtotal: 200, deliveryFee: 30, statusHistory: [{ status: 'pending' }],
  });
  const res = await call('POST', `/seller/shipments/${shipment._id}/status`, { status: 'cancelled', note: 'Sold out' }, t.B.token);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.data.refund.status, 'manual_required', 'the customer already transferred the money');
  assert.equal(res.body.data.refund.amount, 230);
  assert.equal((await Order.findById(order._id).lean()).total, 230, 'the order total is not silently reduced');
});
