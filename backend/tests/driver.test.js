/**
 * Driver delivery flow (Phase 1) — integration tests against a real (in-memory) MongoDB.
 * Run with `npm test` (see tests/helpers.js).
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AuditLog, DeliveryTracking, Order, api, makeOrder, makeUser, setDriverSettings, smsLog, waitForNotifications,
} from './helpers.js';

describe('driver completes / fails a delivery', () => {
  test('double "complete" applies once: one history entry, one audit log, both requests succeed', async () => {
    const customer = await makeUser('user');
    const driver = await makeUser('driver');
    const order = await makeOrder({ customer, driver });

    const [a, b] = await Promise.all([
      api('POST', `/orders/driver/deliveries/${order._id}/complete`, driver, { cashCollected: 100 }),
      api('POST', `/orders/driver/deliveries/${order._id}/complete`, driver, { cashCollected: 100 }),
    ]);
    assert.equal(a.status, 200, JSON.stringify(a.body));
    assert.equal(b.status, 200, JSON.stringify(b.body));

    const saved = await Order.findById(order._id).lean();
    assert.equal(saved.orderStatus, 'delivered');
    assert.equal(saved.paymentStatus, 'paid');
    assert.ok(saved.deliveredAt);
    assert.equal(saved.statusHistory.filter((h) => h.status === 'delivered').length, 1);
    assert.equal(await AuditLog.countDocuments({ action: 'driver_complete_delivery' }), 1);

    const retry = await api('POST', `/orders/driver/deliveries/${order._id}/complete`, driver, { cashCollected: 100 });
    assert.equal(retry.status, 200);
    assert.equal(retry.body.data.orderStatus, 'delivered');
  });

  test('complete response honours store settings flags', async () => {
    await setDriverSettings({ cashCalculatorEnabled: false, pickingChecklistEnabled: false });
    const customer = await makeUser('user');
    const driver = await makeUser('driver');
    const order = await makeOrder({ customer, driver });

    const res = await api('POST', `/orders/driver/deliveries/${order._id}/complete`, driver, { cashCollected: 100 });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.cashCalculatorEnabled, false);
    assert.equal(res.body.data.pickingChecklistEnabled, false);
  });

  test('cannot complete an order that is not out for delivery', async () => {
    const customer = await makeUser('user');
    const driver = await makeUser('driver');
    const order = await makeOrder({ customer, driver, status: 'preparing' });

    const res = await api('POST', `/orders/driver/deliveries/${order._id}/complete`, driver, { cashCollected: 100 });
    assert.equal(res.status, 400);
    assert.equal((await Order.findById(order._id).lean()).orderStatus, 'preparing');
  });

  test("a driver cannot touch another driver's order", async () => {
    const customer = await makeUser('user');
    const owner = await makeUser('driver');
    const other = await makeUser('driver');
    const order = await makeOrder({ customer, driver: owner });

    const res = await api('POST', `/orders/driver/deliveries/${order._id}/complete`, other, { cashCollected: 100 });
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

    const completeAfterFail = await api('POST', `/orders/driver/deliveries/${order._id}/complete`, driver, { cashCollected: 100 });
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

    await api('POST', `/orders/driver/deliveries/${order._id}/complete`, driver, { cashCollected: 100 });
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
