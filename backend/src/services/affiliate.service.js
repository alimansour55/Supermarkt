/**
 * Share & earn (affiliate) program — database side. Pure rules live in utils/affiliateRules.js.
 *
 * Life of a reward:
 *   order placed with ?ref=CODE  → commission "pending"   (attachAffiliateToOrder)
 *   order delivered + paid       → "holding" until holdUntil (approveAffiliateCommission)
 *   hold over (background job)   → reward credited, "paid"  (releaseDueAffiliateCommissions)
 *   cancelled / refunded first   → "cancelled";  refunded after payout → "reversed"
 * Every step is guarded by a status filter, so running twice never pays twice.
 */
import Affiliate from '../models/Affiliate.js';
import AffiliateCommission from '../models/AffiliateCommission.js';
import AffiliateSettings from '../models/AffiliateSettings.js';
import Order from '../models/Order.js';
import User from '../models/User.js';
import { getLoyaltySettings } from './loyalty.service.js';
import { creditWallet, debitWallet } from './wallet.service.js';
import { createUserNotification } from './userNotification.service.js';
import {
  calculateAffiliateReward,
  checkAffiliateAttribution,
  effectiveAffiliateRate,
  generateAffiliateCode,
  holdUntilFrom,
  isValidAffiliateCode,
  normalizeAffiliateCode,
  normalizeAffiliateSettings,
} from '../utils/affiliateRules.js';

const CANCELLED_ORDER_STATUSES = ['cancelled', 'delivery_failed', 'returned'];

/** paymentStatus 'refunded' is also set for partial admin refunds, so compare amounts. */
const isFullyRefunded = (order) => {
  const refunded = Number(order?.refundAmount || 0);
  return refunded > 0 && refunded >= Number(order?.total || 0) - 0.01;
};

export async function getAffiliateSettings() {
  const doc = await AffiliateSettings.findOne({ key: 'main' }).lean();
  return normalizeAffiliateSettings(doc || {});
}

