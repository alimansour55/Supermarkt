/**
 * Web Push for drivers (Phase 3.3). The push service is stubbed — no network.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import webpush from 'web-push';
import { api, makeOrder, makeUser, setDriverSettings } from './helpers.js';

const { default: PushSubscription } = await import('../src/models/PushSubscription.js');

const keys = webpush.generateVAPIDKeys();
const subscription = (n = 1) => ({
  endpoint: `https://push.example.com/send/${n}`,
  keys: { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM', auth: 'tBHItJI5svbpez7KI4CCXg' },
});

function stubPush(impl) {
  const original = webpush.sendNotification;
  const calls = [];
  webpush.sendNotification = async (sub, payload, opts) => {
    calls.push({ sub, payload: JSON.parse(payload), opts });
    return impl ? impl(sub) : { statusCode: 201 };
  };
  return { calls, restore: () => { webpush.sendNotification = original; } };
}

async function until(fn) {
  for (let i = 0; i < 40; i += 1) {
    if (await fn()) return true;
    await new Promise((r) => setTimeout(r, 25));
  }
  return false;
}

describe('web push', () => {
  test('off without VAPID keys', async () => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    const driver = await makeUser('driver');
    assert.equal((await api('GET', '/push/config')).body.data.enabled, false);
    assert.equal((await api('POST', '/push/subscribe', driver, { subscription: subscription() })).status, 503);
  });

  test('a driver subscribes and is pushed on a new assignment; dead subscriptions are dropped', async () => {
    process.env.VAPID_PUBLIC_KEY = keys.publicKey;
    process.env.VAPID_PRIVATE_KEY = keys.privateKey;
    const config = await api('GET', '/push/config');
    assert.equal(config.body.data.enabled, true);
    assert.equal(config.body.data.publicKey, keys.publicKey);

    const admin = await makeUser('super_admin');
    const customer = await makeUser('user');
    const driver = await makeUser('driver');
    assert.equal((await api('POST', '/push/subscribe', driver, { subscription: { endpoint: 'http://insecure' } })).status, 400);
    assert.equal((await api('POST', '/push/subscribe', driver, { subscription: subscription(1) })).status, 200);
    assert.equal((await api('POST', '/push/subscribe', driver, { subscription: subscription(2) })).status, 200);
    assert.equal((await api('POST', '/push/subscribe', driver, { subscription: subscription(1) })).status, 200, 'resubscribing is idempotent');
    assert.equal(await PushSubscription.countDocuments({ user: driver._id }), 2);

    // Endpoint 2 is gone at the push service (410) → it gets deleted.
    const stub = stubPush((sub) => {
      if (sub.endpoint.endsWith('/2')) { const err = new Error('gone'); err.statusCode = 410; throw err; }
      return { statusCode: 201 };
    });
    try {
      await setDriverSettings({ assignDispatchesOrder: false });
      const order = await makeOrder({ customer, status: 'preparing' });
      await api('PUT', `/orders/admin/${order._id}/assign-driver`, admin, { driverId: String(driver._id) });
      assert.ok(await until(() => stub.calls.length === 2), 'pushed to both subscriptions');
      assert.equal(stub.calls[0].payload.url, `/driver/deliveries/${order._id}`);
      assert.match(stub.calls[0].payload.body, new RegExp(order.orderNumber));
      assert.ok(await until(async () => (await PushSubscription.countDocuments({ user: driver._id })) === 1));
    } finally {
      stub.restore();
    }

    assert.equal((await api('DELETE', '/push/subscribe', driver, { endpoint: subscription(1).endpoint })).status, 200);
    assert.equal(await PushSubscription.countDocuments({ user: driver._id }), 0);
  });
});
