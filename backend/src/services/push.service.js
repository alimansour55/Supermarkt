import webpush from 'web-push';
import PushSubscription from '../models/PushSubscription.js';

let configured = null;

/** Web Push is on only when VAPID keys are set (generate with `npx web-push generate-vapid-keys`). */
export function getPushConfig() {
  const publicKey = process.env.VAPID_PUBLIC_KEY || '';
  const privateKey = process.env.VAPID_PRIVATE_KEY || '';
  if (!publicKey || !privateKey) return { enabled: false, publicKey: '' };
  if (configured !== publicKey) {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:support@example.com', publicKey, privateKey);
    configured = publicKey;
  }
  return { enabled: true, publicKey };
}

export async function saveSubscription(userId, subscription, userAgent = '') {
  const endpoint = subscription?.endpoint;
  const p256dh = subscription?.keys?.p256dh;
  const auth = subscription?.keys?.auth;
  if (!endpoint || !p256dh || !auth || !/^https:\/\//.test(endpoint)) return null;
  return PushSubscription.findOneAndUpdate(
    { endpoint },
    { $set: { user: userId, keys: { p256dh, auth }, userAgent: String(userAgent).slice(0, 300) } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

export async function removeSubscription(userId, endpoint) {
  if (!endpoint) return;
  await PushSubscription.deleteOne({ user: userId, endpoint });
}

/**
 * Push `{ title, body, url, tag }` to every browser the user subscribed. Never throws;
 * subscriptions the push service reports as gone (404/410) are deleted.
 */
export async function sendPushToUser(userId, message) {
  if (!userId || !getPushConfig().enabled) return { sent: 0 };
  const subs = await PushSubscription.find({ user: userId }).lean();
  let sent = 0;
  await Promise.all(subs.map(async (sub) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        JSON.stringify(message),
        { TTL: 60 * 60, urgency: 'high' },
      );
      sent += 1;
      await PushSubscription.updateOne({ _id: sub._id }, { $set: { lastUsedAt: new Date() } });
    } catch (err) {
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        await PushSubscription.deleteOne({ _id: sub._id });
      } else {
        console.error('Web push failed:', err?.statusCode || '', err?.message);
      }
    }
  }));
  return { sent };
}
