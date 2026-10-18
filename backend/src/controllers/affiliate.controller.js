import mongoose from 'mongoose';
import Affiliate from '../models/Affiliate.js';
import AffiliateCommission from '../models/AffiliateCommission.js';
import User from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { logAudit } from '../services/auditLog.service.js';
import {
  affiliateStats,
  cancelCommissionByAdmin,
  changeAffiliateCode,
  getAffiliatePointValue,
  getAffiliateSettings,
  joinAffiliateProgram,
  recordAffiliateClick,
  releaseCommissionNow,
  saveAffiliateSettings,
} from '../services/affiliate.service.js';
import {
  AFFILIATE_CALC_TYPES,
  AFFILIATE_STATUSES,
  COMMISSION_STATUSES,
  describeAffiliateReward,
  effectiveAffiliateRate,
} from '../utils/affiliateRules.js';

const langOf = (req) => (String(req.query.lang || req.body?.lang || 'ar') === 'en' ? 'en' : 'ar');
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const emptyStats = () => ({
  orders: 0, sales: 0, pendingReward: 0, holdingReward: 0, paidReward: 0, paidCash: 0, cancelledOrders: 0,
});

function codeError(err, lang) {
  if (err?.code === 'invalid_code') {
    return new AppError(
      lang === 'ar'
        ? 'الكود من 4 إلى 20 حرفاً إنجليزياً أو رقماً (مسموح - و _)'
        : 'Use 4–20 English letters or numbers (- and _ allowed)',
      400,
    );
  }
  if (err?.code === 'code_taken') {
    return new AppError(lang === 'ar' ? 'هذا الكود مستخدم — جرّب كوداً آخر' : 'That code is taken — try another one', 409);
  }
  return err;
}

const formatCommission = (c, { forOwner = false } = {}) => ({
  id: String(c._id),
  status: c.status,
  rewardType: c.rewardType,
  rewardAmount: c.rewardAmount,
  cashValue: c.cashValue,
  baseAmount: c.baseAmount,
  // The link owner never sees who bought or the order number — only that a sale happened.
  ...(forOwner ? {} : {
    orderId: c.order ? String(c.order._id || c.order) : null,
    orderNumber: c.orderNumber,
    code: c.code,
    rateLabel: c.rateLabel,
    note: c.note,
    clawbackFailed: c.clawbackFailed === true,
    owner: c.owner?._id ? { id: String(c.owner._id), name: c.owner.name, phone: c.owner.phone } : null,
    buyer: c.buyer?._id ? { id: String(c.buyer._id), name: c.buyer.name } : null,
  }),
  holdUntil: c.holdUntil,
  paidAt: c.paidAt,
  createdAt: c.createdAt,
});

// ── Public ──────────────────────────────────────────────────────────────

export const trackAffiliateClick = asyncHandler(async (req, res) => {
  const result = await recordAffiliateClick(req.body?.code);
  res.json({ success: true, ...result });
});

export const getAffiliateProgram = asyncHandler(async (req, res) => {
  const settings = await getAffiliateSettings();
  res.set('Cache-Control', 'public, max-age=60');
  res.json({ success: true, data: { enabled: settings.enabled } });
});

// ── Customer ────────────────────────────────────────────────────────────

export const getMyAffiliate = asyncHandler(async (req, res) => {
  const lang = langOf(req);
  const [settings, pointValue, affiliate] = await Promise.all([
    getAffiliateSettings(),
    getAffiliatePointValue(),
    Affiliate.findOne({ user: req.user._id }).lean(),
  ]);

  let stats = emptyStats();
  let commissions = [];
  if (affiliate) {
    const [all, recent] = await Promise.all([
      affiliateStats([affiliate._id]),
      AffiliateCommission.find({ affiliate: affiliate._id }).sort({ createdAt: -1 }).limit(30).lean(),
    ]);
    stats = all[String(affiliate._id)] || stats;
    commissions = recent.map((c) => formatCommission(c, { forOwner: true }));
  }

  res.json({
    success: true,
    data: {
      program: {
        enabled: settings.enabled,
        joinMode: settings.joinMode,
        rewardType: settings.rewardType,
        attributionDays: settings.attributionDays,
        holdDays: settings.holdDays,
        minOrderTotal: settings.minOrderTotal,
        newCustomersOnly: settings.newCustomersOnly,
        description: describeAffiliateReward(settings, { lang, affiliate, pointValueEGP: pointValue }),
        terms: lang === 'ar' ? settings.termsAr : settings.termsEn,
      },
      affiliate: affiliate
        ? { code: affiliate.code, status: affiliate.status, clicks: affiliate.clicks || 0, createdAt: affiliate.createdAt }
        : null,
      stats,
      commissions,
    },
  });
});

export const joinMyAffiliate = asyncHandler(async (req, res) => {
  const lang = langOf(req);
  const settings = await getAffiliateSettings();
  if (!settings.enabled) {
    throw new AppError(lang === 'ar' ? 'برنامج شارك واكسب غير متاح حالياً' : 'Share & earn is not available right now', 400);
  }
  const affiliate = await joinAffiliateProgram(req.user._id);
  res.status(201).json({ success: true, data: { code: affiliate.code, status: affiliate.status } });
});

