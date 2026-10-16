/**
 * Seller deal changes (commission %, category deals, fee plan, deal terms): validate once,
 * apply now or on a date, and keep a field-level history in the audit log.
 *
 * Used by the per-seller panel, the bulk "change deal" action and the scheduled-change job, so
 * all three follow the same rules. Past sales are never touched — fees are snapshotted per
 * shipment at checkout.
 */
import mongoose from 'mongoose';
import Seller from '../models/Seller.js';
import AuditLog from '../models/AuditLog.js';
import { AppError } from '../utils/AppError.js';
import { sanitizeFeeOverrides } from '../utils/sellerFeeInput.js';
import { sellerChanges } from '../utils/sellerAudit.js';
import { getMarketplaceSettingsDoc, notifySellerUsers } from './marketplace.service.js';

const isId = (v) => mongoose.Types.ObjectId.isValid(v);
export const DEAL_FIELDS = ['commissionRate', 'categoryCommissions', 'feePlan', 'feeOverrides'];

export function sanitizeCommissionRules(rules) {
  if (!Array.isArray(rules)) throw new AppError('categoryCommissions must be a list', 400);
  const seen = new Set();
  return rules
    .filter((r) => isId(r?.category?._id || r?.category))
    .map((r) => {
      const rate = Number(r.rate);
      if (!Number.isFinite(rate) || rate < 0 || rate > 100) throw new AppError('Commission must be 0–100%', 400);
      return { category: String(r.category?._id || r.category), rate };
    })
    .filter((r) => (seen.has(r.category) ? false : seen.add(r.category)));
}

/**
 * Clean a deal change. `feeOverrides` may be partial ({ commissionFreeUntil }) — it is merged
 * onto the seller's current terms when applied. Returns only the keys that were sent.
 */
export async function validateDealChanges(input = {}, { settingsDoc = null } = {}) {
  const out = {};
  if (input.commissionRate !== undefined) {
    if (input.commissionRate === null || input.commissionRate === '') out.commissionRate = null;
    else {
      const rate = Number(input.commissionRate);
      if (!Number.isFinite(rate) || rate < 0 || rate > 100) throw new AppError('Commission must be 0–100%', 400);
      out.commissionRate = rate;
    }
  }
  if (input.categoryCommissions !== undefined) out.categoryCommissions = sanitizeCommissionRules(input.categoryCommissions);
  if (input.feePlan !== undefined) {
    const key = String(input.feePlan ?? '').trim().slice(0, 40);
    if (key) {
      const doc = settingsDoc || await getMarketplaceSettingsDoc();
      if (!(doc.plans || []).some((p) => p.key === key)) throw new AppError('Unknown fee plan', 400);
    }
    out.feePlan = key;
  }
  if (input.feeOverrides !== undefined) {
    if (!input.feeOverrides || typeof input.feeOverrides !== 'object') throw new AppError('feeOverrides must be an object', 400);
    // Validate the sent keys now (so a bad scheduled change fails today, not on its date).
    sanitizeFeeOverrides(input.feeOverrides);
    out.feeOverrides = { ...input.feeOverrides };
  }
  if (!Object.keys(out).length) throw new AppError('Nothing to change', 400);
  return out;
}

/** Put a validated change onto a seller document (not saved). */
export function applyDealToSeller(seller, changes) {
  if (changes.commissionRate !== undefined) seller.commissionRate = changes.commissionRate;
  if (changes.categoryCommissions !== undefined) seller.categoryCommissions = changes.categoryCommissions;
  if (changes.feePlan !== undefined) seller.feePlan = changes.feePlan;
  if (changes.feeOverrides !== undefined) {
    const current = seller.feeOverrides?.toObject ? seller.feeOverrides.toObject() : { ...(seller.feeOverrides || {}) };
    seller.feeOverrides = sanitizeFeeOverrides({ ...current, ...changes.feeOverrides });
  }
}

const actorOf = (req) => ({ _id: req?.user?._id || null, name: req?.user?.name || '', role: req?.user?.role || '' });

/** Save + audit (field-level) + tell the seller their fee terms changed. */
async function saveDeal(seller, before, { actor, note = '', via = 'now' }) {
  await seller.save();
  const changes = sellerChanges(before, seller.toObject());
  if (!Object.keys(changes).length) return changes;
  if (note) changes.note = { from: null, to: note };
  if (via !== 'now') changes.via = { from: null, to: via };
  await AuditLog.create({
    actor: actor?._id || undefined,
    actorName: actor?.name || (via === 'schedule' ? 'Scheduled change' : ''),
    actorRole: actor?.role || 'system',
    action: 'update',
    entityType: 'seller',
    entityId: seller._id,
    entityLabel: seller.nameEn,
    changes,
  }).catch((err) => console.error('Audit log failed:', err.message));
  await notifySellerUsers(seller._id, {
    type: 'seller_account',
    titleAr: 'تم تحديث رسومك',
    titleEn: 'Your fees were updated',
    messageAr: 'تغيّرت شروط العمولة أو الرسوم لمتجرك. تطبق على الطلبات الجديدة فقط.',
    messageEn: 'Your commission or fee terms changed. They apply to new orders only.',
    link: '/seller-center/finance',
  });
  return changes;
}

