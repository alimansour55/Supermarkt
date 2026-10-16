/**
 * The end (and restart) of a seller's life on the marketplace, terms versions, and document
 * expiry.
 *
 * Closing a store: refused while parcels are still open; any money still in the ledger stays
 * there and is paid out as usual (payouts work for closed stores). Listings disappear (product
 * visibility follows seller status), waiting deal changes are cancelled, and every login is
 * turned off and signed out — reopening turns those same logins back on.
 */
import Seller from '../models/Seller.js';
import User from '../models/User.js';
import Shipment from '../models/Shipment.js';
import { AppError } from '../utils/AppError.js';
import { sendEmail } from '../utils/sendEmail.js';
import { sellerStoreMessageTemplate } from '../emails/templates/sellerTemplates.js';
import { changeSellerStatus, notifySellerUsers } from './marketplace.service.js';
import { getSellerBalance } from './sellerLedger.service.js';

const DAY = 86400000;
export const OPEN_PARCEL_STATUSES = ['pending', 'confirmed', 'packed', 'shipped'];

/** What closing would leave behind — shown to staff before they confirm. */
export async function closureCheck(sellerId) {
  const [openParcels, balance] = await Promise.all([
    Shipment.countDocuments({ seller: sellerId, status: { $in: OPEN_PARCEL_STATUSES } }),
    getSellerBalance(sellerId),
  ]);
  const owed = Math.round(((balance.available || 0) + (balance.pending || 0) + (balance.inPayout || 0)) * 100) / 100;
  return { openParcels, balance, owed };
}

export async function closeSeller(seller, { reason, actor = null, acknowledgeBalance = false } = {}) {
  const check = await closureCheck(seller._id);
  if (check.openParcels > 0) {
    throw new AppError(`This store still has ${check.openParcels} open parcel(s) — finish or cancel them first`, 400);
  }
  if (check.owed !== 0 && !acknowledgeBalance) {
    throw new AppError(`This store still has a balance of ${check.owed} EGP — confirm it will be settled`, 409);
  }
  const owner = seller.owner ? await User.findById(seller.owner).select('name email').lean() : null;

  await changeSellerStatus(seller, 'closed', { reason, actor });
  // Notify while logins still work, then switch them off.
  const logins = await User.find({ seller: seller._id, isActive: { $ne: false } }).select('_id').lean();
  await User.updateMany({ _id: { $in: logins.map((u) => u._id) } }, { $set: { isActive: false }, $inc: { sessionVersion: 1 } });
  seller.closure = { closedAt: new Date(), closedBy: actor?._id || null, reason: String(reason || ''), loginIds: logins.map((u) => u._id) };
  for (const d of seller.scheduledDeals || []) {
    if (d.status === 'pending') { d.status = 'cancelled'; d.doneAt = new Date(); }
  }
  await seller.save();

  if (owner?.email) {
    const body = `تم إغلاق متجرك «${seller.nameAr}».\nالسبب: ${reason}\n${check.owed ? `رصيدك المتبقي (${check.owed} ج.م) سيُحوَّل لك حسب جدول التحويلات.` : ''}\n\nYour store "${seller.nameEn}" has been closed. Reason: ${reason}`;
    sendEmail({ to: owner.email, ...sellerStoreMessageTemplate(owner, { seller, body, kind: 'notice' }) })
      .catch((err) => console.error('Closure email failed:', err.message));
  }
  return { ...check, loginsTurnedOff: logins.length };
}

/** closed → under_review | active; the logins closing turned off come back. */
export async function reopenSeller(seller, { status = 'active', reason = '', actor = null } = {}) {
  if (seller.status !== 'closed') throw new AppError('Only a closed store can be reopened', 400);
  const ids = seller.closure?.loginIds || [];
  await changeSellerStatus(seller, status, { reason, actor });
  if (ids.length) await User.updateMany({ _id: { $in: ids }, seller: seller._id }, { $set: { isActive: true } });
  seller.closure = { closedAt: null, closedBy: null, reason: '', loginIds: [] };
  await seller.save();
  return { loginsTurnedOn: ids.length };
}

// ── Terms versions ──

/** Does this seller still have to accept the current terms? */
export function needsTermsAcceptance(seller, settings) {
  const hasTerms = Boolean(String(settings?.termsAr || '').trim() || String(settings?.termsEn || '').trim());
  return hasTerms && (seller?.termsAcceptedVersion || 0) < (settings?.termsVersion || 1);
}

/** Staff published changed terms: bump the version and tell every active seller. */
export async function publishTermsVersion(doc) {
  doc.termsVersion = (doc.termsVersion || 1) + 1;
  doc.termsUpdatedAt = new Date();
  await doc.save();
  const sellers = await Seller.find({ status: { $in: ['active', 'suspended', 'under_review'] } }).select('_id').lean();
  for (const s of sellers) {
    // eslint-disable-next-line no-await-in-loop
    await notifySellerUsers(s._id, {
      type: 'seller_account',
      titleAr: 'تم تحديث شروط البيع',
      titleEn: 'The seller terms were updated',
      messageAr: 'راجع الشروط الجديدة ووافق عليها لمتابعة استخدام مركز البائعين.',
      messageEn: 'Review and accept the new terms to keep using Seller Center.',
      link: '/seller-center',
    });
  }
  return doc.termsVersion;
}

// ── Document expiry ──

const REMIND_AT = [30, 7];

/**
 * Job: remind sellers 30 and 7 days before an accepted document expires, then mark it expired.
 * Returns { reminded, expired }.
 */
export async function runDocumentExpiry(now = new Date()) {
  const horizon = new Date(now.getTime() + REMIND_AT[0] * DAY);
  const sellers = await Seller.find({ documents: { $elemMatch: { status: 'accepted', expiresAt: { $ne: null, $lte: horizon } } } });
  let reminded = 0;
  let expired = 0;
  for (const seller of sellers) {
    let changed = false;
    for (const doc of seller.documents) {
      if (doc.status !== 'accepted' || !doc.expiresAt || doc.expiresAt > horizon) continue;
      if (doc.expiresAt <= now) {
        doc.status = 'expired';
        changed = true;
        expired += 1;
        // eslint-disable-next-line no-await-in-loop
        await notifySellerUsers(seller._id, {
          type: 'seller_account',
          titleAr: 'انتهت صلاحية مستند', titleEn: 'A document has expired',
          messageAr: 'ارفع نسخة سارية من المستند في صفحة المستندات.', messageEn: 'Upload a valid copy on the Documents page.',
          link: '/seller-center/store/documents',
        });
        continue;
      }
      const daysLeft = Math.ceil((doc.expiresAt - now) / DAY);
      const due = REMIND_AT.find((d) => daysLeft <= d && !(doc.remindedDays || []).includes(d));
      if (due === undefined) continue;
      // Mark every threshold already passed so a late first run sends one reminder, not two.
      doc.remindedDays = [...new Set([...(doc.remindedDays || []), ...REMIND_AT.filter((d) => daysLeft <= d)])];
      changed = true;
      reminded += 1;
      // eslint-disable-next-line no-await-in-loop
      await notifySellerUsers(seller._id, {
        type: 'seller_account',
        titleAr: `مستند ينتهي خلال ${daysLeft} يوماً`, titleEn: `A document expires in ${daysLeft} days`,
        messageAr: 'ارفع نسخة مجددة قبل انتهاء الصلاحية.', messageEn: 'Upload a renewed copy before it expires.',
        link: '/seller-center/store/documents',
      });
    }
    // eslint-disable-next-line no-await-in-loop
    if (changed) await seller.save();
  }
  return { reminded, expired };
}
