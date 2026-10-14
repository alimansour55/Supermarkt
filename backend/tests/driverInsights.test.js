/**
 * Smarter dispatch, driver stats, paginated history and admin performance (Phases 4–5).
 * Run with `npm test` (see tests/helpers.js).
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  Order, User, api, makeOrder, makeUser, setDriverSettings,
} from './helpers.js';

const { default: FulfillmentLocation } = await import('../src/models/FulfillmentLocation.js');

async function branchAt(lat, lng) {
  return FulfillmentLocation.create({ name: 'Dokki branch', address: 'Dokki, Giza', lat, lng });
}

const near = (minutesAgo = 1) => new Date(Date.now() - minutesAgo * 60 * 1000);

describe('auto-assign ranking', () => {
  test('equal load → the driver closest to the pickup branch wins', async () => {
    await setDriverSettings({ autoAssignEnabled: true });
    const admin = await makeUser('super_admin');
    const customer = await makeUser('user');
    const branch = await branchAt(30.04, 31.21);
    await makeUser('driver', { driverLastLocation: { lat: 30.20, lng: 31.40, at: near() } }); // ~26 km away
    const close = await makeUser('driver', { driverLastLocation: { lat: 30.041, lng: 31.211, at: near() } });
    await makeUser('driver'); // no location at all
    const order = await makeOrder({ customer, status: 'preparing', fulfillmentLocationId: branch._id });

    const res = await api('PUT', `/orders/admin/${order._id}/status`, admin, { orderStatus: 'out_for_delivery' });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(String((await Order.findById(order._id).lean()).assignedDriver), String(close._id));
  });

  test('load beats distance; stale locations are ignored', async () => {
    await setDriverSettings({ autoAssignEnabled: true });
    const admin = await makeUser('super_admin');
    const customer = await makeUser('user');
    const branch = await branchAt(30.04, 31.21);
    const busyButClose = await makeUser('driver', { driverLastLocation: { lat: 30.04, lng: 31.21, at: near() } });
    await makeOrder({ customer, driver: busyButClose });
    const staleButClose = await makeUser('driver', { driverLastLocation: { lat: 30.04, lng: 31.21, at: near(60) } });
    const freeAndFar = await makeUser('driver', { driverLastLocation: { lat: 30.10, lng: 31.30, at: near() } });

    const order = await makeOrder({ customer, status: 'preparing', fulfillmentLocationId: branch._id });
    await api('PUT', `/orders/admin/${order._id}/status`, admin, { orderStatus: 'out_for_delivery' });
    const picked = String((await Order.findById(order._id).lean()).assignedDriver);
    assert.notEqual(picked, String(busyButClose._id), 'a busy driver loses to a free one');
    assert.equal(picked, String(freeAndFar._id), 'a located driver beats one whose GPS is an hour old');
    assert.notEqual(picked, String(staleButClose._id));
  });
});

describe('driver stats and history', () => {
  test('stats count today\'s outcomes and cash', async () => {
    const customer = await makeUser('user');
    const driver = await makeUser('driver');
    const a = await makeOrder({ customer, driver });
    const b = await makeOrder({ customer, driver, paymentMethod: 'stripe', paymentStatus: 'paid' });
    const c = await makeOrder({ customer, driver });
    await api('POST', `/orders/driver/deliveries/${a._id}/complete`, driver, { cashCollected: 100 });
    await api('POST', `/orders/driver/deliveries/${b._id}/complete`, driver, {});
    await api('POST', `/orders/driver/deliveries/${c._id}/fail`, driver, { deliveryFailureReasonKey: 'refused' });

    const res = await api('GET', '/orders/driver/stats?days=1', driver);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const s = res.body.data;
    assert.equal(s.delivered, 2);
    assert.equal(s.failed, 1);
    assert.equal(s.successRate, 67);
    assert.equal(s.cashCollected, 100);
    assert.ok(s.avgAssignToDeliverMin >= 0);
  });

  test('history pages with hasMore', async () => {
    const customer = await makeUser('user');
    const driver = await makeUser('driver');
    for (let i = 0; i < 7; i += 1) {
      await makeOrder({ customer, driver, status: 'delivered', deliveredAt: new Date() });
    }
    const first = await api('GET', '/orders/driver/deliveries/history?limit=5', driver);
    assert.equal(first.body.data.length, 5);
    assert.equal(first.body.meta.hasMore, true);
    const second = await api('GET', '/orders/driver/deliveries/history?limit=5&page=2', driver);
    assert.equal(second.body.data.length, 2);
    assert.equal(second.body.meta.hasMore, false);
    const ids = new Set([...first.body.data, ...second.body.data].map((o) => o._id));
    assert.equal(ids.size, 7, 'no duplicates across pages');
  });
});

describe('admin driver performance', () => {
  test('lists every driver with outcomes, declines and cash held', async () => {
    const admin = await makeUser('super_admin');
    const customer = await makeUser('user');
    const driver = await makeUser('driver');
    const idle = await makeUser('driver');
    const order = await makeOrder({ customer, driver });
    await api('POST', `/orders/driver/deliveries/${order._id}/complete`, driver, { cashCollected: 100 });

    await setDriverSettings({ assignDispatchesOrder: false });
    const declined = await makeOrder({ customer, status: 'preparing' });
    await api('PUT', `/orders/admin/${declined._id}/assign-driver`, admin, { driverId: String(driver._id) });
    await api('POST', `/orders/driver/deliveries/${declined._id}/reject`, driver);

    const res = await api('GET', '/orders/admin/drivers/performance?days=7', admin);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const rows = res.body.data.drivers;
    const mine = rows.find((r) => r._id === String(driver._id));
    assert.equal(mine.delivered, 1);
    assert.equal(mine.declined, 1);
    assert.equal(mine.cashHeld, 100);
    const other = rows.find((r) => r._id === String(idle._id));
    assert.equal(other.delivered, 0);
    assert.equal(other.successRate, null);
    assert.ok((await User.countDocuments({ role: 'driver' })) === rows.length);
  });
});
