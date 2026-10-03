import { asyncHandler } from '../middleware/errorHandler.js';
import { AppError } from '../utils/AppError.js';
import { logAudit } from '../services/auditLog.service.js';
import {
  broadcastPush,
  getPushStats,
  isPushConfigured,
  registerPushDevice,
  unregisterPushDevice,
} from '../services/push.service.js';

const MAX_TOKEN_LENGTH = 4096;

function readToken(req) {
  const token = String(req.body?.token || '').trim();
  if (!token || token.length > MAX_TOKEN_LENGTH) throw new AppError('A valid device token is required', 400);
  return token;
}

/** POST /push/devices { token, platform, lang, appVersion } — the app calls this after sign-in. */
export const registerMyDevice = asyncHandler(async (req, res) => {
  const token = readToken(req);
  await registerPushDevice({
    userId: req.user._id,
    token,
    platform: String(req.body.platform || '').toLowerCase(),
    lang: req.body.lang,
    appVersion: req.body.appVersion,
  });
  res.json({ success: true, pushEnabled: isPushConfigured() });
});

/** DELETE /push/devices { token } — on sign-out, so the next user of the phone gets no pushes. */
export const unregisterMyDevice = asyncHandler(async (req, res) => {
  const token = readToken(req);
  const removed = await unregisterPushDevice({ token, userId: req.user._id });
  res.json({ success: true, removed });
});

/** GET /push/admin/stats */
export const getAdminPushStats = asyncHandler(async (_req, res) => {
  res.json({ success: true, data: await getPushStats() });
});

/** POST /push/admin/broadcast { titleAr, titleEn, bodyAr, bodyEn, link, imageUrl, langs } */
export const sendAdminBroadcast = asyncHandler(async (req, res) => {
  const pick = (key, max) => String(req.body?.[key] || '').trim().slice(0, max);
  const payload = {
    titleAr: pick('titleAr', 120),
    titleEn: pick('titleEn', 120),
    bodyAr: pick('bodyAr', 500),
    bodyEn: pick('bodyEn', 500),
    link: pick('link', 300),
    imageUrl: pick('imageUrl', 500) || undefined,
    langs: Array.isArray(req.body?.langs) && req.body.langs.length ? req.body.langs : ['ar', 'en'],
  };
  if (!(payload.titleAr || payload.titleEn) || !(payload.bodyAr || payload.bodyEn)) {
    throw new AppError('Title and message are required', 400);
  }
  if (payload.link && !payload.link.startsWith('/')) {
    throw new AppError('Link must be an in-app path such as /offers', 400);
  }
  if (payload.imageUrl && !/^https:\/\//.test(payload.imageUrl)) {
    throw new AppError('Image URL must be https', 400);
  }
  if (!isPushConfigured()) {
    throw new AppError('Push notifications are not configured yet (Firebase credentials missing)', 503);
  }

  const result = await broadcastPush(payload);
  await logAudit({
    req,
    action: 'create',
    entityType: 'push_broadcast',
    entityLabel: payload.titleAr || payload.titleEn,
    changes: { langs: payload.langs, link: payload.link },
  });
  res.json({ success: true, data: result });
});
