import mongoose from 'mongoose';
import Seller from '../models/Seller.js';
import SellerPayout, { SELLER_PAYOUT_METHODS, SELLER_PAYOUT_STATUSES } from '../models/SellerPayout.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { parsePagination, paginationMeta } from '../utils/listQuery.js';
import { toCsv, sendCsv } from '../utils/csvExport.js';
import { logAudit } from '../services/auditLog.service.js';
import { getMarketplaceSettings } from '../services/marketplace.service.js';
import {
  getSellerBalance,
  listLedger,
  addAdjustment,
  generatePayout,
  markPayoutPaid,
  cancelPayout,
  listSellerBalances,
} from '../services/sellerLedger.service.js';
import { SELLER_LEDGER_TYPES } from '../models/SellerLedgerEntry.js';
import { effectiveFeeConfig } from '../utils/sellerFees.js';

const isId = (v) => mongoose.Types.ObjectId.isValid(v);

function formatPayout(p, { revealBank = false } = {}) {
  const bank = p.bankSnapshot || {};
  return {
    _id: p._id,
    payoutNumber: p.payoutNumber,
    seller: { _id: p.seller, nameAr: p.sellerNameAr, nameEn: p.sellerNameEn },
    amount: p.amount,
    entryCount: p.entryCount,
    periodEnd: p.periodEnd,
    status: p.status,
    method: p.method,
    referenceNumber: p.referenceNumber,
    note: p.note,
    createdAt: p.createdAt,
    paidAt: p.paidAt,
    cancelledAt: p.cancelledAt,
    bank: revealBank ? bank : {
      bankName: bank.bankName || '',
      accountName: bank.accountName || '',
      accountNumber: bank.accountNumber ? `••••${String(bank.accountNumber).slice(-4)}` : '',
      iban: bank.iban ? `••••${String(bank.iban).slice(-4)}` : '',
      walletPhone: bank.walletPhone || '',
    },
  };
}

// ── Seller portal ──

export const getMyFinance = asyncHandler(async (req, res) => {
  const [balance, settings, payouts] = await Promise.all([
    getSellerBalance(req.seller._id),
    getMarketplaceSettings(),
    SellerPayout.find({ seller: req.seller._id }).sort({ createdAt: -1 }).limit(20).lean(),
  ]);
  const cfg = effectiveFeeConfig(settings, req.seller);
  res.json({
    success: true,
    data: {
      balance,
      // The seller's own fee terms, so it can see what it pays before it sells.
      fees: {
        plan: cfg.plan,
        commissionRate: req.seller.commissionRate ?? cfg.defaultCommissionRate,
        categoryRates: (req.seller.categoryCommissions?.length ? req.seller.categoryCommissions : settings.categoryCommissions || []).length,
        minCommissionPerItem: cfg.minCommissionPerItem,
        maxCommissionPerItem: cfg.maxCommissionPerItem,
        fixedFeePerItem: cfg.fixedFeePerItem,
        fixedFeePerShipment: cfg.fixedFeePerShipment,
        storeFulfillmentFeePerItem: cfg.storeFulfillmentFeePerItem,
        monthlyFee: cfg.monthlyFee,
        vatPercent: cfg.vatPercent,
        commissionFreeUntil: cfg.commissionFreeUntil && cfg.commissionFreeUntil > new Date() ? cfg.commissionFreeUntil : null,
      },
      payoutHoldDays: cfg.payoutHoldDays,
      minPayoutAmount: settings.minPayoutAmount,
      payouts: payouts.map((p) => formatPayout(p, { revealBank: req.user.role === 'seller_owner' })),
    },
  });
});

export const getMyLedger = asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query, 200);
  const type = SELLER_LEDGER_TYPES.includes(req.query.type) ? req.query.type : undefined;
  const { items, total } = await listLedger(req.seller._id, { page, limit, type });
  res.json({ success: true, data: items, pagination: paginationMeta(page, limit, total) });
});

// ── Admin ──

export const getSellerBalancesAdmin = asyncHandler(async (_req, res) => {
  const [rows, settings] = await Promise.all([listSellerBalances(), getMarketplaceSettings()]);
  res.json({ success: true, data: rows, minPayoutAmount: settings.minPayoutAmount });
});

async function findSeller(id) {
  if (!isId(id)) throw new AppError('Seller not found', 404);
  const seller = await Seller.findById(id).select('nameAr nameEn');
  if (!seller) throw new AppError('Seller not found', 404);
  return seller;
}

