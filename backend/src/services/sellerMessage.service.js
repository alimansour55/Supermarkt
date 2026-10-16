/**
 * Store ↔ seller messages, formal warnings with strikes, and the account-health enforcement job.
 *
 * Strikes: staff warnings marked `strike` (not withdrawn) within the configured window. When a
 * seller reaches `maxStrikes` and `autoSuspend` is on, the store is suspended automatically with
 * a reason the seller can read. Automatic "at risk" notices never count as strikes.
 */
import Seller from '../models/Seller.js';
import User from '../models/User.js';
import SellerMessage from '../models/SellerMessage.js';
import AuditLog from '../models/AuditLog.js';
import { sendEmail } from '../utils/sendEmail.js';
import { sellerStoreMessageTemplate } from '../emails/templates/sellerTemplates.js';
import { getSellerPerformance } from './sellerReputation.service.js';
import { getMarketplaceSettingsDoc, notifySellerUsers, changeSellerStatus } from './marketplace.service.js';

const DAY = 86400000;
const AUTO_NOTICE_EVERY_DAYS = 7;

export function enforcementConfig(settings = {}) {
  const e = settings.enforcement || {};
  return {
    autoWarnAtRisk: e.autoWarnAtRisk !== false,
    maxStrikes: Number(e.maxStrikes) || 3,
    strikeWindowDays: Number(e.strikeWindowDays) || 90,
    autoSuspend: e.autoSuspend === true,
  };
}

export async function activeStrikes(sellerId, { windowDays = 90, now = new Date() } = {}) {
  return SellerMessage.countDocuments({
    seller: sellerId, kind: 'warning', strike: true, withdrawnAt: null, createdAt: { $gte: new Date(now - windowDays * DAY) },
  });
}

/** Email + in-app notice to the seller's logins (owner always; staff only for plain messages). */
async function deliver(seller, msg, { email = true } = {}) {
  const warning = msg.kind !== 'message';
  await notifySellerUsers(seller._id, {
    type: 'seller_account',
    titleAr: warning ? (msg.strike ? 'إنذار رسمي من المتجر' : 'تنبيه من المتجر') : 'رسالة جديدة من المتجر',
    titleEn: warning ? (msg.strike ? 'Formal warning from the store' : 'Notice from the store') : 'New message from the store',
    messageAr: msg.body.slice(0, 140),
    messageEn: msg.body.slice(0, 140),
    link: '/seller-center/messages',
  });
  if (!email) return;
  const users = await User.find({ seller: seller._id, isActive: { $ne: false }, ...(warning ? { role: 'seller_owner' } : {}) }).select('name email').lean();
  for (const u of users) {
    if (!u.email) continue;
    sendEmail({ to: u.email, ...sellerStoreMessageTemplate(u, { seller, body: msg.body, kind: msg.kind, strike: msg.strike }) })
      .catch((err) => console.error('Seller message email failed:', err.message));
  }
}

/**
 * Staff → seller. `kind` message | warning; warnings may carry a strike and a reason.
 * Returns { message, suspended } — suspended when this strike reached the limit with
 * auto-suspend on.
 */
export async function postStaffMessage(seller, { body, kind = 'message', strike = false, reason = '', email = true, actor = null, req = null }) {
  const text = String(body || '').trim().slice(0, 4000);
  if (!text) throw Object.assign(new Error('Write a message'), { statusCode: 400 });
  const isWarning = kind === 'warning';
  const msg = await SellerMessage.create({
    seller: seller._id,
    from: 'staff',
    kind: isWarning ? 'warning' : 'message',
    author: actor?._id || null,
    authorName: actor?.name || '',
    body: text,
    reason: isWarning ? reason : '',
    strike: isWarning && strike === true,
    staffReadAt: new Date(),
  });
  await deliver(seller, msg, { email });
  if (isWarning) {
    await AuditLog.create({
      actor: actor?._id, actorName: actor?.name, actorRole: actor?.role,
      action: 'update', entityType: 'seller', entityId: seller._id, entityLabel: seller.nameEn,
      changes: { warning: { from: null, to: { strike: msg.strike, reason: msg.reason, text: text.slice(0, 200) } } },
    }).catch(() => {});
  }
  let suspended = false;
  if (msg.strike) suspended = await enforceStrikes(seller, { actor, req });
  return { message: msg, suspended };
}

