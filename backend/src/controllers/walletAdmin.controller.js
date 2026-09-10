import mongoose from 'mongoose';
import { asyncHandler } from '../middleware/errorHandler.js';
import { AppError } from '../utils/AppError.js';
import User from '../models/User.js';
import Order from '../models/Order.js';
import StoreSettings from '../models/StoreSettings.js';
import WalletTransaction from '../models/WalletTransaction.js';
import WalletTopUpRequest from '../models/WalletTopUpRequest.js';
import { logAudit } from '../services/auditLog.service.js';
import { createUserNotification } from '../services/userNotification.service.js';
import {
  normalizeWalletSettings,
  creditWallet,
  applyWalletMovement,
} from '../services/wallet.service.js';
import { formatTransaction, formatTopUpRequest } from './wallet.controller.js';

const escapeRx = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* ------------------------------- settings ------------------------------- */

const WALLET_FIELDS = [
  'enabled', 'allowTopUp', 'allowCheckoutSpend',
  'minTopUp', 'maxTopUp', 'maxBalance', 'maxCheckoutPercent',
];

const parseSettingsUpdate = (payload = {}) => {
  const update = {};
  for (const field of WALLET_FIELDS) {
    if (payload[field] === undefined) continue;
    if (['enabled', 'allowTopUp', 'allowCheckoutSpend'].includes(field)) {
      if (typeof payload[field] !== 'boolean') throw new AppError(`${field} must be a boolean`, 400);
      update[field] = payload[field];
      continue;
    }
    const value = Number(payload[field]);
    if (!Number.isFinite(value) || value < 0) throw new AppError(`${field} must be a non-negative number`, 400);
    if (field === 'maxCheckoutPercent' && value > 100) throw new AppError('maxCheckoutPercent cannot exceed 100', 400);
    update[field] = value;
  }
  if (!Object.keys(update).length) throw new AppError('Provide at least one wallet setting to update', 400);
  if ((update.minTopUp ?? 0) && (update.maxTopUp ?? Infinity) && update.minTopUp > update.maxTopUp) {
    throw new AppError('minTopUp cannot be greater than maxTopUp', 400);
  }
  return update;
};

export const getAdminWalletSettings = asyncHandler(async (_req, res) => {
  const settings = await StoreSettings.findOne({ key: 'main' }).select('wallet');
  res.json({ success: true, data: normalizeWalletSettings(settings?.wallet) });
});

export const updateAdminWalletSettings = asyncHandler(async (req, res) => {
  const changes = parseSettingsUpdate(req.body);
  const settings = await StoreSettings.findOneAndUpdate(
    { key: 'main' },
    { $setOnInsert: { key: 'main' } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  settings.wallet = normalizeWalletSettings({
    ...(settings.wallet?.toObject?.() || settings.wallet),
    ...changes,
  });
  await settings.save();
  await logAudit({
    req, action: 'update', entityType: 'store_settings', entityId: settings._id,
    entityLabel: 'wallet', changes,
  });
  res.json({ success: true, data: settings.wallet });
});

/* ------------------------------- overview ------------------------------- */

export const getAdminWalletOverview = asyncHandler(async (_req, res) => {
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const [customerCount, balances, movement, pendingTopUps] = await Promise.all([
    User.countDocuments({ role: 'user' }),
    User.aggregate([
      { $match: { role: 'user' } },
      {
        $group: {
          _id: null,
          walletBalance: { $sum: '$walletBalance' },
          customersWithBalance: { $sum: { $cond: [{ $gt: ['$walletBalance', 0] }, 1, 0] } },
        },
      },
    ]),
    WalletTransaction.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: '$type', amount: { $sum: '$amount' }, entries: { $sum: 1 } } },
    ]),
    WalletTopUpRequest.countDocuments({ status: 'pending' }),
  ]);

  const movementByType = Object.fromEntries(movement.map((m) => [m._id, { amount: m.amount, entries: m.entries }]));
  const summary = balances[0] || { walletBalance: 0, customersWithBalance: 0 };

  res.json({
    success: true,
    data: {
      customerCount,
      walletBalance: Math.round((summary.walletBalance || 0) * 100) / 100,
      customersWithBalance: summary.customersWithBalance || 0,
      pendingTopUps,
      movementLast30Days: movementByType,
    },
  });
});

