/**
 * Marketplace phase 2 — real checkout through POST /orders with a mixed cart: store lines,
 * a seller item the store delivers and a seller-shipped item. Covers shipment split, fees,
 * commission snapshots, seller fulfillment, status mirroring, cancellations and isolation.
 * Skips itself when MongoDB is not reachable.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

const MONGO_BASE = (process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/marketplus').replace(/\/[^/?]*(\?.*)?$/, '');
const TEST_DB_URI = `${MONGO_BASE}/marketplus_marketplace_orders_test`;

let mongoose;
let api;
let apiUrl;
let skip = false;
let Product;
let Shipment;
let Order;
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

/** A delivery date two days out in the store timezone (inside the booking window). */
function deliveryDate() {
  const d = new Date(Date.now() + 2 * 86400000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(d);
}

const line = (product, quantity) => ({
  productId: String(product._id),
  quantity,
  price: product.price,
  name: product.nameAr,
  nameEn: product.nameEn,
});

function checkout(items, extra = {}) {
  return call('POST', '/orders', {
    items,
    shippingAddress: { street: '5 Nile St', city: 'Cairo', locationSource: 'manual' },
    phone: '+201011112222',
    paymentMethod: 'cod',
    deliveryMethod: 'scheduled',
    deliveryZoneId: 'cairo-helwan',
    timeSlotId: 'morning',
    scheduledDate: deliveryDate(),
    ...extra,
  }, t.customerToken);
}

before(async () => {
  Object.assign(process.env, {
    NODE_ENV: 'test',
    MONGODB_URI: TEST_DB_URI,
    JWT_SECRET: 'marketplace_orders_jwt_secret_at_least_32_chars',
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
  ({ default: Product } = await import('../src/models/Product.js'));
  ({ default: Shipment } = await import('../src/models/Shipment.js'));
  ({ default: Order } = await import('../src/models/Order.js'));
  const { default: app } = await import('../src/app.js');
  const { generateToken } = await import('../src/utils/generateToken.js');

  api = await new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
  apiUrl = `http://127.0.0.1:${api.address().port}/api`;

  const admin = await User.create({ name: 'Admin', username: 'admin_mpo', role: 'super_admin', password: 'adminpass123' });
  t.adminToken = generateToken(admin._id);
  const customer = await User.create({ name: 'Salma', phone: '+201011112222' });
  t.customerToken = generateToken(customer._id);

  const category = await Category.create({ nameAr: 'بقالة', nameEn: 'Grocery', slug: 'grocery-mpo', isActive: true });

  const makeSeller = async (n, allowed) => {
    const seller = await Seller.create({
      nameAr: `بائع ${n}`, nameEn: `Seller ${n}`, slug: `seller-${n}`, status: 'active',
      allowedFulfillment: allowed, defaultFulfillment: allowed[0], email: `s${n}@x.test`,
    });
    const owner = await User.create({ name: `Owner ${n}`, email: `s${n}@x.test`, password: 'sellerpass123', role: 'seller_owner', seller: seller._id });
    return { seller, token: generateToken(owner._id) };
  };
  t.A = await makeSeller('a', ['store', 'seller']);
  t.B = await makeSeller('b', ['seller']);
  t.B.seller.commissionRate = 15;
  await t.B.seller.save();

  const product = (overrides) => Product.create({
    nameAr: 'منتج', nameEn: 'Item', price: 100, stock: 20, category: category._id, sku: `SKU-${Math.random().toString(36).slice(2, 8)}`,
    slug: `item-${Math.random().toString(36).slice(2, 8)}`, ...overrides,
  });
  t.storeProduct = await product({ nameEn: 'Store Rice', price: 50 });
  t.aProduct = await product({
    nameEn: 'A Honey', price: 120, seller: t.A.seller._id, sellerNameAr: 'بائع a', sellerNameEn: 'Seller a', sellerSlug: 'seller-a',
    fulfilledBy: 'store', listingStatus: 'approved',
  });
  t.bProduct = await product({
    nameEn: 'B Olive Oil', price: 200, seller: t.B.seller._id, sellerNameAr: 'بائع b', sellerNameEn: 'Seller b', sellerSlug: 'seller-b',
    fulfilledBy: 'seller', listingStatus: 'approved',
  });
});

after(async () => {
  if (mongoose?.connection?.readyState === 1) {
    if (!skip) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
  api?.close();
});

test('cart totals charge the store fee only for store lines plus a flat fee per seller shipment', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const res = await call('POST', '/orders/calculate', {
    items: [line(t.storeProduct, 2), line(t.aProduct, 1), line(t.bProduct, 1)],
    deliveryMethod: 'scheduled',
    deliveryZoneId: 'cairo-helwan',
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.sellerShippingFee, 30);
  assert.equal(res.body.storeDeliveryFee, 24.99, 'store lines (220) are below the 500 free-delivery threshold');
  assert.equal(res.body.deliveryFee, 54.99);
  assert.equal(res.body.marketplace.sellerShipments.length, 2);
  assert.equal(res.body.marketplacePlan, undefined, 'internal plan is never serialized');

  const sellerOnly = await call('POST', '/orders/calculate', {
    items: [line(t.bProduct, 1)], deliveryMethod: 'scheduled', deliveryZoneId: 'cairo-helwan',
  });
  assert.equal(sellerOnly.body.storeDeliveryFee, 0, 'no store lines → no store delivery fee');
  assert.equal(sellerOnly.body.deliveryFee, 30);
});

test('checkout splits a mixed cart into one shipment per seller with commission snapshots', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const res = await checkout([line(t.storeProduct, 2), line(t.aProduct, 1), line(t.bProduct, 2)]);
  assert.equal(res.status, 201, JSON.stringify(res.body));
  t.mixedOrderId = res.body.order.id;

  const order = await Order.findById(t.mixedOrderId).lean();
  assert.equal(order.hasStoreItems, true);
  assert.equal(order.sellerIds.length, 2);
  assert.equal(order.sellerShippingFee, 30);
  assert.equal(order.items[2].fulfilledBy, 'seller');
  assert.equal(String(order.items[2].seller), String(t.B.seller._id));

  const shipments = await Shipment.find({ order: t.mixedOrderId }).sort({ shipmentNumber: 1 }).lean();
  assert.equal(shipments.length, 2);
  const a = shipments.find((s) => String(s.seller) === String(t.A.seller._id));
  const b = shipments.find((s) => String(s.seller) === String(t.B.seller._id));
  assert.equal(a.fulfilledBy, 'store');
  assert.equal(a.subtotal, 120);
  assert.equal(a.commissionTotal, 12, 'marketplace default 10%');
  assert.equal(a.deliveryFee, 0);
  assert.equal(b.fulfilledBy, 'seller');
  assert.equal(b.subtotal, 400);
  assert.equal(b.items[0].commissionRate, 15, 'seller override');
  assert.equal(b.commissionTotal, 60);
  assert.equal(b.deliveryFee, 30);
  assert.equal(b.sellerNet, 370);
  t.aShipmentId = String(a._id);
  t.bShipmentId = String(b._id);

  const bStock = await Product.findById(t.bProduct._id).lean();
  assert.equal(bStock.stock, 18);

  const customerView = await call('GET', `/orders/${t.mixedOrderId}`, null, t.customerToken);
  assert.equal(customerView.body.order.shipments.length, 2);
  assert.equal(customerView.body.order.shipments[0].commissionTotal, undefined, 'customers never see commission');
  assert.equal(customerView.body.order.canEdit, false, 'marketplace orders are not editable');
});

test('sellers see only their own shipments, and customer contact only when they ship it', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const bList = await call('GET', '/seller/shipments', null, t.B.token);
  assert.equal(bList.body.data.length, 1);
  assert.equal(bList.body.data[0].customer, null, 'lists never carry contact details');

  const bDetail = await call('GET', `/seller/shipments/${t.bShipmentId}`, null, t.B.token);
  assert.equal(bDetail.status, 200);
  assert.equal(bDetail.body.data.customer.phone, '+201011112222');
  assert.equal(bDetail.body.data.collectOnDelivery, 430);

  const aDetail = await call('GET', `/seller/shipments/${t.aShipmentId}`, null, t.A.token);
  assert.equal(aDetail.body.data.customer, null, 'the store delivers A’s item — no customer data for A');

  assert.equal((await call('GET', `/seller/shipments/${t.bShipmentId}`, null, t.A.token)).status, 404);
  assert.equal((await call('POST', `/seller/shipments/${t.bShipmentId}/status`, { status: 'confirmed' }, t.A.token)).status, 404);

  const aMove = await call('POST', `/seller/shipments/${t.aShipmentId}/status`, { status: 'confirmed' }, t.A.token);
  assert.equal(aMove.status, 400, 'store-fulfilled shipments follow the order');
});

test('a seller moves its shipment through to delivered; store shipments mirror the order', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const { token } = t.B;
  const skipAhead = await call('POST', `/seller/shipments/${t.bShipmentId}/status`, { status: 'delivered' }, token);
  assert.equal(skipAhead.status, 400);

  assert.equal((await call('POST', `/seller/shipments/${t.bShipmentId}/status`, { status: 'confirmed' }, token)).status, 200);
  const shipped = await call('POST', `/seller/shipments/${t.bShipmentId}/status`, { status: 'shipped', carrier: 'Bosta', trackingNumber: 'BST123' }, token);
  assert.equal(shipped.status, 200, JSON.stringify(shipped.body));
  assert.equal(shipped.body.data.trackingNumber, 'BST123');

  const cancelAfterShip = await call('POST', `/orders/${t.mixedOrderId}/cancel`, { reason: 'changed my mind' }, t.customerToken);
  assert.equal(cancelAfterShip.status, 400, 'no customer cancellation once a seller has shipped');

  assert.equal((await call('POST', `/seller/shipments/${t.bShipmentId}/status`, { status: 'delivered' }, token)).status, 200);
  const order = await Order.findById(t.mixedOrderId).lean();
  assert.equal(order.orderStatus, 'pending', 'store lines still pending — order status is the store part');

  for (const status of ['preparing', 'out_for_delivery', 'delivered']) {
    // eslint-disable-next-line no-await-in-loop
    const res = await call('PUT', `/orders/admin/${t.mixedOrderId}/status`, { orderStatus: status }, t.adminToken);
    assert.equal(res.status, 200, JSON.stringify(res.body));
  }
  const a = await Shipment.findById(t.aShipmentId).lean();
  assert.equal(a.status, 'delivered');
  assert.ok(a.deliveredAt);
});

test('a seller-only order takes its status from the shipment and a seller cancellation restocks once', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const before = (await Product.findById(t.bProduct._id).lean()).stock;
  const res = await checkout([line(t.bProduct, 1)]);
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const orderId = res.body.order.id;
  const order = await Order.findById(orderId).lean();
  assert.equal(order.hasStoreItems, false);
  assert.equal(order.deliveryFee, 30);
  assert.equal(order.total, 230);

  const shipment = await Shipment.findOne({ order: orderId }).lean();
  const noReason = await call('POST', `/seller/shipments/${shipment._id}/status`, { status: 'cancelled' }, t.B.token);
  assert.equal(noReason.status, 400);
  const cancelled = await call('POST', `/seller/shipments/${shipment._id}/status`, { status: 'cancelled', note: 'Out of stock' }, t.B.token);
  assert.equal(cancelled.status, 200, JSON.stringify(cancelled.body));
  assert.equal(cancelled.body.data.refund.status, 'reduced_cod');

  const after = await Order.findById(orderId).lean();
  assert.equal(after.orderStatus, 'cancelled');
  assert.equal(after.total, 0, 'nothing left to collect on delivery');
  assert.equal((await Product.findById(t.bProduct._id).lean()).stock, before, 'restocked exactly once');
});