export const getSellerLedgerAdmin = asyncHandler(async (req, res) => {
  const seller = await findSeller(req.params.id);
  const { page, limit } = parsePagination(req.query, 200);
  const [balance, { items, total }] = await Promise.all([
    getSellerBalance(seller._id),
    listLedger(seller._id, { page, limit }),
  ]);
  res.json({ success: true, balance, data: items, pagination: paginationMeta(page, limit, total) });
});

export const addSellerAdjustmentAdmin = asyncHandler(async (req, res) => {
  const seller = await findSeller(req.params.id);
  const entry = await addAdjustment(seller._id, { amount: req.body?.amount, note: req.body?.note, actor: req.user });
  await logAudit({
    req, action: 'adjust', entityType: 'seller', entityId: seller._id, entityLabel: seller.nameEn,
    changes: { amount: { from: null, to: entry.amount }, note: { from: null, to: entry.note } },
  });
  res.status(201).json({ success: true, data: entry, balance: await getSellerBalance(seller._id) });
});

export const generatePayoutAdmin = asyncHandler(async (req, res) => {
  const seller = await findSeller(req.params.id);
  const payout = await generatePayout(seller._id, { actor: req.user });
  await logAudit({ req, action: 'create', entityType: 'seller_payout', entityId: payout._id, entityLabel: payout.payoutNumber });
  res.status(201).json({ success: true, data: formatPayout(payout, { revealBank: req.user.role === 'super_admin' }) });
});

export const listPayoutsAdmin = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, 100);
  const filter = {};
  if (SELLER_PAYOUT_STATUSES.includes(req.query.status)) filter.status = req.query.status;
  if (isId(req.query.seller)) filter.seller = req.query.seller;
  const [items, total] = await Promise.all([
    SellerPayout.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    SellerPayout.countDocuments(filter),
  ]);
  const revealBank = req.user.role === 'super_admin';
  res.json({ success: true, data: items.map((p) => formatPayout(p, { revealBank })), pagination: paginationMeta(page, limit, total) });
});

export const markPayoutPaidAdmin = asyncHandler(async (req, res) => {
  if (!isId(req.params.id)) throw new AppError('Payout not found', 404);
  const method = SELLER_PAYOUT_METHODS.includes(req.body?.method) ? req.body.method : 'bank_transfer';
  const payout = await markPayoutPaid(req.params.id, {
    method, referenceNumber: req.body?.referenceNumber, note: req.body?.note, actor: req.user,
  });
  await logAudit({ req, action: 'status_change', entityType: 'seller_payout', entityId: payout._id, entityLabel: payout.payoutNumber, changes: { status: { from: 'pending', to: 'paid' } } });
  res.json({ success: true, data: formatPayout(payout, { revealBank: req.user.role === 'super_admin' }) });
});

export const cancelPayoutAdmin = asyncHandler(async (req, res) => {
  if (!isId(req.params.id)) throw new AppError('Payout not found', 404);
  const payout = await cancelPayout(req.params.id, { actor: req.user });
  await logAudit({ req, action: 'status_change', entityType: 'seller_payout', entityId: payout._id, entityLabel: payout.payoutNumber, changes: { status: { from: 'pending', to: 'cancelled' } } });
  res.json({ success: true, data: formatPayout(payout) });
});

/** Bank batch for pending payouts — the finance team uploads it to the bank. */
export const exportPendingPayoutsAdmin = asyncHandler(async (req, res) => {
  const payouts = await SellerPayout.find({ status: 'pending' }).sort({ createdAt: 1 }).lean();
  const bank = (p) => p.bankSnapshot || {};
  const csv = toCsv(payouts, [
    { header: 'Payout', value: (p) => p.payoutNumber },
    { header: 'Seller', value: (p) => p.sellerNameEn },
    { header: 'Amount (EGP)', value: (p) => p.amount.toFixed(2) },
    { header: 'Bank', value: (p) => bank(p).bankName },
    { header: 'Account holder', value: (p) => bank(p).accountName },
    { header: 'Account number', value: (p) => bank(p).accountNumber },
    { header: 'IBAN', value: (p) => bank(p).iban },
    { header: 'Wallet phone', value: (p) => bank(p).walletPhone },
  ]);
  await logAudit({ req, action: 'bulk', entityType: 'seller_payout', entityLabel: `Exported ${payouts.length} pending payouts` });
  sendCsv(res, 'seller-payouts.csv', csv);
});
