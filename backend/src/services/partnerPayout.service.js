import mongoose from 'mongoose';
import PartnerPayout, { PARTNER_PAYOUT_STATUSES, PARTNER_PAYOUT_METHODS } from '../models/PartnerPayout.js';
import PartnerLedgerEntry, { PARTNER_LEDGER_SIGN } from '../models/PartnerLedgerEntry.js';
import { AppError } from '../utils/AppError.js';
import { computePartnerRevenueDistribution, getPartnerRevenueSettings } from './partnerRevenue.service.js';
import { partnerKeyOf } from '../constants/partnerRevenueDefaults.js';

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
  const {
    start, end, period, partnerKeys, skipExisting = true, applyLedger = true, applyThresholds = true,
  } = payload;
  const [report, { settings }] = await Promise.all([
    computePartnerRevenueDistribution({ start, end, period }),
    getPartnerRevenueSettings(),
  ]);

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

  const partnerConfig = {};
  for (const p of settings.partners || []) {
    const key = partnerKeyOf(p);
    if (key) partnerConfig[key] = p;
  }

  // In-period ledger net per partner.
  let ledgerByPartner = {};
  if (applyLedger && periodStartKey && periodEndKey) {
    const rows = await PartnerLedgerEntry.aggregate([
      {
        $match: {
          dateKey: { $gte: periodStartKey, $lte: periodEndKey },
          partnerKey: { $in: report.partners.map(partnerRowKey).filter(Boolean) },
        },
      },
      { $group: { _id: { partnerKey: '$partnerKey', type: '$type' }, amount: { $sum: '$amount' } } },
    ]);
    for (const row of rows) {
      const signed = (PARTNER_LEDGER_SIGN[row._id.type] || 1) * (row.amount || 0);
      ledgerByPartner[row._id.partnerKey] = (ledgerByPartner[row._id.partnerKey] || 0) + signed;
    }
  }

  const candidates = report.partners.filter((p) => {
    if (selectedKeys && !selectedKeys.has(partnerRowKey(p))) return false;
    return (p.amount || 0) > 0 || (ledgerByPartner[partnerRowKey(p)] || 0) !== 0;
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

  const skipped = [];
  const docs = [];
  for (const p of candidates) {
    const key = partnerRowKey(p);
    if (existingKeys.has(key)) {
      skipped.push({ partnerKey: key, name: p.nameEn || p.nameAr, reason: 'already_generated' });
      continue;
    }
    const cfg = partnerConfig[key] || {};
    const gross = Math.round((p.amount || 0) * 100) / 100;
    const ledgerAdjustment = applyLedger ? Math.round((ledgerByPartner[key] || 0) * 100) / 100 : 0;
    let net = Math.round((gross + ledgerAdjustment) * 100) / 100;
    let carryForward = 0;

    if (applyThresholds && cfg.maxMonthlyPayout != null && net > cfg.maxMonthlyPayout) {
      carryForward = Math.round((net - cfg.maxMonthlyPayout) * 100) / 100;
      net = cfg.maxMonthlyPayout;
    }
    if (applyThresholds && cfg.minPayoutThreshold && net < cfg.minPayoutThreshold) {
      skipped.push({
        partnerKey: key, name: p.nameEn || p.nameAr, reason: 'below_threshold', net, threshold: cfg.minPayoutThreshold,
      });
      continue;
    }
    if (net <= 0) {
      skipped.push({ partnerKey: key, name: p.nameEn || p.nameAr, reason: 'non_positive_net', net });
      continue;
    }

    docs.push({
      ...buildPartnerSnapshot(p),
      periodStartKey,
      periodEndKey,
      periodLabel: report.period?.periodKey || '',
      amount: net,
      grossAmount: gross,
      ledgerAdjustment,
      carryForward,
      currency: cfg.payoutCurrency || 'EGP',
      paymentMethod: cfg.payoutMethod || '',
      sharePercent: p.sharePercent ?? null,
      distributionMode: report.summary?.mode || '',
      status: 'pending',
      source: 'generated',
      bankSnapshot: cfg.bank || null,
      reportSnapshot: {
        attributedAmount: p.attributedAmount ?? null,
        poolAmount: p.poolAmount ?? null,
        unassignedBonus: p.unassignedBonus ?? null,
        revenueRole: p.revenueRole || null,
        engine: report.attributionSummary?.engine || null,
      },
      notes: carryForward > 0
        ? `Capped at monthly max; ${carryForward.toFixed(2)} carried forward.`
        : '',
      createdBy: toObjectIdOrNull(actorUser?._id || actorUser?.id),
    });
  }

  const created = docs.length ? await PartnerPayout.insertMany(docs) : [];

  return {
    created,
    skipped,
    skippedCount: skipped.length,
    period: { startKey: periodStartKey, endKey: periodEndKey },
  };
}

/** Rows for a bank-transfer batch file. */
export async function buildPayoutBatchRows(query = {}) {
  const filter = { status: query.status && PARTNER_PAYOUT_STATUSES.includes(query.status) ? query.status : 'pending' };
  if (query.start && query.end) {
    filter.periodStartKey = { $gte: String(query.start) };
    filter.periodEndKey = { $lte: String(query.end) };
  }
  const items = await PartnerPayout.find(filter).sort({ createdAt: -1 }).limit(1000).lean();
  return items.map((p) => ({
    partner: p.partnerNameEn || p.partnerNameAr || p.partnerKey,
    method: p.paymentMethod || '',
    bankName: p.bankSnapshot?.bankName || '',
    accountHolder: p.bankSnapshot?.accountHolder || '',
    iban: p.bankSnapshot?.iban || '',
    accountNumber: p.bankSnapshot?.accountNumber || '',
    amount: p.amount,
    currency: p.currency || 'EGP',
    period: `${p.periodStartKey}..${p.periodEndKey}`,
    reference: p.referenceNumber || String(p._id),
    status: p.status,
  }));
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