export async function saveAffiliateSettings(input = {}) {
  const current = await getAffiliateSettings();
  const next = normalizeAffiliateSettings({ ...current, ...input });
  // Upsert on the unique key — two first-time saves can't create two documents.
  await AffiliateSettings.findOneAndUpdate(
    { key: 'main' },
    { $set: next, $setOnInsert: { key: 'main' } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return next;
}

async function pointValueEGP() {
  const loyalty = await getLoyaltySettings();
  return Number(loyalty.redemptionEGPPerPoint) || 0;
}

export async function findAffiliateByCode(code) {
  const normalized = normalizeAffiliateCode(code);
  if (!isValidAffiliateCode(normalized)) return null;
  return Affiliate.findOne({ code: normalized });
}

async function uniqueCode() {
  for (let i = 0; i < 8; i += 1) {
    const code = generateAffiliateCode(i < 4 ? 7 : 9);
    // eslint-disable-next-line no-await-in-loop
    if (!(await Affiliate.exists({ code }))) return code;
  }
  throw new Error('Could not generate a unique affiliate code');
}

/** Create the customer's link (status depends on the join mode). Idempotent. */
export async function joinAffiliateProgram(userId) {
  const existing = await Affiliate.findOne({ user: userId });
  if (existing) return existing;
  const settings = await getAffiliateSettings();
  const status = settings.joinMode === 'approval' ? 'pending' : 'active';
  try {
    return await Affiliate.create({ user: userId, code: await uniqueCode(), status, statusChangedAt: new Date() });
  } catch (err) {
    if (err?.code === 11000) return Affiliate.findOne({ user: userId });
    throw err;
  }
}

/** Change a link's code. Throws a coded error the controller turns into a message. */
export async function changeAffiliateCode(affiliate, rawCode) {
  const code = normalizeAffiliateCode(rawCode);
  if (!isValidAffiliateCode(code)) {
    const err = new Error('invalid_code');
    err.code = 'invalid_code';
    throw err;
  }
  if (code === affiliate.code) return affiliate;
  if (await Affiliate.exists({ code, _id: { $ne: affiliate._id } })) {
    const err = new Error('code_taken');
    err.code = 'code_taken';
    throw err;
  }
  affiliate.code = code;
  try {
    await affiliate.save();
  } catch (e) {
    if (e?.code === 11000) {
      const err = new Error('code_taken');
      err.code = 'code_taken';
      throw err;
    }
    throw e;
  }
  return affiliate;
}

export async function recordAffiliateClick(code) {
  const settings = await getAffiliateSettings();
  if (!settings.enabled) return { valid: false };
  const normalized = normalizeAffiliateCode(code);
  if (!isValidAffiliateCode(normalized)) return { valid: false };
  const affiliate = await Affiliate.findOneAndUpdate(
    { code: normalized, status: 'active' },
    { $inc: { clicks: 1 }, $set: { lastClickAt: new Date() } },
    { new: true },
  ).select('code');
  if (!affiliate) return { valid: false };
  return { valid: true, code: affiliate.code, attributionDays: settings.attributionDays };
}

/**
 * Called right after an order is created. Never throws into checkout — a bad or
 * ineligible code simply earns nothing. Returns the commission or null.
 */
export async function attachAffiliateToOrder(order, rawCode) {
  if (!order || !rawCode) return null;
  const settings = await getAffiliateSettings();
  if (!settings.enabled) return null;
  const affiliate = await findAffiliateByCode(rawCode);
  if (!affiliate) return null;
  if (await AffiliateCommission.exists({ order: order._id })) return null;

  const [owner, buyer, buyerPastOrders, rewardedOrdersFromBuyer] = await Promise.all([
    User.findById(affiliate.user).select('phone isActive deletedAt').lean(),
    User.findById(order.user).select('phone').lean(),
    Order.countDocuments({
      user: order.user,
      _id: { $ne: order._id },
      orderStatus: { $nin: CANCELLED_ORDER_STATUSES },
    }),
    AffiliateCommission.countDocuments({
      affiliate: affiliate._id,
      buyer: order.user,
      status: { $in: ['pending', 'holding', 'paid'] },
    }),
  ]);
  if (!owner || owner.deletedAt || owner.isActive === false) return null;

  const check = checkAffiliateAttribution({
    settings, affiliate, owner, buyer, buyerPastOrders, rewardedOrdersFromBuyer,
  });
  if (!check.ok) return null;

  const pv = await pointValueEGP();
  const reward = calculateAffiliateReward({ settings, affiliate, order, pointValueEGP: pv });
  if (!reward.eligible) return null;

  const rate = effectiveAffiliateRate(settings, affiliate);
  try {
    const commission = await AffiliateCommission.create({
      affiliate: affiliate._id,
      owner: affiliate.user,
      buyer: order.user,
      order: order._id,
      orderNumber: order.orderNumber,
      code: affiliate.code,
      status: 'pending',
      rewardType: reward.rewardType,
      baseAmount: reward.baseAmount,
      rewardAmount: reward.rewardAmount,
      cashValue: reward.cashValue,
      rateLabel: rate.calcType === 'percent' ? `percent:${rate.percent}` : `fixed:${rate.fixedAmount}`,
    });
    await Order.updateOne({ _id: order._id }, { $set: { affiliateCode: affiliate.code } });
    order.affiliateCode = affiliate.code;
    return commission;
  } catch (err) {
    if (err?.code === 11000) return null; // already attached
    throw err;
  }
}

/** Recalculate a not-yet-paid reward from the order as it is now (edits, partial returns). */
async function recalcOpenCommission(commission, order) {
  const settings = await getAffiliateSettings();
  const affiliate = await Affiliate.findById(commission.affiliate).lean();
  const pv = await pointValueEGP();
  // The reward type is fixed when the order is placed; only the amount follows the order.
  const reward = calculateAffiliateReward({
    settings: { ...settings, rewardType: commission.rewardType },
    affiliate,
    order,
    pointValueEGP: pv,
  });
  return reward;
}

/**
 * Order is delivered and paid → start the hold (or pay right away when holdDays is 0).
 * Safe to call from every "delivered" code path; it is a no-op otherwise.
 */
export async function approveAffiliateCommission(order) {
  if (!order || order.orderStatus !== 'delivered' || order.paymentStatus !== 'paid') return null;
  const commission = await AffiliateCommission.findOne({ order: order._id, status: 'pending' });
  if (!commission) return null;

  const reward = await recalcOpenCommission(commission, order);
  const settings = await getAffiliateSettings();
  const deliveredAt = order.deliveredAt || new Date();
  const update = reward.eligible
    ? {
      status: 'holding',
      baseAmount: reward.baseAmount,
      rewardAmount: reward.rewardAmount,
      cashValue: reward.cashValue,
      deliveredAt,
      holdUntil: holdUntilFrom(deliveredAt, settings.holdDays),
    }
    : { status: 'cancelled', cancelledAt: new Date(), note: 'Nothing left to reward after changes to the order' };

  const updated = await AffiliateCommission.findOneAndUpdate(
    { _id: commission._id, status: 'pending' },
    { $set: update },
    { new: true },
  );
  if (updated?.status === 'holding' && settings.holdDays === 0) {
    return (await payCommission(updated)) || updated;
  }
  return updated;
}

async function payCommission(commission) {
  // Claim it first so two job runs can't both pay.
  const claimed = await AffiliateCommission.findOneAndUpdate(
    { _id: commission._id, status: 'holding' },
    { $set: { status: 'paid', paidAt: new Date() } },
    { new: true },
  );
  if (!claimed) return null;

  try {
    if (claimed.rewardType === 'wallet') {
      const result = await creditWallet({
        userId: claimed.owner,
        amount: claimed.rewardAmount,
        type: 'reward',
        method: 'system',
        // No order link: the link owner must not see the buyer's order.
        note: 'Share & earn reward',
      });
      if (result?.transaction) {
        await AffiliateCommission.updateOne({ _id: claimed._id }, { $set: { walletTransaction: result.transaction._id } });
      }
    } else {
      const loyalty = await getLoyaltySettings();
      const expiresAt = loyalty.expiryDays > 0
        ? new Date(Date.now() + loyalty.expiryDays * 24 * 60 * 60 * 1000)
        : null;
      await User.updateOne({ _id: claimed.owner }, {
        $inc: { pointsBalance: claimed.rewardAmount },
        $push: {
          pointsHistory: {
            type: 'referral',
            points: claimed.rewardAmount,
            amount: claimed.baseAmount,
            note: 'Share & earn reward',
            expiresAt,
          },
        },
      });
    }
  } catch (err) {
    // Hand it back to the queue so the next run retries.
    await AffiliateCommission.updateOne({ _id: claimed._id, status: 'paid' }, { $set: { status: 'holding', paidAt: null } });
    throw err;
  }

  const isPoints = claimed.rewardType === 'points';
  createUserNotification({
    userId: claimed.owner,
    type: 'affiliate_reward',
    titleAr: 'ربحت مكافأة من رابطك 🎉',
    titleEn: 'You earned a reward from your link 🎉',
    messageAr: isPoints
      ? `أضفنا ${claimed.rewardAmount} نقطة لحسابك لأن أحدهم اشترى من رابطك.`
      : `أضفنا ${claimed.rewardAmount} EGP إلى محفظتك لأن أحدهم اشترى من رابطك.`,
    messageEn: isPoints
      ? `We added ${claimed.rewardAmount} points because someone bought through your link.`
      : `We added EGP ${claimed.rewardAmount} to your wallet because someone bought through your link.`,
    link: '/share-and-earn',
    data: { commissionId: String(claimed._id) },
  }).catch((err) => console.error('Affiliate reward notification failed:', err.message));

  return claimed;
}

/** Background job: pay every reward whose hold is over. */
export async function releaseDueAffiliateCommissions(now = new Date()) {
  const due = await AffiliateCommission.find({ status: 'holding', holdUntil: { $lte: now } })
    .sort({ holdUntil: 1 })
    .limit(200);
  let paid = 0;
  for (const commission of due) {
    // A refund may have landed since the hold started — re-check the order first.
    // eslint-disable-next-line no-await-in-loop
    const order = await Order.findById(commission.order).lean();
    if (!order || CANCELLED_ORDER_STATUSES.includes(order.orderStatus) || isFullyRefunded(order)) {
      // eslint-disable-next-line no-await-in-loop
      await AffiliateCommission.updateOne(
        { _id: commission._id, status: 'holding' },
        { $set: { status: 'cancelled', cancelledAt: new Date(), note: 'Order was cancelled or refunded' } },
      );
      continue;
    }
    try {
      // eslint-disable-next-line no-await-in-loop
      if (await payCommission(commission)) paid += 1;
    } catch (err) {
      console.error('Affiliate payout failed:', err.message);
    }
  }
  return paid;
}

/** Admin "pay now": skip the rest of the hold. */
export async function releaseCommissionNow(commissionId) {
  const commission = await AffiliateCommission.findById(commissionId);
  if (!commission || commission.status !== 'holding') return null;
  return payCommission(commission);
}

/** Take a paid reward back. Returns true when fully recovered. */
async function reversePaidCommission(commission, note) {
  const claimed = await AffiliateCommission.findOneAndUpdate(
    { _id: commission._id, status: 'paid' },
    { $set: { status: 'reversed', reversedAt: new Date(), note } },
    { new: true },
  );
  if (!claimed) return false;

  let recovered = false;
  if (claimed.rewardType === 'wallet') {
    const result = await debitWallet({
      userId: claimed.owner,
      amount: claimed.rewardAmount,
      type: 'reversal',
      method: 'system',
      note: 'Share & earn reward taken back — the order was refunded',
    });
    recovered = Boolean(result);
  } else {
    const res = await User.updateOne(
      { _id: claimed.owner, pointsBalance: { $gte: claimed.rewardAmount } },
      {
        $inc: { pointsBalance: -claimed.rewardAmount },
        $push: {
          pointsHistory: {
            type: 'adjust',
            points: -claimed.rewardAmount,
            note: 'Share & earn reward taken back — the order was refunded',
          },
        },
      },
    );
    recovered = res.modifiedCount > 0;
  }
  if (!recovered) {
    await AffiliateCommission.updateOne({ _id: claimed._id }, { $set: { clawbackFailed: true } });
  }
  return recovered;
}

/**
 * Keep the reward in step with refunds and cancellations. Call after an order is
 * cancelled, fully refunded or a return is approved (order already saved or not —
 * only the fields on `order` are read).
 */
export async function syncAffiliateCommissionWithOrder(order, { reason = '' } = {}) {
  if (!order?._id) return null;
  const commission = await AffiliateCommission.findOne({ order: order._id });
  if (!commission || ['cancelled', 'reversed'].includes(commission.status)) return commission;

  const fullyGone = CANCELLED_ORDER_STATUSES.includes(order.orderStatus) || isFullyRefunded(order);

  if (commission.status === 'paid') {
    if (fullyGone) await reversePaidCommission(commission, reason || 'Order refunded after the reward was paid');
    return AffiliateCommission.findById(commission._id);
  }

  if (fullyGone) {
    return AffiliateCommission.findOneAndUpdate(
      { _id: commission._id, status: { $in: ['pending', 'holding'] } },
      { $set: { status: 'cancelled', cancelledAt: new Date(), note: reason || 'Order cancelled or refunded' } },
      { new: true },
    );
  }

  // Partial return: shrink the open reward.
  const reward = await recalcOpenCommission(commission, order);
  const set = reward.eligible
    ? { baseAmount: reward.baseAmount, rewardAmount: reward.rewardAmount, cashValue: reward.cashValue }
    : { status: 'cancelled', cancelledAt: new Date(), note: 'Nothing left to reward after the return' };
  return AffiliateCommission.findOneAndUpdate(
    { _id: commission._id, status: { $in: ['pending', 'holding'] } },
    { $set: set },
    { new: true },
  );
}

export async function cancelCommissionByAdmin(commissionId, note = '') {
  const commission = await AffiliateCommission.findById(commissionId);
  if (!commission) return null;
  if (commission.status === 'paid') {
    await reversePaidCommission(commission, note || 'Cancelled by the store');
    return AffiliateCommission.findById(commissionId);
  }
  return AffiliateCommission.findOneAndUpdate(
    { _id: commissionId, status: { $in: ['pending', 'holding'] } },
    { $set: { status: 'cancelled', cancelledAt: new Date(), note: note || 'Cancelled by the store' } },
    { new: true },
  );
}

/** Totals for one or many affiliates: { [affiliateId]: { orders, pending, holding, paid, ... } } */
export async function affiliateStats(affiliateIds) {
  const ids = (Array.isArray(affiliateIds) ? affiliateIds : [affiliateIds]).filter(Boolean);
  if (!ids.length) return {};
  const rows = await AffiliateCommission.aggregate([
    { $match: { affiliate: { $in: ids } } },
    {
      $group: {
        _id: { affiliate: '$affiliate', status: '$status' },
        count: { $sum: 1 },
        reward: { $sum: '$rewardAmount' },
        cash: { $sum: '$cashValue' },
        sales: { $sum: '$baseAmount' },
      },
    },
  ]);
  const out = {};
  for (const row of rows) {
    const key = String(row._id.affiliate);
    out[key] ||= {
      orders: 0, sales: 0, pendingReward: 0, holdingReward: 0, paidReward: 0, paidCash: 0, cancelledOrders: 0,
    };
    const s = out[key];
    const status = row._id.status;
    if (status === 'cancelled' || status === 'reversed') {
      s.cancelledOrders += row.count;
      continue;
    }
    s.orders += row.count;
    s.sales += row.sales;
    if (status === 'pending') s.pendingReward += row.reward;
    if (status === 'holding') s.holdingReward += row.reward;
    if (status === 'paid') {
      s.paidReward += row.reward;
      s.paidCash += row.cash;
    }
  }
  const r2 = (n) => Math.round(n * 100) / 100;
  Object.values(out).forEach((s) => {
    s.sales = r2(s.sales);
    s.pendingReward = r2(s.pendingReward);
    s.holdingReward = r2(s.holdingReward);
    s.paidReward = r2(s.paidReward);
    s.paidCash = r2(s.paidCash);
  });
  return out;
}

export { pointValueEGP as getAffiliatePointValue };
