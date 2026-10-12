/**
 * Seller money. Every movement is an idempotent ledger entry (unique `key`), so re-running a
 * posting — a retried request, a status set twice — can never double-pay a seller.
 *
 * Lifecycle: delivered shipment → sale, fees, commission (and cash the seller collected),
 * all payable after the hold period → a staff-generated payout locks the payable entries →
 * marking it paid posts the payout debit.
 */
import mongoose from 'mongoose';
import Seller from '../models/Seller.js';
import Shipment from '../models/Shipment.js';
import SellerLedgerEntry from '../models/SellerLedgerEntry.js';
import SellerPayout from '../models/SellerPayout.js';
import Counter from '../models/Counter.js';
import { AppError } from '../utils/AppError.js';
import { getMarketplaceSettings } from './marketplace.service.js';
import { createUserNotification } from './userNotification.service.js';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const DAY = 86400000;

/** Insert entries, skipping any whose key already exists. Returns how many were new. */
async function postEntries(entries) {
  const rows = entries.filter((e) => round2(e.amount) !== 0).map((e) => ({ ...e, amount: round2(e.amount) }));
  if (!rows.length) return 0;
  // Idempotency rests on the unique `key` index — make sure it exists before the first write
  // (on a fresh database Mongoose builds indexes in the background).
  await SellerLedgerEntry.init();
  try {
    const res = await SellerLedgerEntry.insertMany(rows, { ordered: false });
    return res.length;
  } catch (err) {
    if (err?.code === 11000 || err?.writeErrors?.every?.((w) => w.code === 11000)) {
      return err.insertedDocs?.length ?? (err.result?.insertedCount || 0);
    }
    throw err;
  }
}

/**
 * Post a delivered shipment's earnings. Safe to call more than once.
 * The seller earns full line value: order-level discounts (coupons, points) are funded by the
 * marketplace. Cash the seller collected itself is debited, so the net is what it is owed.
 */
export async function postShipmentSettlement(shipment) {
  if (shipment.status !== 'delivered') return 0;
  const settings = await getMarketplaceSettings();
  const deliveredAt = shipment.deliveredAt || new Date();
  const availableAt = new Date(deliveredAt.getTime() + (settings.payoutHoldDays || 0) * DAY);
  const base = {
    seller: shipment.seller,
    shipment: shipment._id,
    order: shipment.order,
    reference: shipment.shipmentNumber,
    availableAt,
  };
  const k = (type) => `ship:${shipment._id}:${type}`;
  const posted = await postEntries([
    { ...base, type: 'sale', amount: shipment.subtotal, key: k('sale') },
    { ...base, type: 'delivery_fee', amount: shipment.deliveryFee, key: k('delivery_fee') },
    { ...base, type: 'commission', amount: -shipment.commissionTotal, key: k('commission') },
    { ...base, type: 'fulfillment_fee', amount: -shipment.fulfillmentFee, key: k('fulfillment_fee') },
    { ...base, type: 'cod_collected', amount: -(shipment.collectAmount || 0), key: k('cod_collected') },
  ]);
  if (!shipment.settledAt) {
    await Shipment.updateOne({ _id: shipment._id, settledAt: null }, { $set: { settledAt: new Date() } });
  }
  return posted;
}

/**
 * An approved return of a seller line: take back its value and give back its commission,
 * in proportion to the returned quantity. Idempotent per return.
 */
export async function postReturnReversal(order, returnDoc) {
  const item = order.items?.[returnDoc.itemIndex];
  if (!item?.seller) return 0;
  const shipment = await Shipment.findOne({ order: order._id, 'items.itemIndex': returnDoc.itemIndex });
  if (!shipment) return 0;
  const line = shipment.items.find((it) => it.itemIndex === returnDoc.itemIndex);
  const ratio = Math.min(1, (Number(returnDoc.quantity) || 0) / (line.quantity || 1));
  if (!ratio) return 0;

  const base = {
    seller: shipment.seller,
    shipment: shipment._id,
    order: order._id,
    reference: `${shipment.shipmentNumber} · return`,
    availableAt: new Date(),
  };
  const k = (type) => `ret:${returnDoc._id}:${type}`;
  // Not settled yet (return approved before delivery was posted) → settle first so the
  // reversal nets against real entries.
  if (shipment.status === 'delivered' && !shipment.settledAt) await postShipmentSettlement(shipment);
  return postEntries([
    { ...base, type: 'return', amount: -(line.lineTotal * ratio), key: k('return') },
    { ...base, type: 'commission_reversal', amount: line.commission * ratio, key: k('commission') },
  ]);
}