/** Apply a change to one seller right now. */
export async function applyDealNow(seller, changes, { req, note = '' } = {}) {
  const before = seller.toObject();
  applyDealToSeller(seller, changes);
  return saveDeal(seller, before, { actor: actorOf(req), note });
}

/** Queue a change for `applyAt` (must be in the future). */
export async function scheduleDeal(seller, changes, { applyAt, note = '', req } = {}) {
  const at = new Date(applyAt);
  if (Number.isNaN(at.getTime())) throw new AppError('Choose a valid date', 400);
  if (at <= new Date()) throw new AppError('Choose a date in the future', 400);
  if (at - Date.now() > 366 * 86400000) throw new AppError('Schedule up to one year ahead', 400);
  if (seller.scheduledDeals.filter((d) => d.status === 'pending').length >= 10) {
    throw new AppError('Up to 10 waiting changes per seller — cancel one first', 400);
  }
  seller.scheduledDeals.push({
    applyAt: at, changes, note: String(note || '').slice(0, 300),
    createdBy: req?.user?._id || null, createdByName: req?.user?.name || '',
  });
  await seller.save();
  const entry = seller.scheduledDeals[seller.scheduledDeals.length - 1];
  await AuditLog.create({
    actor: req?.user?._id, actorName: req?.user?.name, actorRole: req?.user?.role,
    action: 'update', entityType: 'seller', entityId: seller._id, entityLabel: seller.nameEn,
    changes: { scheduledDeal: { from: null, to: { applyAt: at, fields: Object.keys(changes), note: entry.note } } },
  }).catch(() => {});
  return entry;
}

export async function cancelScheduledDeal(seller, changeId, { req } = {}) {
  const entry = seller.scheduledDeals.id(changeId);
  if (!entry || entry.status !== 'pending') throw new AppError('This change is not waiting any more', 404);
  entry.status = 'cancelled';
  entry.doneAt = new Date();
  await seller.save();
  await AuditLog.create({
    actor: req?.user?._id, actorName: req?.user?.name, actorRole: req?.user?.role,
    action: 'update', entityType: 'seller', entityId: seller._id, entityLabel: seller.nameEn,
    changes: { scheduledDealCancelled: { from: { applyAt: entry.applyAt, fields: Object.keys(entry.changes || {}) }, to: null } },
  }).catch(() => {});
  return entry;
}

/** Job: apply every waiting change whose date has come, oldest first. Returns how many. */
export async function runScheduledDealChanges(now = new Date()) {
  const sellers = await Seller.find({ scheduledDeals: { $elemMatch: { status: 'pending', applyAt: { $lte: now } } } });
  let applied = 0;
  for (const seller of sellers) {
    const due = seller.scheduledDeals
      .filter((d) => d.status === 'pending' && d.applyAt <= now)
      .sort((a, b) => a.applyAt - b.applyAt);
    const before = seller.toObject();
    for (const d of due) {
      try {
        applyDealToSeller(seller, d.changes || {});
        d.status = 'applied';
      } catch (err) {
        // A change that no longer validates (e.g. its plan was deleted) is dropped, not retried forever.
        d.status = 'cancelled';
        d.note = `${d.note ? `${d.note} — ` : ''}not applied: ${err.message}`.slice(0, 300);
      }
      d.doneAt = now;
      applied += d.status === 'applied' ? 1 : 0;
    }
    // eslint-disable-next-line no-await-in-loop
    await saveDeal(seller, before, { actor: null, note: due.map((d) => d.note).filter(Boolean).join(' · '), via: 'schedule' });
  }
  return applied;
}

/** Deal-related history rows for a seller (newest first), straight from the audit log. */
export async function sellerHistory(sellerId, { onlyDeal = false, limit = 50, before = null } = {}) {
  const filter = { entityType: 'seller', entityId: sellerId };
  if (before) filter.createdAt = { $lt: new Date(before) };
  const rows = await AuditLog.find(filter).sort({ createdAt: -1 }).limit(Math.min(200, limit * (onlyDeal ? 4 : 1))).lean();
  const isDeal = (k) => /^(commissionRate|categoryCommissions|feePlan|feeOverrides\.|scheduledDeal)/.test(k);
  return rows
    .map((r) => ({
      _id: r._id,
      at: r.createdAt,
      actorName: r.actorName || '',
      actorRole: r.actorRole || '',
      action: r.action,
      changes: Object.fromEntries(Object.entries(r.changes || {}).filter(([k]) => !onlyDeal || isDeal(k) || k === 'note' || k === 'via')),
    }))
    .filter((r) => !onlyDeal || Object.keys(r.changes).some(isDeal))
    .slice(0, limit);
}
