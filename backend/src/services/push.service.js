/**
 * Push notifications through Firebase Cloud Messaging (iOS via APNs + Android).
 *
 * Dormant until Firebase credentials are configured — every call is then a cheap no-op,
 * so callers never need to check. Configure with one of:
 *   FIREBASE_SERVICE_ACCOUNT_JSON  — the service-account JSON (raw or base64)
 *   FIREBASE_SERVICE_ACCOUNT_FILE  — path to the service-account JSON file
 *
 * Every customer device is also subscribed to a language topic (customers_ar /
 * customers_en) so marketing broadcasts are one request regardless of audience size.
 */
import fs from 'node:fs';
import PushDevice from '../models/PushDevice.js';

const INVALID_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);
export const BROADCAST_TOPICS = { ar: 'customers_ar', en: 'customers_en' };
const MAX_TOKENS_PER_BATCH = 500;

let messagingPromise = null;
let transportOverride = null;

function readServiceAccount() {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (inline) {
    const text = inline.startsWith('{') ? inline : Buffer.from(inline, 'base64').toString('utf8');
    return JSON.parse(text);
  }
  const file = process.env.FIREBASE_SERVICE_ACCOUNT_FILE?.trim();
  if (file) return JSON.parse(fs.readFileSync(file, 'utf8'));
  return null;
}

export function isPushConfigured() {
  return Boolean(
    transportOverride
    || process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim()
    || process.env.FIREBASE_SERVICE_ACCOUNT_FILE?.trim(),
  );
}

/** Test seam: route sends through a fake FCM client (pass null to restore). */
export function setPushTransportForTests(transport) {
  transportOverride = transport;
  messagingPromise = null;
}

/** Lazily initialise firebase-admin; resolves to null when push is not configured or broken. */
function getMessaging() {
  if (transportOverride) return Promise.resolve(transportOverride);
  if (!isPushConfigured()) return Promise.resolve(null);
  if (!messagingPromise) {
    messagingPromise = (async () => {
      const account = readServiceAccount();
      const { initializeApp, cert, getApps } = await import('firebase-admin/app');
      const { getMessaging: firebaseMessaging } = await import('firebase-admin/messaging');
      const app = getApps().find((a) => a.name === 'push') || initializeApp({ credential: cert(account) }, 'push');
      console.log(`[push] Firebase messaging ready (project ${account.project_id})`);
      return firebaseMessaging(app);
    })().catch((err) => {
      console.error('[push] Firebase init failed — push disabled:', err.message);
      return null;
    });
  }
  return messagingPromise;
}

// ── Devices ─────────────────────────────────────────────────────────────────