/* ------------------------------ top-ups ------------------------------ */

const populateTopUp = (q) => q.populate('user', 'name phone email').populate('reviewedBy', 'name');

const formatAdminTopUp = (r) => ({
  ...formatTopUpRequest(r),
  proofPublicId: r.proofPublicId || '',
  user: r.user
    ? { _id: r.user._id, name: r.user.name, phone: r.user.phone, email: r.user.email }
    : null,
  reviewedBy: r.reviewedBy ? { _id: r.reviewedBy._id, name: r.reviewedBy.name } : null,
});

export const listAdminTopUps = asyncHandler(async (req, res) => {
  const status = ['pending', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : 'pending';
  const page = Math.max(1, Math.trunc(Number(req.query.page) || 1));
  const limit = Math.min(50, Math.max(1, Math.trunc(Number(req.query.limit) || 20)));

  const [items, total] = await Promise.all([
    populateTopUp(WalletTopUpRequest.find({ status }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit)),
    WalletTopUpRequest.countDocuments({ status }),
  ]);

  res.json({
    success: true,
    data: items.map(formatAdminTopUp),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  });
});

export const approveAdminTopUp = asyncHandler(async (req, res) => {
  const topUp = await WalletTopUpRequest.findById(req.params.id);
  if (!topUp) throw new AppError('Top-up request not found', 404);
  if (topUp.status !== 'pending') throw new AppError('This request was already processed', 400);

  const note = String(req.body.note || '').trim();

  const result = await creditWallet({
    userId: topUp.user,
    amount: topUp.amount,
    type: 'topup',
    method: topUp.method,
    topUpRequest: topUp._id,
    note: note || `Top-up via ${topUp.method}`,
    createdBy: req.user._id,
  });
  if (!result) throw new AppError('Could not credit the wallet — customer not found', 404);

  topUp.status = 'approved';
  topUp.reviewedBy = req.user._id;
  topUp.reviewedAt = new Date();
  topUp.adminNote = note;
  topUp.walletTransaction = result.transaction._id;
  await topUp.save();

  await logAudit({
    req, action: 'approve', entityType: 'wallet_topup', entityId: topUp._id,
    entityLabel: `${topUp.amount} EGP`, changes: { status: 'approved', amount: topUp.amount },
  });

  try {
    await createUserNotification({
      userId: topUp.user,
      type: 'wallet_topup_approved',
      titleAr: 'تمت إضافة الرصيد',
      titleEn: 'Wallet topped up',
      messageAr: `تمت إضافة ${topUp.amount} ج.م إلى محفظتك.`,
      messageEn: `EGP ${topUp.amount} was added to your wallet.`,
      link: '/my-wallet',
    });
  } catch { /* notification is best-effort */ }

  res.json({ success: true, topUp: formatAdminTopUp(await populateTopUp(WalletTopUpRequest.findById(topUp._id))) });
});

export const rejectAdminTopUp = asyncHandler(async (req, res) => {
  const topUp = await WalletTopUpRequest.findById(req.params.id);
  if (!topUp) throw new AppError('Top-up request not found', 404);
  if (topUp.status !== 'pending') throw new AppError('This request was already processed', 400);

  const note = String(req.body.note || '').trim();
  if (note.length < 3) throw new AppError('A rejection reason of at least 3 characters is required', 400);

  topUp.status = 'rejected';
  topUp.reviewedBy = req.user._id;
  topUp.reviewedAt = new Date();
  topUp.adminNote = note;
  await topUp.save();

  await logAudit({
    req, action: 'reject', entityType: 'wallet_topup', entityId: topUp._id,
    entityLabel: `${topUp.amount} EGP`, changes: { status: 'rejected', reason: note },
  });

  try {
    await createUserNotification({
      userId: topUp.user,
      type: 'wallet_topup_rejected',
      titleAr: 'طلب شحن المحفظة مرفوض',
      titleEn: 'Wallet top-up rejected',
      messageAr: `تم رفض طلب شحن ${topUp.amount} ج.م: ${note}`,
      messageEn: `Your EGP ${topUp.amount} top-up was rejected: ${note}`,
      link: '/my-wallet',
    });
  } catch { /* best-effort */ }

  res.json({ success: true, topUp: formatAdminTopUp(await populateTopUp(WalletTopUpRequest.findById(topUp._id))) });
});

/* --------------------------- customer wallets --------------------------- */

export const searchAdminWalletUsers = asyncHandler(async (req, res) => {
  const q = String(req.query.search || '').trim();
  const page = Math.max(1, Math.trunc(Number(req.query.page) || 1));
  const limit = Math.min(50, Math.max(1, Math.trunc(Number(req.query.limit) || 20)));
  const filter = q
    ? { $or: [
      { phone: new RegExp(escapeRx(q), 'i') },
      { email: new RegExp(escapeRx(q), 'i') },
      { name: new RegExp(escapeRx(q), 'i') },
    ] }
    : {};

  const [users, total] = await Promise.all([
    User.find(filter).select('name phone email walletBalance role')
      .sort({ walletBalance: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    User.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: users.map((u) => ({
      _id: u._id, name: u.name, phone: u.phone, email: u.email,
      walletBalance: u.walletBalance || 0, role: u.role,
    })),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  });
});

export const getAdminUserWallet = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.userId).select('name phone email walletBalance role');
  if (!user) throw new AppError('User not found', 404);

  const txns = await WalletTransaction.find({ user: user._id }).sort({ createdAt: -1 }).limit(50).lean();
  const orderIds = [...new Set(
    txns.map((t) => t.order).filter(Boolean).map(String).filter((id) => mongoose.Types.ObjectId.isValid(id)),
  )];
  const orderNumbers = new Map();
  if (orderIds.length) {
    try {
      const orders = await Order.find({ _id: { $in: orderIds } }).select('orderNumber').lean();
      orders.forEach((o) => orderNumbers.set(String(o._id), o.orderNumber));
    } catch { /* cosmetic */ }
  }

  res.json({
    success: true,
    data: {
      user: {
        _id: user._id, name: user.name, phone: user.phone, email: user.email,
        walletBalance: user.walletBalance || 0, role: user.role,
      },
      history: txns.map((t) => formatTransaction(t, orderNumbers)),
    },
  });
});

