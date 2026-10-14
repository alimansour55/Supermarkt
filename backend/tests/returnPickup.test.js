/**
 * Home-pickup returns as driver tasks (Phase 2.5). Run with `npm test`.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AuditLog, Notification, Order, api, makeOrder, makeUser, waitFor, waitForNotifications,
} from './helpers.js';

async function orderWithReturn({ method = 'home_pickup', status = 'approved' } = {}) {
  const admin = await makeUser('super_admin');
  const customer = await makeUser('user');
  const driver = await makeUser('driver');
  const order = await makeOrder({
    customer,
    status: 'delivered',
    deliveredAt: new Date(),
    paymentStatus: 'paid',
    returns: [{
      itemIndex: 0,
      quantity: 1,
      nameAr: 'منتج',
      nameEn: 'Item',
      price: 30,
      status,
      fulfillmentStatus: status === 'approved' ? 'confirmed' : '',
      returnMethod: method,
      pickupDate: new Date(),
      pickupSlotLabelAr: 'صباحاً',
      pickupSlotLabelEn: 'Morning',
      itemCondition: 'unopened',
      contactPhone: '01055555555',
    }],
  });
  return { admin, customer, driver, order, returnId: String(order.returns[0]._id) };
}

const base = (order, returnId) => `/orders/driver/pickups/${order._id}/${returnId}`;

describe('return pickups', () => {
  test('assign → driver sees it → on the way → collected completes the return', async () => {
    const { admin, driver, order, returnId } = await orderWithReturn();
    const assign = await api('PUT', `/orders/admin/${order._id}/returns/${returnId}/pickup-driver`, admin, { driverId: String(driver._id) });
    assert.equal(assign.status, 200, JSON.stringify(assign.body));
    const notes = await waitForNotifications({ user: driver._id, type: 'driver_assignment' });
    assert.equal(notes[0].link, `/driver/pickups/${order._id}/${returnId}`);

    const list = await api('GET', '/orders/driver/pickups', driver);
    assert.equal(list.body.data.length, 1);
    assert.equal(list.body.data[0].phone, '01055555555');

    const start = await api('POST', `${base(order, returnId)}/start`, driver);
    assert.equal(start.body.data.fulfillmentStatus, 'pickup_en_route');

    const noCondition = await api('POST', `${base(order, returnId)}/finish`, driver, { outcome: 'collected' });
    assert.equal(noCondition.status, 400);

    const done = await api('POST', `${base(order, returnId)}/finish`, driver, { outcome: 'collected', condition: 'opened', note: 'box opened' });
    assert.equal(done.status, 200, JSON.stringify(done.body));
    assert.equal(done.body.data.fulfillmentStatus, 'completed');

    const saved = await Order.findById(order._id).lean();
    assert.equal(saved.orderStatus, 'returned');
    assert.equal(saved.returns[0].pickupCondition, 'opened');
    assert.equal((await api('GET', '/orders/driver/pickups', driver)).body.data.length, 0);

    // Condition differs from what the customer reported → the store is told.
    assert.equal((await waitFor(Notification, { titleEn: 'Return condition differs' })).length, 1);
    assert.equal(await AuditLog.countDocuments({ action: { $in: ['return_pickup_assign', 'return_pickup'] } }), 2);

    const again = await api('POST', `${base(order, returnId)}/finish`, driver, { outcome: 'collected', condition: 'opened' });
    assert.equal(again.status, 200, 'a retried tap is harmless');
  });

  test('not collected needs a note, frees the task and alerts the store', async () => {
    const { admin, driver, order, returnId } = await orderWithReturn();
    await api('PUT', `/orders/admin/${order._id}/returns/${returnId}/pickup-driver`, admin, { driverId: String(driver._id) });
    const noNote = await api('POST', `${base(order, returnId)}/finish`, driver, { outcome: 'not_collected' });
    assert.equal(noNote.status, 400);
    const res = await api('POST', `${base(order, returnId)}/finish`, driver, { outcome: 'not_collected', note: 'Nobody home' });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const saved = (await Order.findById(order._id).lean()).returns[0];
    assert.equal(saved.fulfillmentStatus, 'confirmed');
    assert.equal(saved.pickupDriver, null);
    assert.equal(saved.pickupOutcome, 'not_collected');
    assert.equal((await waitFor(Notification, { titleEn: 'Return not collected' })).length, 1);
  });

  test('only approved home-pickup returns can be assigned; other drivers cannot see it', async () => {
    const dropoff = await orderWithReturn({ method: 'store_dropoff' });
    const r1 = await api('PUT', `/orders/admin/${dropoff.order._id}/returns/${dropoff.returnId}/pickup-driver`, dropoff.admin, { driverId: String(dropoff.driver._id) });
    assert.equal(r1.status, 400);

    const pending = await orderWithReturn({ status: 'pending' });
    const r2 = await api('PUT', `/orders/admin/${pending.order._id}/returns/${pending.returnId}/pickup-driver`, pending.admin, { driverId: String(pending.driver._id) });
    assert.equal(r2.status, 400);

    const ok = await orderWithReturn();
    await api('PUT', `/orders/admin/${ok.order._id}/returns/${ok.returnId}/pickup-driver`, ok.admin, { driverId: String(ok.driver._id) });
    const stranger = await makeUser('driver');
    const peek = await api('GET', base(ok.order, ok.returnId), stranger);
    assert.equal(peek.status, 404);
  });
});