export const updateMyAffiliate = asyncHandler(async (req, res) => {
  const lang = langOf(req);
  const affiliate = await Affiliate.findOne({ user: req.user._id });
  if (!affiliate) throw new AppError(lang === 'ar' ? 'انضم للبرنامج أولاً' : 'Join the program first', 404);
  if (['blocked', 'rejected'].includes(affiliate.status)) {
    throw new AppError(lang === 'ar' ? 'لا يمكن تعديل هذا الرابط' : 'This link can’t be changed', 403);
  }
  if (req.body?.code !== undefined) {
    try {
      await changeAffiliateCode(affiliate, req.body.code);
    } catch (err) {
      throw codeError(err, lang);
    }
  }
  res.json({ success: true, data: { code: affiliate.code, status: affiliate.status } });
});

// ── Admin ───────────────────────────────────────────────────────────────

export const getAdminAffiliateSettings = asyncHandler(async (req, res) => {
  const [settings, pointValue] = await Promise.all([getAffiliateSettings(), getAffiliatePointValue()]);
  res.json({ success: true, data: settings, pointValueEGP: pointValue });
});

export const updateAdminAffiliateSettings = asyncHandler(async (req, res) => {
  const before = await getAffiliateSettings();
  const next = await saveAffiliateSettings(req.body || {});
  const changes = {};
  Object.keys(next).forEach((key) => {
    if (String(before[key]) !== String(next[key])) changes[key] = { from: before[key], to: next[key] };
  });
  if (Object.keys(changes).length) {
    await logAudit({
      req, action: 'update', entityType: 'affiliate_settings', entityLabel: 'Share & earn', changes,
    });
  }
  res.json({ success: true, data: next });
});

export const getAdminAffiliateOverview = asyncHandler(async (req, res) => {
  const [statusCounts, commissionTotals, clicks, top, clawbacks] = await Promise.all([
    Affiliate.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    AffiliateCommission.aggregate([
      {
        $group: {
          _id: { status: '$status', type: '$rewardType' },
          count: { $sum: 1 },
          reward: { $sum: '$rewardAmount' },
          cash: { $sum: '$cashValue' },
          sales: { $sum: '$baseAmount' },
        },
      },
    ]),
    Affiliate.aggregate([{ $group: { _id: null, clicks: { $sum: '$clicks' } } }]),
    AffiliateCommission.aggregate([
      { $match: { status: { $in: ['pending', 'holding', 'paid'] } } },
      { $group: { _id: '$affiliate', orders: { $sum: 1 }, sales: { $sum: '$baseAmount' }, cash: { $sum: '$cashValue' } } },
      { $sort: { sales: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'affiliates', localField: '_id', foreignField: '_id', as: 'affiliate' } },
      { $unwind: '$affiliate' },
      { $lookup: { from: 'users', localField: 'affiliate.user', foreignField: '_id', as: 'user' } },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      { $project: { orders: 1, sales: 1, cash: 1, code: '$affiliate.code', name: '$user.name', id: '$affiliate._id' } },
    ]),
    AffiliateCommission.countDocuments({ clawbackFailed: true }),
  ]);

  const affiliates = Object.fromEntries(AFFILIATE_STATUSES.map((s) => [s, 0]));
  statusCounts.forEach((r) => { affiliates[r._id] = r.count; });
  const byStatus = Object.fromEntries(COMMISSION_STATUSES.map((s) => [s, { count: 0, cash: 0, sales: 0 }]));
  commissionTotals.forEach((r) => {
    const s = byStatus[r._id.status];
    if (!s) return;
    s.count += r.count;
    s.cash += r.cash;
    s.sales += r.sales;
  });
  const r2 = (n) => Math.round(n * 100) / 100;
  Object.values(byStatus).forEach((s) => { s.cash = r2(s.cash); s.sales = r2(s.sales); });

  res.json({
    success: true,
    data: {
      affiliates,
      commissions: byStatus,
      clicks: clicks[0]?.clicks || 0,
      clawbackFailed: clawbacks,
      topAffiliates: top.map((t) => ({
        id: String(t.id), code: t.code, name: t.name || '', orders: t.orders, sales: r2(t.sales), cash: r2(t.cash),
      })),
    },
  });
});

