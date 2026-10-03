/**
 * Push notifications against a fake FCM client and a throwaway MongoDB database.
 * Skips itself when MongoDB is not reachable.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

const MONGO_BASE = (process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/marketplus').replace(/\/[^/?]*(\?.*)?$/, '');
const TEST_DB_URI = `${MONGO_BASE}/marketplus_push_test`;

let mongoose;
let push;
let PushDevice;
let createUserNotification;
let userId;
let skip = false;

const fcm = {
  calls: [],
  dead: new Set(),
  async subscribeToTopic(tokens, topic) { this.calls.push(['subscribe', topic, tokens]); return { successCount: tokens.length }; },
  async unsubscribeFromTopic(tokens, topic) { this.calls.push(['unsubscribe', topic, tokens]); return { successCount: tokens.length }; },
  async sendEachForMulticast(message) {
    this.calls.push(['multicast', message]);
    const responses = message.tokens.map((t) => (this.dead.has(t)
      ? { success: false, error: { code: 'messaging/registration-token-not-registered' } }
      : { success: true, messageId: `m-${t}` }));
    return { responses, successCount: responses.filter((r) => r.success).length, failureCount: responses.filter((r) => !r.success).length };
  },
  async send(message) { this.calls.push(['send', message]); return `projects/x/messages/${message.topic}`; },
  reset() { this.calls = []; this.dead.clear(); },
};

const waitFor = async (predicate, ms = 2000) => {
  const start = Date.now();
  while (!(await predicate())) {
    if (Date.now() - start > ms) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 20));
  }
};

before(async () => {
  mongoose = (await import('mongoose')).default;
  try {
    await mongoose.connect(TEST_DB_URI, { serverSelectionTimeoutMS: 2000 });
  } catch {
    skip = true;
    return;
  }
  await mongoose.connection.dropDatabase();
  push = await import('../src/services/push.service.js');
  ({ default: PushDevice } = await import('../src/models/PushDevice.js'));
  ({ createUserNotification } = await import('../src/services/userNotification.service.js'));
  userId = new mongoose.Types.ObjectId();
});

after(async () => {
  push?.setPushTransportForTests(null);
  if (mongoose?.connection?.readyState === 1) {
    if (!skip) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});

test('without Firebase credentials push is a silent no-op', async (t) => {
  if (skip) return t.skip('MongoDB not reachable');
  delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  delete process.env.FIREBASE_SERVICE_ACCOUNT_FILE;
  push.setPushTransportForTests(null);
  assert.equal(push.isPushConfigured(), false);
  const result = await push.sendPushToUser(userId, { titleAr: 'x', bodyAr: 'y' });
  assert.deepEqual(result, { sent: 0, failed: 0, removed: 0 });
  const broadcast = await push.broadcastPush({ titleAr: 'x', bodyAr: 'y' });
  assert.equal(broadcast.configured, false);
  // Registering still stores the device, so pushes start once Firebase is configured.
  await push.registerPushDevice({ userId, token: 'tok-early', platform: 'ios', lang: 'en' });
  assert.equal(await PushDevice.countDocuments({ token: 'tok-early' }), 1);
});

test('devices register once, follow language topics, and move between users', async (t) => {
  if (skip) return t.skip('MongoDB not reachable');
  push.setPushTransportForTests(fcm);
  fcm.reset();
  await push.registerPushDevice({ userId, token: 'tok-ar', platform: 'android', lang: 'ar' });
  await push.registerPushDevice({ userId, token: 'tok-ar', platform: 'android', lang: 'ar' }); // repeat: no-op topic-wise
  assert.deepEqual(fcm.calls, [['subscribe', 'customers_ar', ['tok-ar']]]);

  fcm.reset();
  await push.registerPushDevice({ userId, token: 'tok-ar', platform: 'android', lang: 'en' });
  assert.deepEqual(fcm.calls, [
    ['unsubscribe', 'customers_ar', ['tok-ar']],
    ['subscribe', 'customers_en', ['tok-ar']],
  ]);
  await push.registerPushDevice({ userId, token: 'tok-ar', platform: 'android', lang: 'ar' });

  const other = new mongoose.Types.ObjectId();
  await push.registerPushDevice({ userId: other, token: 'tok-shared', platform: 'ios', lang: 'ar' });
  await push.registerPushDevice({ userId, token: 'tok-shared', platform: 'ios', lang: 'ar' });
  const shared = await PushDevice.findOne({ token: 'tok-shared' }).lean();
  assert.equal(String(shared.user), String(userId));
  assert.equal(await PushDevice.countDocuments({ token: 'tok-shared' }), 1);
});

test('a customer notification pushes to each device in its language; dead tokens are pruned', async (t) => {
  if (skip) return t.skip('MongoDB not reachable');
  push.setPushTransportForTests(fcm);
  fcm.reset();
  fcm.dead.add('tok-shared');

  await createUserNotification({
    userId,
    type: 'order_status',
    titleAr: 'طلبك في الطريق',
    titleEn: 'Your order is on the way',
    messageAr: 'المندوب في الطريق إليك',
    messageEn: 'The driver is on the way',
    link: '/orders/abc?track=1',
    data: { orderId: 'abc' },
  });
  // The push is fire-and-forget from createUserNotification.
  await waitFor(() => fcm.calls.filter((c) => c[0] === 'multicast').length === 2);

  const multicasts = fcm.calls.filter((c) => c[0] === 'multicast').map((c) => c[1]);
  const ar = multicasts.find((m) => m.notification.title === 'طلبك في الطريق');
  const en = multicasts.find((m) => m.notification.title === 'Your order is on the way');
  assert.deepEqual(ar.tokens.sort(), ['tok-ar', 'tok-shared']);
  assert.deepEqual(en.tokens, ['tok-early']);
  assert.equal(en.notification.body, 'The driver is on the way');
  assert.equal(ar.data.link, '/orders/abc?track=1');
  assert.equal(ar.data.orderId, 'abc');
  assert.equal(ar.android.notification.channelId, 'orders');

  await waitFor(async () => (await PushDevice.countDocuments({ token: 'tok-shared' })) === 0);
  assert.equal(await PushDevice.countDocuments({ token: 'tok-ar' }), 1);
});

test('broadcast goes to the language topics', async (t) => {
  if (skip) return t.skip('MongoDB not reachable');
  push.setPushTransportForTests(fcm);
  fcm.reset();
  const result = await push.broadcastPush({
    titleAr: 'عروض اليوم', titleEn: "Today's deals", bodyAr: 'خصم ٢٠٪', bodyEn: '20% off', link: '/offers',
  });
  assert.equal(result.configured, true);
  const sends = fcm.calls.filter((c) => c[0] === 'send').map((c) => c[1]);
  assert.deepEqual(sends.map((m) => m.topic).sort(), ['customers_ar', 'customers_en']);
  assert.equal(sends.find((m) => m.topic === 'customers_en').notification.title, "Today's deals");
  assert.equal(sends[0].data.link, '/offers');
});

test('unregistering removes the device and its topic subscription', async (t) => {
  if (skip) return t.skip('MongoDB not reachable');
  push.setPushTransportForTests(fcm);
  fcm.reset();
  const otherUser = new mongoose.Types.ObjectId();
  assert.equal(await push.unregisterPushDevice({ token: 'tok-ar', userId: otherUser }), false, 'only the owner can remove it');
  assert.equal(await push.unregisterPushDevice({ token: 'tok-ar', userId }), true);
  assert.deepEqual(fcm.calls, [['unsubscribe', 'customers_ar', ['tok-ar']]]);
  const stats = await push.getPushStats();
  assert.equal(stats.devices, 1);
});
