/**
 * Driver delivery flow — integration tests against a real (in-memory) MongoDB.
 *
 *   npm test
 *
 * mongodb-memory-server downloads a mongod binary on first run. Set
 * MONGOMS_SYSTEM_BINARY to use an existing mongod instead.
 */
import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'driver-tests-secret';

const { default: app } = await import('../src/app.js');
const { default: User } = await import('../src/models/User.js');
const { default: Order } = await import('../src/models/Order.js');
const { default: StoreSettings } = await import('../src/models/StoreSettings.js');
const { default: DeliveryTracking } = await import('../src/models/DeliveryTracking.js');
const { default: UserNotification } = await import('../src/models/UserNotification.js');
const { default: AuditLog } = await import('../src/models/AuditLog.js');
const { invalidateStoreSettingsCache } = await import('../src/services/storeSettings.service.js');

// SMS is simulated in tests (no gateway configured) and logged to the console — capture it.
const smsLog = [];
const realLog = console.log;
console.log = (...args) => {
  const line = args.join(' ');
  if (smsLog.capture) smsLog.push(line);
  if (!process.env.TEST_QUIET) realLog(...args);
};

let mongo;
let server;
let baseUrl;
let orderSeq = 0;

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  server?.close();
  await mongoose.disconnect();
  await mongo?.stop();
});

beforeEach(async () => {
  await mongoose.connection.db.dropDatabase();
  await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).syncIndexes()));
  invalidateStoreSettingsCache();
});

function tokenFor(user) {
  return jwt.sign({ id: user._id }, process.env.JWT_SECRET);
}