export const listAdminAffiliates = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const filter = {};
  if (AFFILIATE_STATUSES.includes(req.query.status)) filter.status = req.query.status;

  const q = String(req.query.search || '').trim();
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    const users = await User.find({ $or: [{ name: rx }, { phone: rx }, { email: rx }] }).select('_id').limit(200).lean();
    filter.$or = [{ code: new RegExp(escapeRegex(q.toUpperCase()), 'i') }, { user: { $in: users.map((u) => u._id) } }];
  }

  const [rows, total, settings] = await Promise.all([
    Affiliate.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('user', 'name phone email')
      .lean(),
    Affiliate.countDocuments(filter),
    getAffiliateSettings(),
  ]);
  const stats = await affiliateStats(rows.map((r) => r._id));

  res.json({
    success: true,
    data: rows.map((a) => {
      const rate = effectiveAffiliateRate(settings, a);
      return {
        id: String(a._id),
        code: a.code,
        status: a.status,
        clicks: a.clicks || 0,
        lastClickAt: a.lastClickAt,
        createdAt: a.createdAt,
        adminNote: a.adminNote || '',
        customCalcType: a.customCalcType || null,
        customPercent: a.customPercent ?? null,
        customFixedAmount: a.customFixedAmount ?? null,
        rate,
        user: a.user ? { id: String(a.user._id), name: a.user.name, phone: a.user.phone, email: a.user.email } : null,
        stats: stats[String(a._id)] || emptyStats(),
      };
    }),
    pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
  });
});

export const updateAdminAffiliate = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new AppError('Link not found', 404);
  const affiliate = await Affiliate.findById(req.params.id);
  if (!affiliate) throw new AppError('Link not found', 404);
  const before = affiliate.toObject();
  const body = req.body || {};

  if (body.status !== undefined) {
    if (!AFFILIATE_STATUSES.includes(body.status)) throw new AppError('Invalid status', 400);
    if (body.status !== affiliate.status) {
      affiliate.status = body.status;
      affiliate.statusChangedAt = new Date();
    }
  }
  if (body.customCalcType !== undefined) {
    if (body.customCalcType === null || body.customCalcType === '') {
      affiliate.customCalcType = null;
      affiliate.customPercent = null;
      affiliate.customFixedAmount = null;
    } else {
      if (!AFFILIATE_CALC_TYPES.includes(body.customCalcType)) throw new AppError('Invalid reward type', 400);
      affiliate.customCalcType = body.customCalcType;
      const pct = Number(body.customPercent);
      const fixed = Number(body.customFixedAmount);
      affiliate.customPercent = Number.isFinite(pct) ? Math.min(100, Math.max(0, pct)) : null;
      affiliate.customFixedAmount = Number.isFinite(fixed) ? Math.max(0, fixed) : null;
    }
  }
  if (body.adminNote !== undefined) affiliate.adminNote = String(body.adminNote || '').slice(0, 1000);
  if (body.code !== undefined) {
    try {
      await changeAffiliateCode(affiliate, body.code);
    } catch (err) {
      throw codeError(err, 'en');
    }
  }
  await affiliate.save();

  const changes = {};
  ['status', 'code', 'customCalcType', 'customPercent', 'customFixedAmount', 'adminNote'].forEach((k) => {
    if (String(before[k] ?? '') !== String(affiliate[k] ?? '')) changes[k] = { from: before[k] ?? null, to: affiliate[k] ?? null };
  });
  if (Object.keys(changes).length) {
    await logAudit({
      req,
      action: changes.status ? 'status_change' : 'update',
      entityType: 'affiliate',
      entityId: affiliate._id,
      entityLabel: affiliate.code,
      changes,
    });
  }
  res.json({ success: true, data: { id: String(affiliate._id), code: affiliate.code, status: affiliate.status } });
});

export const listAdminCommissions = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const filter = {};
  if (COMMISSION_STATUSES.includes(req.query.status)) filter.status = req.query.status;
  if (req.query.affiliate && mongoose.isValidObjectId(req.query.affiliate)) {
    filter.affiliate = new mongoose.Types.ObjectId(String(req.query.affiliate));
  }
  if (req.query.clawbackFailed === 'true') filter.clawbackFailed = true;
  const q = String(req.query.search || '').trim();
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ orderNumber: rx }, { code: rx }];
  }

  const [rows, total] = await Promise.all([
    AffiliateCommission.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('owner', 'name phone')
      .populate('buyer', 'name')
      .lean(),
    AffiliateCommission.countDocuments(filter),
  ]);
  res.json({
    success: true,
    data: rows.map((c) => formatCommission(c)),
    pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
  });
});

export const cancelAdminCommission = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new AppError('Reward not found', 404);
  const note = String(req.body?.reason || '').trim().slice(0, 500);
  const commission = await cancelCommissionByAdmin(req.params.id, note);
  if (!commission) throw new AppError('This reward can’t be cancelled', 400);
  await logAudit({
    req,
    action: 'status_change',
    entityType: 'affiliate_commission',
    entityId: commission._id,
    entityLabel: commission.orderNumber,
    changes: { status: { to: commission.status }, note },
  });
  res.json({ success: true, data: formatCommission(commission) });
});

export const releaseAdminCommission = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new AppError('Reward not found', 404);
  const commission = await releaseCommissionNow(req.params.id);
  if (!commission) throw new AppError('Only rewards waiting for the return window can be paid now', 400);
  await logAudit({
    req,
    action: 'approve',
    entityType: 'affiliate_commission',
    entityId: commission._id,
    entityLabel: commission.orderNumber,
    changes: { status: { from: 'holding', to: 'paid' } },
  });
  res.json({ success: true, data: formatCommission(commission) });
});
