import mongoose from 'mongoose';
import User from '../models/User.js';
import Order from '../models/Order.js';
import StoreSettings from '../models/StoreSettings.js';
import { AppError } from '../utils/AppError.js';
import { getLoyaltySettings, normalizeLoyaltySettings } from '../services/loyalty.service.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const formatHistory = (entry, { egpPerPoint = 0, orderNumbers = new Map() } = {}) => {
  const orderId = entry.order ? String(entry.order) : null;
  return {
    id: entry._id,
    type: entry.type,
    points: entry.points,
    cashValue: Math.round(Math.abs(entry.points || 0) * egpPerPoint * 100) / 100,
    orderId,
    orderNumber: orderId ? orderNumbers.get(orderId) || null : null,
    note: entry.note || '',
    adjustedBy: entry.adjustedBy,
    expiresAt: entry.expiresAt || null,
    createdAt: entry.createdAt || null,
  };
};

const LOYALTY_RULE_FIELDS = [
  'enabled',
  'earnPointsPerEGP',
  'redemptionEGPPerPoint',
  'expiryDays',
  'minOrderToEarn',
  'minRedeemPoints',
  'maxRedeemPercent',
];

const parseRuleUpdate = (payload = {}) => {
  const update = {};

  for (const field of LOYALTY_RULE_FIELDS) {
    if (payload[field] === undefined) continue;

    if (field === 'enabled') {
      if (typeof payload[field] !== 'boolean') {
        throw new AppError('enabled must be a boolean', 400);
      }
      update[field] = payload[field];
      continue;
    }

    const value = Number(payload[field]);
    if (!Number.isFinite(value) || value < 0) {
      throw new AppError(`${field} must be a non-negative number`, 400);
    }
    if (field === 'maxRedeemPercent' && value > 100) {
      throw new AppError('maxRedeemPercent cannot exceed 100', 400);
    }
    update[field] = value;
  }

  if (Object.keys(update).length === 0) {
    throw new AppError('Provide at least one loyalty rule to update', 400);
  }
  if (update.enabled !== false && update.redemptionEGPPerPoint === 0) {
    throw new AppError('redemptionEGPPerPoint must be greater than zero while loyalty is enabled', 400);
  }

  return update;
};

export const getAdminLoyaltyRules = asyncHandler(async (_req, res) => {
  const settings = await StoreSettings.findOne({ key: 'main' }).select('loyalty');
  res.json({ success: true, data: normalizeLoyaltySettings(settings?.loyalty) });
});

export const updateAdminLoyaltyRules = asyncHandler(async (req, res) => {
  const changes = parseRuleUpdate(req.body);
  const settings = await StoreSettings.findOneAndUpdate(
    { key: 'main' },
    { $setOnInsert: { key: 'main' } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  settings.loyalty = normalizeLoyaltySettings({ ...settings.loyalty?.toObject?.() || settings.loyalty, ...changes });
  await settings.save();
  res.json({ success: true, data: settings.loyalty });
});

export const searchAdminLoyaltyUsers = asyncHandler(async (req, res) => {
  const q = String(req.query.search || '').trim();
  const page = Math.max(1, Math.trunc(Number(req.query.page) || 1));
  const limit = Math.min(50, Math.max(1, Math.trunc(Number(req.query.limit) || 20)));
  const filter = q
    ? {
      $or: [
        { phone: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
        { email: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
        { name: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
      ],
    }
    : {};

  const [users, total] = await Promise.all([
    User.find(filter)
    .select('name phone email pointsBalance role')
    .sort({ pointsBalance: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean(),
    User.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: users.map((u) => ({
      _id: u._id,
      name: u.name,
      phone: u.phone,
      email: u.email,
      pointsBalance: u.pointsBalance || 0,
      role: u.role,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  });
});

export const getAdminLoyaltyOverview = asyncHandler(async (_req, res) => {
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const [customerCount, balances, movement] = await Promise.all([
    User.countDocuments({ role: 'user' }),
    User.aggregate([
      { $match: { role: 'user' } },
      { $group: { _id: null, pointsBalance: { $sum: '$pointsBalance' }, customersWithPoints: { $sum: { $cond: [{ $gt: ['$pointsBalance', 0] }, 1, 0] } } } },
    ]),
    User.aggregate([
      { $match: { role: 'user' } },
      { $unwind: '$pointsHistory' },
      { $match: { 'pointsHistory.createdAt': { $gte: since } } },
      {
        $group: {
          _id: '$pointsHistory.type',
          points: { $sum: '$pointsHistory.points' },
          entries: { $sum: 1 },
        },
      },
    ]),
  ]);

  const movementByType = Object.fromEntries(movement.map((item) => [item._id, {
    points: item.points,
    entries: item.entries,
  }]));
  const balanceSummary = balances[0] || { pointsBalance: 0, customersWithPoints: 0 };

  res.json({
    success: true,
    data: {
      customerCount,
      pointsBalance: balanceSummary.pointsBalance,
      customersWithPoints: balanceSummary.customersWithPoints,
      movementLast30Days: movementByType,
    },
  });
});

export const getAdminUserLoyalty = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.userId).select('name phone email pointsBalance pointsHistory role');
  if (!user) throw new AppError('User not found', 404);

  const rules = await getLoyaltySettings();
  const egpPerPoint = Number(rules.redemptionEGPPerPoint || 0);

  const raw = [...(user.pointsHistory || [])]
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 50);

  const orderIds = [...new Set(
    raw.map((e) => e.order).filter(Boolean).map(String).filter((id) => mongoose.Types.ObjectId.isValid(id)),
  )];
  const orderNumbers = new Map();
  if (orderIds.length) {
    try {
      const orders = await Order.find({ _id: { $in: orderIds } }).select('orderNumber').lean();
      orders.forEach((o) => orderNumbers.set(String(o._id), o.orderNumber));
    } catch {
      /* cosmetic */
    }
  }

  const history = raw.map((e) => formatHistory(e, { egpPerPoint, orderNumbers }));

  res.json({
    success: true,
    data: {
      user: {
        _id: user._id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        pointsBalance: user.pointsBalance || 0,
        role: user.role,
      },
      history,
    },
  });
});

export const adjustAdminUserPoints = asyncHandler(async (req, res) => {
  const points = Math.trunc(Number(req.body.points));
  const note = String(req.body.note || '').trim();

  if (!points || Number.isNaN(points) || Math.abs(points) > 1000000) {
    throw new AppError('points must be a non-zero whole number within ±1,000,000', 400);
  }
  if (note.length < 3 || note.length > 240) {
    throw new AppError('A reason between 3 and 240 characters is required', 400);
  }

  const filter = {
    _id: req.params.userId,
    ...(points < 0 ? { pointsBalance: { $gte: Math.abs(points) } } : {}),
  };
  const user = await User.findOneAndUpdate(
    filter,
    {
      $inc: { pointsBalance: points },
      $push: {
        pointsHistory: {
          type: 'adjust',
          points,
          note,
          adjustedBy: req.user._id,
        },
      },
    },
    { new: true, runValidators: true },
  );

  if (!user) {
    const exists = await User.exists({ _id: req.params.userId });
    throw new AppError(exists ? 'Insufficient points balance' : 'User not found', exists ? 400 : 404);
  }

  res.json({
    success: true,
    data: {
      pointsBalance: user.pointsBalance,
      adjustment: points,
    },
  });
});