// ── Balances ──

/**
 * - available: payable now (past the hold, not yet in a payout)
 * - pending: still within the hold period
 * - inPayout: locked in payouts that are generated but not paid
 * - paidOut: transferred so far
 */
export async function getSellerBalance(sellerId, now = new Date()) {
  const id = new mongoose.Types.ObjectId(String(sellerId));
  const rows = await SellerLedgerEntry.aggregate([
    { $match: { seller: id } },
    {
      $group: {
        _id: null,
        available: { $sum: { $cond: [{ $and: [{ $lte: ['$availableAt', now] }, { $eq: ['$payout', null] }, { $ne: ['$type', 'payout'] }] }, '$amount', 0] } },
        pending: { $sum: { $cond: [{ $and: [{ $gt: ['$availableAt', now] }, { $eq: ['$payout', null] }] }, '$amount', 0] } },
        locked: { $sum: { $cond: [{ $and: [{ $ne: ['$payout', null] }, { $ne: ['$type', 'payout'] }] }, '$amount', 0] } },
        paidOut: { $sum: { $cond: [{ $eq: ['$type', 'payout'] }, '$amount', 0] } },
        lifetimeEarned: { $sum: { $cond: [{ $in: ['$type', ['sale', 'delivery_fee']] }, '$amount', 0] } },
      },
    },
  ]);
  const r = rows[0] || {};
  const paidOut = -round2(r.paidOut || 0);
  return {
    available: round2(r.available),
    pending: round2(r.pending),
    // Locked entries of paid payouts are offset by their payout debit.
    inPayout: round2((r.locked || 0) - paidOut),
    paidOut,
    lifetimeEarned: round2(r.lifetimeEarned),
  };
}

export async function listLedger(sellerId, { page = 1, limit = 50, type } = {}) {
  const filter = { seller: sellerId };
  if (type) filter.type = type;
  const [items, total] = await Promise.all([
    SellerLedgerEntry.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    SellerLedgerEntry.countDocuments(filter),
  ]);
  return { items, total };
}

// ── Adjustments & payouts ──

export async function addAdjustment(sellerId, { amount, note, actor }) {
  const value = round2(amount);
  if (!value) throw new AppError('Amount must not be zero', 400);
  if (!String(note || '').trim()) throw new AppError('Explain the adjustment', 400);
  const entry = await SellerLedgerEntry.create({
    seller: sellerId,
    type: 'adjustment',
    amount: value,
    availableAt: new Date(),
    note: String(note).trim().slice(0, 500),
    createdBy: actor?._id || null,
    key: `adj:${new mongoose.Types.ObjectId()}`,
  });
  return entry;
}

async function nextPayoutNumber() {
  const counter = await Counter.findOneAndUpdate(
    { _id: 'sellerPayout' },
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );
  return `PO-${String(counter.seq).padStart(5, '0')}`;
}

/**
 * Lock every payable entry of a seller into a new payout. Refuses when the payable total is
 * below the marketplace minimum (or not positive — the seller owes money).
 */
export async function generatePayout(sellerId, { actor = null, now = new Date() } = {}) {
  const seller = await Seller.findById(sellerId);
  if (!seller) throw new AppError('Seller not found', 404);
  const settings = await getMarketplaceSettings();

  const filter = { seller: seller._id, payout: null, type: { $ne: 'payout' }, availableAt: { $lte: now } };
  const entries = await SellerLedgerEntry.find(filter).select('_id amount').lean();
  const amount = round2(entries.reduce((s, e) => s + e.amount, 0));
  if (amount <= 0) throw new AppError('Nothing payable for this seller right now', 400);
  if (amount < (settings.minPayoutAmount || 0)) {
    throw new AppError(`Payable amount ${amount} is below the minimum payout of ${settings.minPayoutAmount}`, 400);
  }

  const payout = await SellerPayout.create({
    payoutNumber: await nextPayoutNumber(),
    seller: seller._id,
    sellerNameAr: seller.nameAr,
    sellerNameEn: seller.nameEn,
    amount,
    entryCount: entries.length,
    periodEnd: now,
    bankSnapshot: seller.bank ? { ...seller.bank.toObject?.() ?? seller.bank } : null,
    createdBy: actor?._id || null,
  });
  // Lock exactly the entries that were summed (an entry posted meanwhile stays for next time).
  await SellerLedgerEntry.updateMany({ _id: { $in: entries.map((e) => e._id) }, payout: null }, { $set: { payout: payout._id } });
  return payout;
}