/** Register (or move) a device token to this user; keeps the language topic in sync. */
export async function registerPushDevice({ userId, token, platform = 'android', lang = 'ar', appVersion = '' }) {
  const cleanLang = lang === 'en' ? 'en' : 'ar';
  const previous = await PushDevice.findOne({ token }).lean();
  const device = await PushDevice.findOneAndUpdate(
    { token },
    {
      $set: {
        user: userId,
        platform: ['android', 'ios', 'web'].includes(platform) ? platform : 'android',
        lang: cleanLang,
        appVersion: String(appVersion || '').slice(0, 40),
        lastSeenAt: new Date(),
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  const messaging = await getMessaging();
  if (messaging && (!previous || previous.lang !== cleanLang)) {
    try {
      if (previous && previous.lang !== cleanLang) {
        await messaging.unsubscribeFromTopic([token], BROADCAST_TOPICS[previous.lang]);
      }
      await messaging.subscribeToTopic([token], BROADCAST_TOPICS[cleanLang]);
    } catch (err) {
      console.warn('[push] topic subscription failed:', err.message);
    }
  }
  return device;
}

/** Forget a device (logout / app uninstall detected). */
export async function unregisterPushDevice({ token, userId = null }) {
  const filter = userId ? { token, user: userId } : { token };
  const device = await PushDevice.findOneAndDelete(filter).lean();
  const messaging = device ? await getMessaging() : null;
  if (messaging) {
    await messaging.unsubscribeFromTopic([token], BROADCAST_TOPICS[device.lang] || BROADCAST_TOPICS.ar)
      .catch(() => {});
  }
  return Boolean(device);
}

// ── Sending ─────────────────────────────────────────────────────────────────

const toDataStrings = (data) => Object.fromEntries(
  Object.entries(data || {})
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]),
);

function buildMessage({ title, body, link, data, imageUrl }) {
  return {
    notification: { title, body, ...(imageUrl ? { imageUrl } : {}) },
    data: toDataStrings({ ...data, ...(link ? { link } : {}) }),
    android: { priority: 'high', notification: { channelId: 'orders', sound: 'default' } },
    apns: { payload: { aps: { sound: 'default' } } },
  };
}

/**
 * Push a bilingual notification to every device of a user (each in its own language).
 * Never throws. Returns { sent, failed, removed }.
 */
export async function sendPushToUser(userId, {
  titleAr, titleEn, bodyAr, bodyEn, link = '', data = {}, imageUrl,
}) {
  const result = { sent: 0, failed: 0, removed: 0 };
  if (!userId || !isPushConfigured()) return result;
  try {
    const messaging = await getMessaging();
    if (!messaging) return result;
    const devices = await PushDevice.find({ user: userId }).select('token lang').lean();
    if (!devices.length) return result;

    for (const lang of ['ar', 'en']) {
      const tokens = devices.filter((d) => (d.lang || 'ar') === lang).map((d) => d.token);
      for (let i = 0; i < tokens.length; i += MAX_TOKENS_PER_BATCH) {
        const batch = tokens.slice(i, i + MAX_TOKENS_PER_BATCH);
        // eslint-disable-next-line no-await-in-loop
        const response = await messaging.sendEachForMulticast({
          tokens: batch,
          ...buildMessage({
            title: lang === 'en' ? (titleEn || titleAr) : (titleAr || titleEn),
            body: lang === 'en' ? (bodyEn || bodyAr) : (bodyAr || bodyEn),
            link,
            data,
            imageUrl,
          }),
        });
        result.sent += response.successCount;
        result.failed += response.failureCount;
        const dead = batch.filter((_, idx) => INVALID_TOKEN_CODES.has(response.responses[idx]?.error?.code));
        if (dead.length) {
          // eslint-disable-next-line no-await-in-loop
          const removed = await PushDevice.deleteMany({ token: { $in: dead } });
          result.removed += removed.deletedCount;
        }
      }
    }
  } catch (err) {
    console.error('[push] send to user failed:', err.message);
  }
  return result;
}

/** Marketing broadcast to every customer device, through the language topics. */
export async function broadcastPush({ titleAr, titleEn, bodyAr, bodyEn, link = '', imageUrl, langs = ['ar', 'en'] }) {
  const messaging = await getMessaging();
  if (!messaging) return { configured: false, sent: [] };
  const sent = [];
  for (const lang of langs.filter((l) => BROADCAST_TOPICS[l])) {
    // eslint-disable-next-line no-await-in-loop
    const id = await messaging.send({
      topic: BROADCAST_TOPICS[lang],
      ...buildMessage({
        title: lang === 'en' ? (titleEn || titleAr) : (titleAr || titleEn),
        body: lang === 'en' ? (bodyEn || bodyAr) : (bodyAr || bodyEn),
        link,
        data: { type: 'broadcast' },
        imageUrl,
      }),
    });
    sent.push({ lang, messageId: id });
  }
  return { configured: true, sent };
}

export async function getPushStats() {
  const [devices, byPlatform] = await Promise.all([
    PushDevice.estimatedDocumentCount(),
    PushDevice.aggregate([{ $group: { _id: '$platform', count: { $sum: 1 } } }]),
  ]);
  return {
    configured: isPushConfigured(),
    devices,
    byPlatform: Object.fromEntries(byPlatform.map((row) => [row._id, row.count])),
  };
}