/** Suspend when strikes reached the limit and auto-suspend is on. Returns true if it suspended. */
export async function enforceStrikes(seller, { actor = null, now = new Date() } = {}) {
  const cfg = enforcementConfig(await getMarketplaceSettingsDoc());
  if (!cfg.autoSuspend || seller.status !== 'active') return false;
  const strikes = await activeStrikes(seller._id, { windowDays: cfg.strikeWindowDays, now });
  if (strikes < cfg.maxStrikes) return false;
  const reason = `Automatic: ${strikes} warnings in ${cfg.strikeWindowDays} days (limit ${cfg.maxStrikes}). — تم الإيقاف تلقائياً بسبب ${strikes} إنذارات خلال ${cfg.strikeWindowDays} يوماً.`;
  await changeSellerStatus(seller, 'suspended', { reason, actor: actor ? { _id: actor._id, name: actor.name } : null });
  await AuditLog.create({
    actor: actor?._id, actorName: actor?.name || 'Account health', actorRole: actor?.role || 'system',
    action: 'status_change', entityType: 'seller', entityId: seller._id, entityLabel: seller.nameEn,
    changes: { status: { from: 'active', to: 'suspended' }, reason: { from: null, to: reason } },
  }).catch(() => {});
  return true;
}

/** Staff take back a strike (it stays in the conversation, marked withdrawn). */
export async function withdrawStrike(seller, messageId, { actor } = {}) {
  const msg = await SellerMessage.findOne({ _id: messageId, seller: seller._id, kind: 'warning', strike: true });
  if (!msg) throw Object.assign(new Error('Warning not found'), { statusCode: 404 });
  if (msg.withdrawnAt) return msg;
  msg.withdrawnAt = new Date();
  msg.withdrawnBy = actor?.name || '';
  await msg.save();
  await AuditLog.create({
    actor: actor?._id, actorName: actor?.name, actorRole: actor?.role,
    action: 'update', entityType: 'seller', entityId: seller._id, entityLabel: seller.nameEn,
    changes: { warningWithdrawn: { from: { reason: msg.reason, at: msg.createdAt }, to: null } },
  }).catch(() => {});
  return msg;
}

/**
 * Job (daily is enough; runs with the seller jobs): send an automatic notice to active sellers
 * whose health turned "at risk" — at most one a week each. Returns how many were sent.
 */
let lastRunDay = '';
export async function runSellerEnforcement(now = new Date(), { force = false } = {}) {
  const day = now.toISOString().slice(0, 10);
  if (!force && lastRunDay === day) return 0;
  lastRunDay = day;
  const cfg = enforcementConfig(await getMarketplaceSettingsDoc());
  if (!cfg.autoWarnAtRisk) return 0;
  const sellers = await Seller.find({ status: 'active' }).select('_id nameAr nameEn status').lean();
  let sent = 0;
  for (const s of sellers) {
    // eslint-disable-next-line no-await-in-loop
    const perf = await getSellerPerformance(s._id, { now });
    if (perf.health !== 'at_risk') continue;
    // eslint-disable-next-line no-await-in-loop
    const recent = await SellerMessage.exists({ seller: s._id, from: 'system', kind: 'notice', createdAt: { $gte: new Date(now - AUTO_NOTICE_EVERY_DAYS * DAY) } });
    if (recent) continue;
    const body = [
      'صحة حسابك «في خطر». خلال آخر 90 يوماً:',
      `• نسبة الإلغاء من البائع: ${perf.cancelRate}% (الحد 5%)`,
      `• الشحن المتأخر: ${perf.lateShipRate}% (الحد 10%)`,
      ...(perf.ratingCount >= 5 ? [`• التقييم: ${perf.rating} (الحد الأدنى 3.5)`] : []),
      'حسّن هذه الأرقام لتجنب الإنذارات وإيقاف المتجر.',
      '',
      `Your account health is "at risk": seller cancels ${perf.cancelRate}%, late shipping ${perf.lateShipRate}%. Please improve to avoid warnings and suspension.`,
    ].join('\n');
    // eslint-disable-next-line no-await-in-loop
    const msg = await SellerMessage.create({ seller: s._id, from: 'system', kind: 'notice', authorName: 'Account health', body, staffReadAt: now });
    // eslint-disable-next-line no-await-in-loop
    await deliver(s, msg);
    sent += 1;
  }
  return sent;
}

/** Thread for either side, newest last. */
export async function listMessages(sellerId, { limit = 100 } = {}) {
  const rows = await SellerMessage.find({ seller: sellerId }).sort({ createdAt: -1 }).limit(limit).lean();
  return rows.reverse();
}
