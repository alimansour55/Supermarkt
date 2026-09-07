import mongoose from 'mongoose';
import PartnerPayout, { PARTNER_PAYOUT_STATUSES, PARTNER_PAYOUT_METHODS } from '../models/PartnerPayout.js';
import { AppError } from '../utils/AppError.js';
import { computePartnerRevenueDistribution, getPartnerRevenueSettings } from './partnerRevenue.service.js';

function toObjectIdOrNull(id) {
  return id && mongoose.Types.ObjectId.isValid(id) ? id : null;
}

function partnerRowKey(row) {
  if (row.userId) return String(row.userId);
  if (row.partnerId) return String(row.partnerId);
  return null;
}

export async function listPartnerPayouts(query = {}) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const skip = (page - 1) * limit;

  const filter = {};
  if (query.partnerKey) filter.partnerKey = String(query.partnerKey);
  if (query.status && PARTNER_PAYOUT_STATUSES.includes(query.status)) filter.status = query.status;
  if (query.start && query.end) {
    filter.periodStartKey = { $gte: String(query.start) };
    filter.periodEndKey = { $lte: String(query.end) };
  }
  if (query.q) {
    const regex = { $regex: String(query.q).trim(), $options: 'i' };
    filter.$or = [{ partnerNameAr: regex }, { partnerNameEn: regex }, { referenceNumber: regex }];
  }

  const [items, total] = await Promise.all([
    PartnerPayout.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('createdBy', 'name username')
      .populate('paidBy', 'name username')
      .lean(),
    PartnerPayout.countDocuments(filter),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

export async function getPartnerPayoutSummary() {
  const rows = await PartnerPayout.aggregate([
    {
      $group: {
        _id: { partnerKey: '$partnerKey', status: '$status' },
        amount: { $sum: '$amount' },
        count: { $sum: 1 },
        nameAr: { $last: '$partnerNameAr' },
        nameEn: { $last: '$partnerNameEn' },
      },
    },
  ]);

  const totals = { pending: 0, paid: 0, cancelled: 0, pendingCount: 0, paidCount: 0 };
  const byPartner = {};

  for (const row of rows) {
    const key = row._id.partnerKey;
    const status = row._id.status;
    totals[status] = (totals[status] || 0) + row.amount;
    if (status === 'pending') totals.pendingCount += row.count;
    if (status === 'paid') totals.paidCount += row.count;

    if (!byPartner[key]) {
      byPartner[key] = {
        partnerKey: key, nameAr: row.nameAr, nameEn: row.nameEn, pending: 0, paid: 0, cancelled: 0,
      };
    }
    byPartner[key][status] = (byPartner[key][status] || 0) + row.amount;
    if (row.nameAr) byPartner[key].nameAr = row.nameAr;
    if (row.nameEn) byPartner[key].nameEn = row.nameEn;
  }

  return { totals, byPartner: Object.values(byPartner) };
}

function buildPartnerSnapshot(partner) {
  return {
    partnerKey: partnerRowKey(partner),
    partnerUserId: toObjectIdOrNull(partner.userId),
    partnerNameAr: partner.nameAr || '',
    partnerNameEn: partner.nameEn || '',
    partnerEmail: partner.email || '',
    partnerPhone: partner.phone || '',
  };
}

export async function generatePayoutsFromPeriod(payload = {}, actorUser) {
  const { start, end, period, partnerKeys, skipExisting = true } = payload;
  const report = await computePartnerRevenueDistribution({ start, end, period });

  if (!report.enabled) {
    throw new AppError('Partner revenue distribution is disabled', 400);
  }
  if (!report.partners?.length) {
    throw new AppError('No active partners with computed amounts for this period', 400);
  }

  const periodStartKey = report.period?.startKey || '';
  const periodEndKey = report.period?.endKey || '';
  const selectedKeys = Array.isArray(partnerKeys) && partnerKeys.length
    ? new Set(partnerKeys.map(String))
    : null;

  const candidates = report.partners.filter((p) => {
    if (!(p.amount > 0)) return false;
    if (selectedKeys && !selectedKeys.has(partnerRowKey(p))) return false;
    return true;
  });

  if (!candidates.length) {
    throw new AppError('No partners with a positive payable amount were found', 400);
  }

  let existingKeys = new Set();
  if (skipExisting) {
    const existing = await PartnerPayout.find({
      periodStartKey,
      periodEndKey,
      partnerKey: { $in: candidates.map(partnerRowKey).filter(Boolean) },
      status: { $ne: 'cancelled' },
    }).select('partnerKey').lean();
    existingKeys = new Set(existing.map((e) => e.partnerKey));
  }

  const docs = candidates
    .filter((p) => !existingKeys.has(partnerRowKey(p)))
    .map((p) => ({
      ...buildPartnerSnapshot(p),
      periodStartKey,
      periodEndKey,
      periodLabel: report.period?.periodKey || '',
      amount: Math.round((p.amount || 0) * 100) / 100,
      sharePercent: p.sharePercent ?? null,
      distributionMode: report.summary?.mode || '',
      status: 'pending',
      source: 'generated',
      reportSnapshot: {
        attributedAmount: p.attributedAmount ?? null,
        poolAmount: p.poolAmount ?? null,
        unassignedBonus: p.unassignedBonus ?? null,
        revenueRole: p.revenueRole || null,
      },
      createdBy: toObjectIdOrNull(actorUser?._id || actorUser?.id),
    }));

  const created = docs.length ? await PartnerPayout.insertMany(docs) : [];

  return {
    created,
    skippedCount: candidates.length - docs.length,
    period: { startKey: periodStartKey, endKey: periodEndKey },
  };
}

export async function createManualPartnerPayout(payload = {}, actorUser) {
  const amount = Number(payload.amount);
  if (!(amount > 0)) throw new AppError('Amount must be greater than 0', 400);

  const nameAr = String(payload.partnerNameAr || '').trim();
  const nameEn = String(payload.partnerNameEn || '').trim();
  if (!payload.partnerKey && !nameAr && !nameEn) {
    throw new AppError('Select a partner or provide a partner name', 400);
  }

  let partnerSnapshot = {
    partnerKey: payload.partnerKey ? String(payload.partnerKey) : null,
    partnerUserId: toObjectIdOrNull(payload.partnerUserId),
    partnerNameAr: nameAr,
    partnerNameEn: nameEn,
    partnerEmail: String(payload.partnerEmail || '').trim(),
    partnerPhone: String(payload.partnerPhone || '').trim(),
  };

  if (payload.partnerKey) {
    const { settings } = await getPartnerRevenueSettings();
    const match = (settings.partners || []).find((p) => {
      const key = p.userId ? String(p.userId) : String(p._id || '');
      return key === String(payload.partnerKey);
    });
    if (match) {
      partnerSnapshot = { ...buildPartnerSnapshot(match), ...partnerSnapshot };
      partnerSnapshot.partnerKey = String(payload.partnerKey);
    } else if (!partnerSnapshot.partnerKey) {
      partnerSnapshot.partnerKey = `manual-${new mongoose.Types.ObjectId()}`;
    }
  } else {
    partnerSnapshot.partnerKey = `manual-${new mongoose.Types.ObjectId()}`;
  }

  const doc = await PartnerPayout.create({
    ...partnerSnapshot,
    periodStartKey: payload.periodStartKey || '',
    periodEndKey: payload.periodEndKey || '',
    periodLabel: payload.periodLabel || '',
    amount: Math.round(amount * 100) / 100,
    currency: payload.currency || 'EGP',
    status: 'pending',
    source: 'manual',
    notes: String(payload.notes || '').trim(),
    createdBy: toObjectIdOrNull(actorUser?._id || actorUser?.id),
  });

  return doc.toObject();
}

export async function updatePartnerPayout(id, payload = {}) {
  const payout = await PartnerPayout.findById(id);
  if (!payout) throw new AppError('Payout not found', 404);
  if (payout.status !== 'pending') {
    throw new AppError('Only pending payouts can be edited', 400);
  }

  if (payload.amount != null) {
    const amount = Number(payload.amount);
    if (!(amount > 0)) throw new AppError('Amount must be greater than 0', 400);
    payout.amount = Math.round(amount * 100) / 100;
  }
  if (payload.notes != null) payout.notes = String(payload.notes).trim();
  if (payload.referenceNumber != null) payout.referenceNumber = String(payload.referenceNumber).trim();
  if (payload.paymentMethod != null) {
    if (payload.paymentMethod && !PARTNER_PAYOUT_METHODS.includes(payload.paymentMethod)) {
      throw new AppError('Invalid payment method', 400);
    }
    payout.paymentMethod = payload.paymentMethod;
  }

  await payout.save();
  return payout.toObject();
}

export async function setPartnerPayoutStatus(id, payload = {}, actorUser) {
  const { status } = payload;
  if (!PARTNER_PAYOUT_STATUSES.includes(status)) {
    throw new AppError('Invalid status', 400);
  }

  const payout = await PartnerPayout.findById(id);
  if (!payout) throw new AppError('Payout not found', 404);

  if (status === 'paid') {
    if (payout.status === 'cancelled') throw new AppError('Cannot mark a cancelled payout as paid', 400);
    payout.status = 'paid';
    payout.paidAt = new Date();
    payout.paidBy = toObjectIdOrNull(actorUser?._id || actorUser?.id);
    if (payload.paymentMethod != null) {
      if (payload.paymentMethod && !PARTNER_PAYOUT_METHODS.includes(payload.paymentMethod)) {
        throw new AppError('Invalid payment method', 400);
      }
      payout.paymentMethod = payload.paymentMethod;
    }
    if (payload.referenceNumber != null) payout.referenceNumber = String(payload.referenceNumber).trim();
    if (payload.notes != null) payout.notes = String(payload.notes).trim();
  } else if (status === 'cancelled') {
    if (payout.status === 'paid') throw new AppError('Cannot cancel a paid payout — contact finance to reverse it', 400);
    payout.status = 'cancelled';
    payout.cancelledAt = new Date();
    payout.cancelledBy = toObjectIdOrNull(actorUser?._id || actorUser?.id);
    if (payload.notes != null) payout.notes = String(payload.notes).trim();
  } else {
    payout.status = 'pending';
    payout.paidAt = null;
    payout.paidBy = null;
    payout.cancelledAt = null;
    payout.cancelledBy = null;
  }

  await payout.save();
  return payout.toObject();
}

export async function deletePartnerPayout(id) {
  const payout = await PartnerPayout.findById(id);
  if (!payout) throw new AppError('Payout not found', 404);
  if (payout.status === 'paid') {
    throw new AppError('Cannot delete a paid payout — cancel new ones instead of removing history', 400);
  }
  await payout.deleteOne();
  return { deleted: true };
}
