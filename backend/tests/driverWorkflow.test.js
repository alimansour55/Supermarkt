/**
 * Driver delivery flow (Phase 2) — lifecycle, cash, delivery code, geofence, failures.
 * Run with `npm test` (see tests/helpers.js).
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AuditLog,
  DeliveryTracking,
  DriverCashLedger,
  Notification,
  Order,
  User,
  api,
  makeOrder,
  makeUser,
  setDriverSettings,
  smsLog,
  waitFor,
  waitForNotifications,
} from './helpers.js';

async function assignedOrder({ status = 'preparing', settings } = {}) {
  await setDriverSettings({ assignDispatchesOrder: false, ...settings });
  const admin = await makeUser('super_admin');
  const customer = await makeUser('user');
  const driver = await makeUser('driver');
  const order = await makeOrder({ customer, status });
  const res = await api('PUT', `/orders/admin/${order._id}/assign-driver`, admin, { driverId: String(driver._id) });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return { admin, customer, driver, order };
}

const path = (order, action) => `/orders/driver/deliveries/${order._id}/${action}`;

describe('delivery lifecycle', () => {
  test('assign → accept → pickup dispatches the order → ping goes en route → arrive → complete', async () => {
    const { driver, order } = await assignedOrder();

    let view = (await api('GET', `/orders/driver/deliveries/${order._id}`, driver)).body.data;
    assert.equal(view.delivery.stage, 'assigned');
    assert.equal(view.canAccept, true);
    assert.equal(view.canPickup, true);
    assert.equal(view.canComplete, false);

    const accepted = await api('POST', path(order, 'accept'), driver);
    assert.equal(accepted.status, 200, JSON.stringify(accepted.body));
    assert.equal(accepted.body.data.delivery.stage, 'accepted');
    assert.ok(accepted.body.data.delivery.acceptedAt);

    const picked = await api('POST', path(order, 'pickup'), driver, { pickedItems: [0, 1] });
    assert.equal(picked.status, 200, JSON.stringify(picked.body));
    view = picked.body.data;
    assert.equal(view.orderStatus, 'out_for_delivery');
    assert.equal(view.delivery.stage, 'picked_up');
    assert.deepEqual(view.delivery.missingItems, []);

    const saved = await Order.findById(order._id).lean();
    assert.equal(saved.statusHistory.filter((h) => h.status === 'out_for_delivery').length, 1);
    assert.match(saved.deliveryPin, /^\d{4}$/, 'dispatch generates a delivery code');
    assert.ok(await DeliveryTracking.findOne({ orderId: order._id }), 'tracking run started at pickup');

    await api('PUT', `/orders/${order._id}/tracking/location`, driver, { lat: 30.051, lng: 31.241 });
    assert.equal((await Order.findById(order._id).lean()).delivery.stage, 'en_route');

    const arrived = await api('POST', path(order, 'arrive'), driver);
    assert.equal(arrived.status, 200);
    assert.equal(arrived.body.data.delivery.stage, 'arrived');
    assert.equal((await DeliveryTracking.findOne({ orderId: order._id }).lean()).status, 'arrived');

    const done = await api('POST', path(order, 'complete'), driver, { cashCollected: 200 });
    assert.equal(done.status, 200, JSON.stringify(done.body));
    assert.equal(done.body.data.delivery.stage, 'delivered');
    assert.equal(done.body.data.delivery.cashCollected, 200);
    assert.equal(done.body.data.delivery.changeGiven, 100);
  });

  test('a repeated pickup is a no-op (no second dispatch)', async () => {
    const { driver, order } = await assignedOrder();
    await api('POST', path(order, 'pickup'), driver);
    const again = await api('POST', path(order, 'pickup'), driver);
    assert.equal(again.status, 200);
    const saved = await Order.findById(order._id).lean();
    assert.equal(saved.statusHistory.filter((h) => h.status === 'out_for_delivery').length, 1);
  });

  test('pending orders cannot be picked up', async () => {
    const { driver, order } = await assignedOrder({ status: 'pending' });
    const res = await api('POST', path(order, 'pickup'), driver);
    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'NOT_READY');
  });

  test('missing items at pickup alert the store', async () => {
    const { driver, order } = await assignedOrder();
    const res = await api('POST', path(order, 'pickup'), driver, { pickedItems: [0] });
    assert.deepEqual(res.body.data.delivery.missingItems, [1]);
    const alerts = await waitFor(Notification, { type: 'delivery_alert' });
    assert.equal(alerts.length, 1);
    assert.match(alerts[0].messageEn, /without: Bread/);
  });

  test('declining releases the order and alerts the store; cannot decline after pickup', async () => {
    const { driver, order } = await assignedOrder();
    const res = await api('POST', path(order, 'reject'), driver);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const saved = await Order.findById(order._id).lean();
    assert.equal(saved.assignedDriver, null);
    assert.equal(saved.delivery, null);
    assert.equal((await waitFor(Notification, { type: 'driver_unassigned' })).length, 1);

    const second = await assignedOrder();
    await api('POST', path(second.order, 'pickup'), second.driver);
    const late = await api('POST', path(second.order, 'reject'), second.driver);
    assert.equal(late.status, 409);
  });

  test('declining hands the order to the next driver when auto-assign is on', async () => {
    const { driver, order } = await assignedOrder({ settings: { autoAssignEnabled: true } });
    const next = await makeUser('driver');
    await api('POST', path(order, 'reject'), driver);
    const saved = await Order.findById(order._id).lean();
    assert.equal(String(saved.assignedDriver), String(next._id));
    assert.equal(saved.delivery.stage, 'assigned');
    assert.equal((await waitForNotifications({ user: next._id, type: 'driver_assignment' })).length, 1);
  });

  test('declining can be switched off by the store', async () => {
    const { driver, order } = await assignedOrder({ settings: { allowReject: false } });
    const res = await api('POST', path(order, 'reject'), driver);
    assert.equal(res.status, 403);
  });

  test('assignments nobody accepts expire and are released', async () => {
    const { releaseExpiredAssignments } = await import('../src/services/deliveryDispatch.service.js');
    const { driver, order } = await assignedOrder({ settings: { acceptTimeoutMin: 5 } });
    assert.equal(await releaseExpiredAssignments(Date.now()), 0, 'not yet expired');
    assert.equal(await releaseExpiredAssignments(Date.now() + 6 * 60 * 1000), 1);
    assert.equal((await Order.findById(order._id).lean()).assignedDriver, null);
    assert.equal((await waitForNotifications({ user: driver._id, type: 'driver_unassigned' })).length, 1);
    assert.equal(await AuditLog.countDocuments({ action: 'driver_assignment_expired' }), 1);
  });

  test('accepted assignments do not expire', async () => {
    const { releaseExpiredAssignments } = await import('../src/services/deliveryDispatch.service.js');
    const { driver, order } = await assignedOrder({ settings: { acceptTimeoutMin: 5 } });
    await api('POST', path(order, 'accept'), driver);
    assert.equal(await releaseExpiredAssignments(Date.now() + 6 * 60 * 1000), 0);
  });

  test('orders from before delivery runs existed still work', async () => {
    const customer = await makeUser('user');
    const driver = await makeUser('driver');
    const order = await makeOrder({ customer, driver });
    assert.equal(order.delivery, null);
    const arrived = await api('POST', path(order, 'arrive'), driver);
    assert.equal(arrived.status, 200, JSON.stringify(arrived.body));
    assert.equal(arrived.body.data.delivery.stage, 'arrived');
  });
});

describe('cash on delivery', () => {
  test('completion requires the cash amount, records change, and credits the driver once', async () => {
    const customer = await makeUser('user');
    const driver = await makeUser('driver');
    const order = await makeOrder({ customer, driver });

    const missing = await api('POST', path(order, 'complete'), driver, {});
    assert.equal(missing.status, 400);
    assert.equal(missing.body.code, 'CASH_REQUIRED');
    const short = await api('POST', path(order, 'complete'), driver, { cashCollected: 80 });
    assert.equal(short.body.code, 'CASH_REQUIRED');

    const [a, b] = await Promise.all([
      api('POST', path(order, 'complete'), driver, { cashCollected: 150 }),
      api('POST', path(order, 'complete'), driver, { cashCollected: 150 }),
    ]);
    assert.equal(a.status, 200, JSON.stringify(a.body));
    assert.equal(b.status, 200, JSON.stringify(b.body));

    assert.equal((await User.findById(driver._id).lean()).driverCashBalance, 100);
    const ledger = await DriverCashLedger.find({ driver: driver._id }).lean();
    assert.equal(ledger.length, 1);
    assert.equal(ledger[0].amount, 100);
    assert.equal(ledger[0].balanceAfter, 100);

    const cash = await api('GET', '/orders/driver/cash', driver);
    assert.equal(cash.body.data.balance, 100);
    assert.equal(cash.body.data.entries[0].orderNumber, order.orderNumber);
  });

  test('prepaid orders need no cash and create no ledger entry', async () => {
    const customer = await makeUser('user');
    const driver = await makeUser('driver');
    const order = await makeOrder({ customer, driver, paymentMethod: 'stripe', paymentStatus: 'paid' });
    const res = await api('POST', path(order, 'complete'), driver, {});
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(await DriverCashLedger.countDocuments(), 0);
  });

  test('cash tracking can be switched off', async () => {
    await setDriverSettings({ cashTrackingEnabled: false });
    const customer = await makeUser('user');
    const driver = await makeUser('driver');
    const order = await makeOrder({ customer, driver });
    const res = await api('POST', path(order, 'complete'), driver, {});
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(await DriverCashLedger.countDocuments(), 0);
  });

  test('admin handover reduces the balance; cannot hand over more than held; adjust needs a note', async () => {
    const admin = await makeUser('super_admin');
    const customer = await makeUser('user');
    const driver = await makeUser('driver');
    const order = await makeOrder({ customer, driver });
    await api('POST', path(order, 'complete'), driver, { cashCollected: 100 });

    const list = await api('GET', '/orders/admin/drivers/cash', admin);
    assert.equal(list.status, 200);
    assert.equal(list.body.meta.totalHeld, 100);

    const tooMuch = await api('POST', `/orders/admin/drivers/${driver._id}/cash/handover`, admin, { amount: 150 });
    assert.equal(tooMuch.status, 400);
    assert.equal(tooMuch.body.code, 'EXCEEDS_BALANCE');

    const handover = await api('POST', `/orders/admin/drivers/${driver._id}/cash/handover`, admin, { amount: 70, note: 'end of shift' });
    assert.equal(handover.status, 200, JSON.stringify(handover.body));
    assert.equal(handover.body.data.balance, 30);

    const noNote = await api('POST', `/orders/admin/drivers/${driver._id}/cash/adjust`, admin, { amount: -30 });
    assert.equal(noNote.status, 400);
    const adjust = await api('POST', `/orders/admin/drivers/${driver._id}/cash/adjust`, admin, { amount: -30, note: 'shortage' });
    assert.equal(adjust.body.data.balance, 0);
    assert.equal(await AuditLog.countDocuments({ action: { $in: ['cash_handover', 'cash_adjust'] } }), 2);
  });
});

describe('proof of delivery', () => {
  test('delivery code: sent to the customer at dispatch, wrong code rejected, locks after 5 tries', async () => {
    smsLog.length = 0;
    smsLog.capture = true;
    let driver;
    let order;
    let customer;
    try {
      ({ driver, order, customer } = await assignedOrder({ settings: { requireDeliveryPin: 'all' } }));
      await api('POST', path(order, 'pickup'), driver);
      for (let i = 0; i < 80 && !smsLog.some((l) => l.includes('كود استلام')); i += 1) {
        await new Promise((r) => setTimeout(r, 25));
      }
    } finally {
      smsLog.capture = false;
    }
    const pin = (await Order.findById(order._id).lean()).deliveryPin;
    assert.ok(smsLog.some((l) => l.includes('كود استلام') && l.includes(pin)), 'customer got the code by SMS');

    const mine = (await api('GET', `/orders/${order._id}`, customer)).body.order;
    assert.equal(mine.deliveryPinRequired, true, 'the customer sees the code on their order page');
    assert.equal(mine.deliveryPin, pin);

    const view = (await api('GET', `/orders/driver/deliveries/${order._id}`, driver)).body.data;
    assert.equal(view.requirements.deliveryPin, true);
    assert.equal(JSON.stringify(view).includes(pin), false, 'the driver never sees the code');

    const wrong = pin === '0000' ? '1111' : '0000';
    const bad = await api('POST', path(order, 'complete'), driver, { cashCollected: 100, deliveryPin: wrong });
    assert.equal(bad.status, 400);
    assert.equal(bad.body.code, 'PIN_INVALID');

    const ok = await api('POST', path(order, 'complete'), driver, { cashCollected: 100, deliveryPin: pin });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));

    const second = await assignedOrder({ settings: { requireDeliveryPin: 'all' } });
    await api('POST', path(second.order, 'pickup'), second.driver);
    const secondPin = (await Order.findById(second.order._id).lean()).deliveryPin;
    const secondWrong = secondPin === '0000' ? '1111' : '0000';
    for (let i = 0; i < 5; i += 1) {
      await api('POST', path(second.order, 'complete'), second.driver, { cashCollected: 100, deliveryPin: secondWrong });
    }
    const locked = await api('POST', path(second.order, 'complete'), second.driver, { cashCollected: 100, deliveryPin: secondPin });
    assert.equal(locked.status, 423);
    assert.equal(locked.body.code, 'PIN_LOCKED');
    assert.equal((await waitFor(Notification, { type: 'delivery_alert', titleEn: 'Delivery code locked' })).length, 1);
  });

  test('delivery code for COD only does not apply to prepaid orders', async () => {
    await setDriverSettings({ requireDeliveryPin: 'cod' });
    const customer = await makeUser('user');
    const driver = await makeUser('driver');
    const prepaid = await makeOrder({ customer, driver, paymentMethod: 'stripe', paymentStatus: 'paid' });
    const res = await api('POST', path(prepaid, 'complete'), driver, {});
    assert.equal(res.status, 200, JSON.stringify(res.body));
  });

  test('photo requirement is enforced', async () => {
    await setDriverSettings({ requireProofPhoto: 'always' });
    const customer = await makeUser('user');
    const driver = await makeUser('driver');
    const order = await makeOrder({ customer, driver });
    const res = await api('POST', path(order, 'complete'), driver, { cashCollected: 100 });
    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'PHOTO_REQUIRED');
  });

  test('geofence: far away needs a reason, which is stored and flagged to the store', async () => {
    await setDriverSettings({ geofenceMeters: 300 });
    const customer = await makeUser('user');
    const driver = await makeUser('driver');
    const order = await makeOrder({ customer, driver });
    // ~1.1 km north of the address.
    await api('PUT', `/orders/${order._id}/tracking/location`, driver, { lat: 30.06, lng: 31.24 });

    const far = await api('POST', path(order, 'complete'), driver, { cashCollected: 100 });
    assert.equal(far.status, 400);
    assert.equal(far.body.code, 'OUTSIDE_GEOFENCE');
    assert.match(far.body.message, /m from the address/);

    const withReason = await api('POST', path(order, 'complete'), driver, {
      cashCollected: 100, offsiteReason: 'Customer met me at the main gate',
    });
    assert.equal(withReason.status, 200, JSON.stringify(withReason.body));
    const saved = await Order.findById(order._id).lean();
    assert.ok(saved.delivery.offsite.distanceMeters > 1000);
    assert.equal(saved.delivery.offsite.reason, 'Customer met me at the main gate');
    assert.equal((await waitFor(Notification, { type: 'delivery_alert' })).length, 1);
  });

  test('geofence: at the door completes normally', async () => {
    await setDriverSettings({ geofenceMeters: 300 });
    const customer = await makeUser('user');
    const driver = await makeUser('driver');
    const order = await makeOrder({ customer, driver });
    await api('PUT', `/orders/${order._id}/tracking/location`, driver, { lat: 30.0501, lng: 31.2401 });
    const res = await api('POST', path(order, 'complete'), driver, { cashCollected: 100 });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal((await Order.findById(order._id).lean()).delivery.offsite, undefined);
  });
});

describe('failed deliveries', () => {
  test('"unreachable" needs logged contact attempts first', async () => {
    await setDriverSettings({ failMinContactAttempts: 2 });
    const customer = await makeUser('user');
    const driver = await makeUser('driver');
    const order = await makeOrder({ customer, driver });
    const payload = { deliveryFailureReasonKey: 'could_not_reach' };

    const early = await api('POST', path(order, 'fail'), driver, payload);
    assert.equal(early.status, 400);
    assert.equal(early.body.code, 'ATTEMPTS_REQUIRED');

    // Other reasons are not gated.
    const badType = await api('POST', path(order, 'attempts'), driver, { type: 'email' });
    assert.equal(badType.status, 400);
    await api('POST', path(order, 'attempts'), driver, { type: 'call' });
    const second = await api('POST', path(order, 'attempts'), driver, { type: 'whatsapp' });
    assert.equal(second.body.data.delivery.contactAttempts, 2);

    const ok = await api('POST', path(order, 'fail'), driver, payload);
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.equal(ok.body.data.delivery.stage, 'failed');
    assert.equal(ok.body.data.canReturn, true);
  });

  test('driver returns items to the store; admin reattempts → back to preparing with a fresh run', async () => {
    const { admin, driver, order } = await assignedOrder();
    await api('POST', path(order, 'pickup'), driver);
    await api('POST', path(order, 'fail'), driver, { deliveryFailureReasonKey: 'refused' });

    const returned = await api('POST', path(order, 'returned'), driver);
    assert.equal(returned.status, 200, JSON.stringify(returned.body));
    assert.equal(returned.body.data.delivery.stage, 'returned');
    assert.equal((await waitFor(Notification, { type: 'delivery_alert', titleEn: 'Order returned to store' })).length, 1);

    const reattempt = await api('POST', `/orders/admin/${order._id}/delivery/reattempt`, admin, {});
    assert.equal(reattempt.status, 200, JSON.stringify(reattempt.body));
    const saved = await Order.findById(order._id).lean();
    assert.equal(saved.orderStatus, 'preparing');
    assert.equal(saved.delivery.stage, 'assigned');
    assert.equal(saved.deliveryFailureReasonKey, '');
    assert.equal(await DeliveryTracking.findOne({ orderId: order._id }), null);

    const again = await api('POST', path(order, 'pickup'), driver);
    assert.equal(again.status, 200);
    assert.equal(again.body.data.orderStatus, 'out_for_delivery');
    const dispatched = await Order.findById(order._id).lean();
    assert.match(dispatched.deliveryPin, /^\d{4}$/);
  });

  test('only failed deliveries can be reattempted', async () => {
    const { admin, order } = await assignedOrder();
    const res = await api('POST', `/orders/admin/${order._id}/delivery/reattempt`, admin, {});
    assert.equal(res.status, 400);
  });
});

describe('shift-wide location', () => {
  test('one ping updates every order the driver has on the road, and nothing else', async () => {
    const customer = await makeUser('user');
    const driver = await makeUser('driver');
    const other = await makeUser('driver');
    const a = await makeOrder({ customer, driver });
    const b = await makeOrder({ customer, driver });
    const upcoming = await makeOrder({ customer, driver, status: 'preparing' });
    const notMine = await makeOrder({ customer, driver: other });

    const res = await api('PUT', '/orders/driver/location', driver, { lat: 30.051, lng: 31.241, speed: 5 });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.orders, 2);

    for (const order of [a, b]) {
      const tracking = await DeliveryTracking.findOne({ orderId: order._id }).lean();
      assert.equal(tracking.lat, 30.051);
      assert.equal(String(tracking.driverId), String(driver._id));
      assert.equal((await Order.findById(order._id).lean()).delivery.stage, 'en_route');
    }
    assert.equal(await DeliveryTracking.findOne({ orderId: upcoming._id }), null);
    assert.equal(await DeliveryTracking.findOne({ orderId: notMine._id }), null);

    const saved = await User.findById(driver._id).lean();
    assert.equal(saved.driverLastLocation.lat, 30.051);

    const config = await api('GET', '/orders/driver/config', driver);
    assert.equal(config.body.data.activeDeliveries, 2);
  });

  test('rejects bad coordinates', async () => {
    const driver = await makeUser('driver');
    const res = await api('PUT', '/orders/driver/location', driver, { lat: 200, lng: 31 });
    assert.equal(res.status, 400);
  });

  test('an arrived run keeps its "arrived" tracking status on later pings', async () => {
    const customer = await makeUser('user');
    const driver = await makeUser('driver');
    const order = await makeOrder({ customer, driver });
    await api('PUT', '/orders/driver/location', driver, { lat: 30.05, lng: 31.24 });
    await api('POST', `/orders/driver/deliveries/${order._id}/arrive`, driver);
    await api('PUT', '/orders/driver/location', driver, { lat: 30.0501, lng: 31.2401 });
    assert.equal((await DeliveryTracking.findOne({ orderId: order._id }).lean()).status, 'arrived');
  });
});