export const adjustAdminUserWallet = asyncHandler(async (req, res) => {
  const amount = Math.round(Number(req.body.amount) * 100) / 100;
  const note = String(req.body.note || '').trim();

  if (!amount || Number.isNaN(amount) || Math.abs(amount) > 1000000) {
    throw new AppError('amount must be a non-zero number within ±1,000,000', 400);
  }
  if (note.length < 3 || note.length > 240) {
    throw new AppError('A reason between 3 and 240 characters is required', 400);
  }

  const result = await applyWalletMovement({
    userId: req.params.userId,
    amount,
    type: 'adjust',
    method: 'admin',
    note,
    createdBy: req.user._id,
  });

  if (!result) {
    const exists = await User.exists({ _id: req.params.userId });
    throw new AppError(exists ? 'Insufficient wallet balance' : 'User not found', exists ? 400 : 404);
  }

  await logAudit({
    req, action: 'adjust', entityType: 'wallet', entityId: req.params.userId,
    entityLabel: `${amount > 0 ? '+' : ''}${amount} EGP`, changes: { amount, note },
  });

  try {
    await createUserNotification({
      userId: req.params.userId,
      type: amount > 0 ? 'wallet_credit' : 'wallet_debit',
      titleAr: amount > 0 ? 'رصيد جديد في محفظتك' : 'تعديل على رصيد محفظتك',
      titleEn: amount > 0 ? 'Wallet credit added' : 'Wallet balance adjusted',
      messageAr: `${amount > 0 ? '+' : '−'}${Math.abs(amount)} ج.م — ${note}`,
      messageEn: `${amount > 0 ? '+' : '−'}EGP ${Math.abs(amount)} — ${note}`,
      link: '/my-wallet',
    });
  } catch { /* best-effort */ }

  res.json({ success: true, data: { walletBalance: result.balanceAfter, adjustment: amount } });
});