async function api(method, path, user, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(user ? { Authorization: `Bearer ${tokenFor(user)}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

let userSeq = 0;
async function makeUser(role, extra = {}) {
  userSeq += 1;
  return User.create({
    name: `${role} ${userSeq}`,
    role,
    phone: `0100000${String(userSeq).padStart(4, '0')}`,
    ...(role === 'user' ? {} : { username: `${role}${userSeq}`, password: 'Passw0rd!123' }),
    ...extra,
  });
}

async function makeOrder({ customer, driver = null, status = 'out_for_delivery', ...extra }) {
  orderSeq += 1;
  return Order.create({
    orderNumber: `T${1000 + orderSeq}`,
    user: customer._id,
    items: [{ nameAr: 'منتج', nameEn: 'Item', price: 50, quantity: 2 }],
    shippingAddress: { street: 'Tahrir St', city: 'Cairo', lat: 30.05, lng: 31.24 },
    phone: '01000000000',
    subtotal: 100,
    total: 100,
    paymentMethod: 'cod',
    paymentStatus: 'pending',
    orderStatus: status,
    assignedDriver: driver?._id || null,
    assignedDriverAt: driver ? new Date() : null,
    ...extra,
  });
}

async function setDriverSettings(driverSettings) {
  await StoreSettings.findOneAndUpdate(
    { key: 'main' },
    { $set: { driverSettings } },
    { upsert: true, setDefaultsOnInsert: true },
  );
  invalidateStoreSettingsCache();
}

/** Driver notices are fire-and-forget; wait briefly for them to land. */
async function waitForNotifications(filter, count = 1) {
  for (let i = 0; i < 40; i += 1) {
    const found = await UserNotification.find(filter).lean();
    if (found.length >= count) return found;
    await new Promise((r) => setTimeout(r, 25));
  }
  return UserNotification.find(filter).lean();
}

describe('driver completes / fails a delivery', () => {
  test('double "complete" applies once: one history entry, one audit log, both requests succeed', async () => {
    const customer = await makeUser('user');
    const driver = await makeUser('driver');
    const order = await makeOrder({ customer, driver });

    const [a, b] = await Promise.all([
      api('POST', `/orders/driver/deliveries/${order._id}/complete`, driver),
      api('POST', `/orders/driver/deliveries/${order._id}/complete`, driver),
    ]);
    assert.equal(a.status, 200, JSON.stringify(a.body));
    assert.equal(b.status, 200, JSON.stringify(b.body));

    const saved = await Order.findById(order._id).lean();
    assert.equal(saved.orderStatus, 'delivered');
    assert.equal(saved.paymentStatus, 'paid');
    assert.ok(saved.deliveredAt);
    assert.equal(saved.statusHistory.filter((h) => h.status === 'delivered').length, 1);
    assert.equal(await AuditLog.countDocuments({ action: 'driver_complete_delivery' }), 1);

    const retry = await api('POST', `/orders/driver/deliveries/${order._id}/complete`, driver);
    assert.equal(retry.status, 200);
    assert.equal(retry.body.data.orderStatus, 'delivered');
  });

  test('complete response honours store settings flags', async () => {
    await setDriverSettings({ cashCalculatorEnabled: false, pickingChecklistEnabled: false });
    const customer = await makeUser('user');
    const driver = await makeUser('driver');
    const order = await makeOrder({ customer, driver });

    const res = await api('POST', `/orders/driver/deliveries/${order._id}/complete`, driver);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.cashCalculatorEnabled, false);
    assert.equal(res.body.data.pickingChecklistEnabled, false);
  });

  test('cannot complete an order that is not out for delivery', async () => {
    const customer = await makeUser('user');
    const driver = await makeUser('driver');
    const order = await makeOrder({ customer, driver, status: 'preparing' });

    const res = await api('POST', `/orders/driver/deliveries/${order._id}/complete`, driver);
    assert.equal(res.status, 400);
    assert.equal((await Order.findById(order._id).lean()).orderStatus, 'preparing');
  });

  test("a driver cannot touch another driver's order", async () => {
    const customer = await makeUser('user');
    const owner = await makeUser('driver');
    const other = await makeUser('driver');
    const order = await makeOrder({ customer, driver: owner });

    const res = await api('POST', `/orders/driver/deliveries/${order._id}/complete`, other);
    assert.equal(res.status, 404);
    const loc = await api('PUT', `/orders/${order._id}/tracking/location`, other, { lat: 30, lng: 31 });
    assert.equal(loc.status, 403);
  });

  test('fail needs a reason, then applies once', async () => {
    const customer = await makeUser('user');
    const driver = await makeUser('driver');
    const order = await makeOrder({ customer, driver });

    const noReason = await api('POST', `/orders/driver/deliveries/${order._id}/fail`, driver, {});
    assert.equal(noReason.status, 400);

    const payload = { deliveryFailureReasonKey: 'custom', deliveryFailureReason: 'Customer not home' };
    const first = await api('POST', `/orders/driver/deliveries/${order._id}/fail`, driver, payload);
    const second = await api('POST', `/orders/driver/deliveries/${order._id}/fail`, driver, payload);
    assert.equal(first.status, 200, JSON.stringify(first.body));
    assert.equal(second.status, 200);

    const saved = await Order.findById(order._id).lean();
    assert.equal(saved.orderStatus, 'delivery_failed');
    assert.equal(saved.paymentStatus, 'pending');
    assert.equal(saved.deliveryFailureReasonAr, 'Customer not home');
    assert.equal(saved.statusHistory.filter((h) => h.status === 'delivery_failed').length, 1);

    const completeAfterFail = await api('POST', `/orders/driver/deliveries/${order._id}/complete`, driver);
    assert.equal(completeAfterFail.status, 400);
  });
});

describe('live tracking', () => {
  test('dispatch starts tracking with no fake position; the first ping makes it live', async () => {
    const admin = await makeUser('super_admin');
    const customer = await makeUser('user');
    const driver = await makeUser('driver');
    const order = await makeOrder({ customer, status: 'preparing' });

    const assign = await api('PUT', `/orders/admin/${order._id}/assign-driver`, admin, { driverId: String(driver._id) });
    assert.equal(assign.status, 200, JSON.stringify(assign.body));

    const seeded = await DeliveryTracking.findOne({ orderId: order._id }).lean();
    assert.equal(seeded.status, 'idle');
    assert.equal(seeded.lat, null);
    assert.equal(seeded.updatedAt, null);

    const before = await api('GET', `/orders/${order._id}/tracking`, customer);
    assert.equal(before.status, 200, JSON.stringify(before.body));
    assert.equal(before.body.data.driver, null);
    assert.equal(before.body.data.arrivalState, 'preparing');

    const ping = await api('PUT', `/orders/${order._id}/tracking/location`, driver, { lat: 30.06, lng: 31.25 });
    assert.equal(ping.status, 200, JSON.stringify(ping.body));

    const live = await DeliveryTracking.findOne({ orderId: order._id }).lean();
    assert.equal(live.lat, 30.06);
    assert.equal(live.status, 'en_route');
    assert.ok(live.updatedAt);
  });

  test('first-location SMS names the order (regression: rendered "undefined")', async () => {
    const customer = await makeUser('user');
    const driver = await makeUser('driver');
    const order = await makeOrder({ customer, driver });

    smsLog.length = 0;
    smsLog.capture = true;
    try {
      await api('PUT', `/orders/${order._id}/tracking/location`, driver, { lat: 30.06, lng: 31.25 });
      for (let i = 0; i < 80 && !smsLog.some((l) => l.includes('المندوب في الطريق')); i += 1) {
        await new Promise((r) => setTimeout(r, 25));
      }
    } finally {
      smsLog.capture = false;
    }
    const sms = smsLog.find((l) => l.includes('المندوب في الطريق'));
    assert.ok(sms, 'driver-location SMS was sent');
    assert.ok(sms.includes(order.orderNumber), sms);
    assert.ok(!sms.includes('undefined'), sms);
  });

  test('a later ping keeps the run live', async () => {
    const customer = await makeUser('user');
    const driver = await makeUser('driver');
    const order = await makeOrder({ customer, driver });
    await api('PUT', `/orders/${order._id}/tracking/location`, driver, { lat: 30.06, lng: 31.25 });
    await api('PUT', `/orders/${order._id}/tracking/location`, driver, { lat: 30.061, lng: 31.251 });
    const live = await DeliveryTracking.findOne({ orderId: order._id }).lean();
    assert.equal(live.lat, 30.061);
    assert.equal(live.status, 'en_route');
    assert.ok(live.updatedAt);
  });

  test('first ping on an order with no tracking record creates it and enables tracking', async () => {
    const customer = await makeUser('user');
    const driver = await makeUser('driver');
    const order = await makeOrder({ customer, driver });

    const ping = await api('PUT', `/orders/${order._id}/tracking/location`, driver, { lat: 30.07, lng: 31.26 });
    assert.equal(ping.status, 200, JSON.stringify(ping.body));
    assert.equal((await Order.findById(order._id).lean()).trackingEnabled, true);
    assert.equal((await DeliveryTracking.findOne({ orderId: order._id }).lean()).lat, 30.07);
  });

  test('completing closes tracking and blocks further pings', async () => {
    const customer = await makeUser('user');
    const driver = await makeUser('driver');
    const order = await makeOrder({ customer, driver });
    await api('PUT', `/orders/${order._id}/tracking/location`, driver, { lat: 30.07, lng: 31.26 });

    await api('POST', `/orders/driver/deliveries/${order._id}/complete`, driver);
    assert.equal((await DeliveryTracking.findOne({ orderId: order._id }).lean()).status, 'completed');

    const late = await api('PUT', `/orders/${order._id}/tracking/location`, driver, { lat: 30.08, lng: 31.27 });
    assert.equal(late.status, 400);
  });
});

describe('assignment', () => {
  test('reassigning resets tracking and notifies both drivers', async () => {
    const admin = await makeUser('super_admin');
    const customer = await makeUser('user');
    const first = await makeUser('driver');
    const second = await makeUser('driver');
    const order = await makeOrder({ customer, status: 'preparing' });

    await api('PUT', `/orders/admin/${order._id}/assign-driver`, admin, { driverId: String(first._id) });
    await api('PUT', `/orders/${order._id}/tracking/location`, first, { lat: 30.06, lng: 31.25 });

    const res = await api('PUT', `/orders/admin/${order._id}/assign-driver`, admin, { driverId: String(second._id) });
    assert.equal(res.status, 200, JSON.stringify(res.body));

    const tracking = await DeliveryTracking.findOne({ orderId: order._id }).lean();
    assert.equal(String(tracking.driverId), String(second._id));
    assert.equal(tracking.lat, null, 'previous driver position must not leak to the new run');

    const firstNotes = await waitForNotifications({ user: first._id, type: 'driver_unassigned' });
    assert.equal(firstNotes.length, 1);
    const secondNotes = await waitForNotifications({ user: second._id, type: 'driver_assignment' });
    assert.equal(secondNotes.length, 1);
    assert.equal(secondNotes[0].link, `/driver/deliveries/${order._id}`);

    const stale = await api('PUT', `/orders/${order._id}/tracking/location`, first, { lat: 30.1, lng: 31.3 });
    assert.equal(stale.status, 403);
  });

  test('unassigning removes the tracking record', async () => {
    const admin = await makeUser('super_admin');
    const customer = await makeUser('user');
    const driver = await makeUser('driver');
    const order = await makeOrder({ customer, status: 'preparing' });

    await api('PUT', `/orders/admin/${order._id}/assign-driver`, admin, { driverId: String(driver._id) });
    assert.ok(await DeliveryTracking.findOne({ orderId: order._id }));

    const res = await api('PUT', `/orders/admin/${order._id}/assign-driver`, admin, { driverId: null });
    assert.equal(res.status, 200);
    assert.equal(await DeliveryTracking.findOne({ orderId: order._id }), null);
  });

  test('assign moves the order to out-for-delivery and records it in the status history', async () => {
    const admin = await makeUser('super_admin');
    const customer = await makeUser('user');
    const driver = await makeUser('driver');
    const order = await makeOrder({ customer, status: 'confirmed' });

    await api('PUT', `/orders/admin/${order._id}/assign-driver`, admin, { driverId: String(driver._id) });
    const saved = await Order.findById(order._id).lean();
    assert.equal(saved.orderStatus, 'out_for_delivery');
    assert.equal(saved.statusHistory.filter((h) => h.status === 'out_for_delivery').length, 1);
  });

  test('with assignDispatchesOrder off, the order stays upcoming until the store dispatches it', async () => {
    await setDriverSettings({ assignDispatchesOrder: false });
    const admin = await makeUser('super_admin');
    const customer = await makeUser('user');
    const driver = await makeUser('driver');
    const order = await makeOrder({ customer, status: 'preparing' });

    await api('PUT', `/orders/admin/${order._id}/assign-driver`, admin, { driverId: String(driver._id) });
    assert.equal((await Order.findById(order._id).lean()).orderStatus, 'preparing');
    const notes = await waitForNotifications({ user: driver._id, type: 'driver_assignment' });
    assert.equal(notes[0].data.kind, 'assigned');

    const list = await api('GET', '/orders/driver/deliveries', driver);
    assert.equal(list.status, 200);
    assert.deepEqual(list.body.data.map((o) => o.orderStatus), ['preparing']);
    assert.equal(list.body.data[0].canShareLocation, false);
    assert.equal(list.body.data[0].canComplete, false);

    const ping = await api('PUT', `/orders/${order._id}/tracking/location`, driver, { lat: 30, lng: 31 });
    assert.equal(ping.status, 400);

    const dispatch = await api('PUT', `/orders/admin/${order._id}/status`, admin, { orderStatus: 'out_for_delivery' });
    assert.equal(dispatch.status, 200, JSON.stringify(dispatch.body));
    const dispatched = await waitForNotifications({ user: driver._id, type: 'driver_assignment' }, 2);
    assert.deepEqual(dispatched.map((n) => n.data.kind).sort(), ['assigned', 'dispatched']);
  });
});
