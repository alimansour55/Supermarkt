import mongoose from 'mongoose';
import { asyncHandler } from '../middleware/errorHandler.js';
import { AppError } from '../utils/AppError.js';
import WalletTransaction from '../models/WalletTransaction.js';
import WalletTopUpRequest from '../models/WalletTopUpRequest.js';
import Order from '../models/Order.js';
import StoreSettings from '../models/StoreSettings.js';
import { WALLET_TOPUP_METHODS } from '../models/WalletTopUpRequest.js';
import {
  getWalletSettings,
  buildWalletSummary,
  assertTopUpAmount,
} from '../services/wallet.service.js';
import { CLOUDINARY_FOLDERS, uploadFileToCloudinary } from '../utils/cloudinaryUpload.js';

const HISTORY_LIMIT = 50;

async function resolveOrderNumbers(entries) {
  const ids = [...new Set(
    entries.map((e) => e.order).filter(Boolean).map(String)
      .filter((id) => mongoose.Types.ObjectId.isValid(id)),
  )];
  const map = new Map();
  if (!ids.length) return map;
  try {
    const orders = await Order.find({ _id: { $in: ids } }).select('orderNumber').lean();
    orders.forEach((o) => map.set(String(o._id), o.orderNumber));
  } catch {
    /* order numbers are cosmetic */
  }
  return map;
}

export const formatTransaction = (txn, orderNumbers = new Map()) => {
  const orderId = txn.order ? String(txn.order) : null;
  return {
    id: txn._id,
    type: txn.type,
    amount: txn.amount,
    balanceAfter: txn.balanceAfter,
    method: txn.method,
    note: txn.note || '',
    orderId,
    orderNumber: orderId ? orderNumbers.get(orderId) || null : null,
    topUpRequestId: txn.topUpRequest ? String(txn.topUpRequest) : null,
    createdAt: txn.createdAt || null,
  };
};

export const formatTopUpRequest = (req) => ({
  id: req._id,
  amount: req.amount,
  method: req.method,
  destinationAccount: req.destinationAccount || '',
  senderReference: req.senderReference || '',
  proofUrl: req.proofUrl || '',
  status: req.status,
  adminNote: req.adminNote || '',
  reviewedAt: req.reviewedAt || null,
  createdAt: req.createdAt || null,
});

/** Store accounts a customer can transfer to, taken from the manual payment-method config. */
async function getTopUpAccounts() {
  const settings = await StoreSettings.findOne({ key: 'main' }).select('paymentMethods').lean();
  const methods = settings?.paymentMethods || [];
  return WALLET_TOPUP_METHODS.map((id) => {
    const cfg = methods.find((m) => m.id === id);
    return {
      id,
      labelAr: cfg?.labelAr || (id === 'instapay' ? 'إنستاباي' : 'فودافون كاش'),
      labelEn: cfg?.labelEn || (id === 'instapay' ? 'InstaPay' : 'Vodafone Cash'),
      enabled: cfg?.enabled !== false && (cfg?.accountNumbers?.length || 0) > 0,
      accountNumbers: (cfg?.accountNumbers || []).map((a) => ({
        number: a.number,
        labelAr: a.labelAr || '',
        labelEn: a.labelEn || '',
      })),
    };
  });
}

export const getMyWallet = asyncHandler(async (req, res) => {
  const lang = req.query.lang === 'en' ? 'en' : 'ar';
  const settings = await getWalletSettings();
  const summary = buildWalletSummary(settings, lang);

  const [txns, pending, accounts] = await Promise.all([
    WalletTransaction.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(HISTORY_LIMIT).lean(),
    WalletTopUpRequest.find({ user: req.user._id, status: 'pending' }).sort({ createdAt: -1 }).lean(),
    getTopUpAccounts(),
  ]);

  const orderNumbers = await resolveOrderNumbers(txns);

  res.json({
    success: true,
    walletBalance: req.user.walletBalance || 0,
    settings: summary,
    accounts,
    history: txns.map((t) => formatTransaction(t, orderNumbers)),
    pendingTopUps: pending.map(formatTopUpRequest),
  });
});

export const createTopUp = asyncHandler(async (req, res) => {
  const lang = req.body.lang === 'en' ? 'en' : 'ar';
  const settings = await getWalletSettings();

  if (!settings.enabled || !settings.allowTopUp) {
    throw new AppError(lang === 'ar' ? 'شحن المحفظة غير متاح حالياً' : 'Wallet top-up is currently unavailable', 400);
  }

  const method = String(req.body.method || '').trim().toLowerCase();
  if (!WALLET_TOPUP_METHODS.includes(method)) {
    throw new AppError(lang === 'ar' ? 'اختر وسيلة تحويل صحيحة' : 'Choose a valid transfer method', 400);
  }

  const amount = assertTopUpAmount(Number(req.body.amount), settings);

  if (settings.maxBalance > 0 && (req.user.walletBalance || 0) + amount > settings.maxBalance) {
    throw new AppError(
      lang === 'ar'
        ? `الحد الأقصى لرصيد المحفظة هو ${settings.maxBalance} ج.م`
        : `Wallet balance cannot exceed ${settings.maxBalance} EGP`,
      400,
    );
  }

  const openCount = await WalletTopUpRequest.countDocuments({ user: req.user._id, status: 'pending' });
  if (openCount >= 3) {
    throw new AppError(
      lang === 'ar'
        ? 'لديك طلبات شحن قيد المراجعة — انتظر معالجتها أولاً'
        : 'You already have top-up requests under review — please wait for them to be processed',
      400,
    );
  }

  const accounts = await getTopUpAccounts();
  const methodAccounts = accounts.find((a) => a.id === method);
  if (!methodAccounts?.accountNumbers?.length) {
    throw new AppError(
      lang === 'ar' ? 'وسيلة التحويل غير مُعدّة بعد — تواصل مع المتجر' : 'This transfer method is not configured yet',
      400,
    );
  }

  const destinationAccount = String(req.body.destinationAccount || '').trim();
  if (!destinationAccount || !methodAccounts.accountNumbers.some((a) => a.number === destinationAccount)) {
    throw new AppError(lang === 'ar' ? 'اختر رقم الحساب الذي حوّلت إليه' : 'Select the account you transferred to', 400);
  }

  if (!req.file?.buffer?.length) {
    throw new AppError(lang === 'ar' ? 'ارفع صورة تأكيد التحويل' : 'Upload a transfer confirmation screenshot', 400);
  }

  const uploaded = await uploadFileToCloudinary(req.file, CLOUDINARY_FOLDERS.walletTopUps);

  const topUp = await WalletTopUpRequest.create({
    user: req.user._id,
    amount,
    method,
    destinationAccount,
    senderReference: String(req.body.senderReference || '').trim(),
    proofUrl: uploaded.url,
    proofPublicId: uploaded.publicId,
    proofUploadedAt: new Date(),
    status: 'pending',
  });

  res.status(201).json({ success: true, topUp: formatTopUpRequest(topUp) });
});

export const getTopUp = asyncHandler(async (req, res) => {
  const topUp = await WalletTopUpRequest.findOne({ _id: req.params.id, user: req.user._id }).lean();
  if (!topUp) throw new AppError('Top-up request not found', 404);
  res.json({ success: true, topUp: formatTopUpRequest(topUp) });
});