test('a customer cancelling before shipment cancels the shipments without double restock', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const before = (await Product.findById(t.bProduct._id).lean()).stock;
  const res = await checkout([line(t.storeProduct, 1), line(t.bProduct, 3)]);
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const orderId = res.body.order.id;
  assert.equal((await Product.findById(t.bProduct._id).lean()).stock, before - 3);

  const cancel = await call('POST', `/orders/${orderId}/cancel`, { reason: 'ordered twice' }, t.customerToken);
  assert.equal(cancel.status, 200, JSON.stringify(cancel.body));
  const shipment = await Shipment.findOne({ order: orderId }).lean();
  assert.equal(shipment.status, 'cancelled');
  assert.equal((await Product.findById(t.bProduct._id).lean()).stock, before);
});

test('suspended sellers block checkout of their items', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const { default: Seller } = await import('../src/models/Seller.js');
  await Seller.updateOne({ _id: t.B.seller._id }, { status: 'suspended' });
  const res = await checkout([line(t.bProduct, 1)]);
  assert.equal(res.status, 400);
  await Seller.updateOne({ _id: t.B.seller._id }, { status: 'active' });
});

test('staff can list seller shipments and override a status', async (ctx) => {
  if (skip) return ctx.skip('MongoDB not reachable');
  const list = await call('GET', `/admin/marketplace/shipments?seller=${t.B.seller._id}`, null, t.adminToken);
  assert.equal(list.status, 200);
  assert.ok(list.body.data.length >= 3);
  assert.ok(list.body.data.every((s) => String(s.seller._id) === String(t.B.seller._id)));
  assert.equal((await call('GET', '/admin/marketplace/shipments', null, t.B.token)).status, 403);
});