export async function markPayoutPaid(payoutId, { method = 'bank_transfer', referenceNumber = '', note = '', actor = null } = {}) {
  const payout = await SellerPayout.findById(payoutId);
  if (!payout) throw new AppError('Payout not found', 404);
  if (payout.status !== 'pending') throw new AppError(`This payout is already ${payout.status}`, 400);
  payout.status = 'paid';
  payout.method = method;
  payout.referenceNumber = String(referenceNumber || '').trim().slice(0, 100);
  payout.note = String(note || '').trim().slice(0, 500);
  payout.paidAt = new Date();
  payout.paidBy = actor?._id || null;
  await payout.save();
  await postEntries([{
    seller: payout.seller,
    type: 'payout',
    amount: -payout.amount,
    availableAt: payout.paidAt,
    payout: payout._id,
    reference: payout.payoutNumber,
    note: payout.referenceNumber,
    createdBy: actor?._id || null,
    key: `payout:${payout._id}`,
  }]);

  const owners = await (await import('../models/User.js')).default
    .find({ seller: payout.seller, role: 'seller_owner' }).select('_id').lean();
  for (const u of owners) {
    // eslint-disable-next-line no-await-in-loop
    await createUserNotification({
      userId: u._id,
      type: 'seller_payout',
      titleAr: 'تم تحويل أرباحك',
      titleEn: 'Payout sent',
      messageAr: `حوّلنا ${payout.amount} ج.م (${payout.payoutNumber}).`,
      messageEn: `We sent you ${payout.amount} EGP (${payout.payoutNumber}).`,
      link: '/seller-center/finance',
      data: { payoutId: payout._id },
    }).catch(() => {});
  }
  return payout;
}

export async function cancelPayout(payoutId, { actor = null } = {}) {
  const payout = await SellerPayout.findById(payoutId);
  if (!payout) throw new AppError('Payout not found', 404);
  if (payout.status !== 'pending') throw new AppError('Only pending payouts can be cancelled', 400);
  payout.status = 'cancelled';
  payout.cancelledAt = new Date();
  payout.cancelledBy = actor?._id || null;
  await payout.save();
  await SellerLedgerEntry.updateMany({ payout: payout._id, type: { $ne: 'payout' } }, { $set: { payout: null } });
  return payout;
}

/** Payable balance per seller — the admin payout queue. */
export async function listSellerBalances({ now = new Date() } = {}) {
  const rows = await SellerLedgerEntry.aggregate([
    {
      $group: {
        _id: '$seller',
        available: { $sum: { $cond: [{ $and: [{ $lte: ['$availableAt', now] }, { $eq: ['$payout', null] }, { $ne: ['$type', 'payout'] }] }, '$amount', 0] } },
        pending: { $sum: { $cond: [{ $and: [{ $gt: ['$availableAt', now] }, { $eq: ['$payout', null] }] }, '$amount', 0] } },
        paidOut: { $sum: { $cond: [{ $eq: ['$type', 'payout'] }, '$amount', 0] } },
      },
    },
  ]);
  const sellers = await Seller.find({ _id: { $in: rows.map((r) => r._id) } }).select('nameAr nameEn slug status bank').lean();
  const byId = new Map(sellers.map((s) => [String(s._id), s]));
  return rows
    .map((r) => {
      const s = byId.get(String(r._id));
      return {
        seller: s ? { _id: s._id, nameAr: s.nameAr, nameEn: s.nameEn, slug: s.slug, status: s.status, hasBank: Boolean(s.bank?.accountNumber || s.bank?.iban || s.bank?.walletPhone) } : { _id: r._id },
        available: round2(r.available),
        pending: round2(r.pending),
        paidOut: -round2(r.paidOut),
      };
    })
    .sort((a, b) => b.available - a.available);
}
