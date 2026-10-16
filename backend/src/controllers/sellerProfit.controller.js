import mongoose from 'mongoose';
import Seller from '../models/Seller.js';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { toCsv, sendCsv } from '../utils/csvExport.js';
import { logAudit } from '../services/auditLog.service.js';
import { getMarketplaceSettings } from '../services/marketplace.service.js';
import { getProfitReport } from '../services/marketplaceProfit.service.js';
import { chargePenalty, getSellerBalance } from '../services/sellerLedger.service.js';
import { computeShipmentFees, effectiveFeeConfig } from '../utils/sellerFees.js';

const isId = (v) => mongoose.Types.ObjectId.isValid(String(v || ''));

/** GET /admin/marketplace/profit?from&to&sellerId */
export const getProfitReportAdmin = asyncHandler(async (req, res) => {
  const { from, to, sellerId } = req.query;
  if (sellerId && !isId(sellerId)) throw new AppError('Unknown seller', 400);
  res.json({ success: true, data: await getProfitReport({ from, to, sellerId }) });
});

export const exportProfitReportAdmin = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const report = await getProfitReport({ from, to });
  const money = (k) => (r) => Number(r[k] || 0).toFixed(2);
  const csv = toCsv(report.sellers, [
    { header: 'Seller', value: (r) => r.seller.nameEn || r.seller.nameAr },
    { header: 'Plan', value: (r) => r.seller.feePlan || 'default' },
    { header: 'Orders', value: (r) => r.orders },
    { header: 'Sales (EGP)', value: money('sales') },
    { header: 'Returns', value: money('returns') },
    { header: 'Net sales', value: money('netSales') },
    { header: 'Commission', value: money('commission') },
    { header: 'Fixed fees', value: money('fixedFees') },
    { header: 'Fulfillment fees', value: money('fulfillmentFees') },
    { header: 'Payment fees', value: money('paymentFees') },
    { header: 'Plan fees', value: money('planFees') },
    { header: 'Penalties', value: money('penalties') },
    { header: 'Fee income', value: money('feeIncome') },
    { header: 'Manual credits', value: money('adjustments') },
    { header: 'Discounts paid', value: money('discountCost') },
    { header: 'Net profit', value: money('netProfit') },
    { header: 'Take rate %', value: (r) => r.takeRate },
    { header: 'VAT on fees', value: money('vat') },
    { header: 'Seller earnings', value: money('sellerEarnings') },
  ]);
  await logAudit({ req, action: 'export', entityType: 'seller_payout', entityLabel: `Seller profit ${report.range.from.toISOString().slice(0, 10)} → ${report.range.to.toISOString().slice(0, 10)}` });
  sendCsv(res, 'seller-profit.csv', csv);
});

/**
 * POST /admin/marketplace/fees/preview — "what would we earn on this sale?" with the live
 * fee setup. Body: { sellerId?, productId? | categoryId?, price, quantity?, fulfilledBy?,
 * paymentMethod?, settings? } — `settings` previews unsaved changes from the fees page.
 */
export const previewFeesAdmin = asyncHandler(async (req, res) => {
  const b = req.body || {};
  const price = Number(b.price);
  if (!Number.isFinite(price) || price <= 0) throw new AppError('Enter a price', 400);
  const quantity = Math.max(1, Math.min(1000, Math.round(Number(b.quantity) || 1)));
  const saved = await getMarketplaceSettings();
  const settings = b.settings && typeof b.settings === 'object' ? { ...saved, ...b.settings } : saved;

  let seller = null;
  if (b.sellerId) {
    if (!isId(b.sellerId)) throw new AppError('Unknown seller', 400);
    seller = await Seller.findById(b.sellerId).select('nameAr nameEn commissionRate categoryCommissions feePlan feeOverrides approvedAt createdAt').lean();
    if (!seller) throw new AppError('Unknown seller', 404);
    if (b.seller && typeof b.seller === 'object') seller = { ...seller, ...b.seller };
  } else if (b.seller && typeof b.seller === 'object') {
    seller = b.seller;
  }

  let product = null;
  if (b.productId && isId(b.productId)) {
    product = await Product.findById(b.productId).select('category categoryAncestors mainCategory sellerCommissionRate').lean();
  } else if (b.categoryId && isId(b.categoryId)) {
    const cat = await Category.findById(b.categoryId).select('parentCategory ancestors').lean();
    const ancestors = (cat?.ancestors?.length ? cat.ancestors : [cat?.parentCategory]).filter(Boolean);
    product = { category: b.categoryId, categoryAncestors: ancestors, mainCategory: ancestors[0] || b.categoryId };
  }

  const fulfilledBy = b.fulfilledBy === 'store' ? 'store' : 'seller';
  const deliveryFee = fulfilledBy === 'seller' && b.includeDelivery !== false ? Number(settings.sellerShipmentDeliveryFee) || 0 : 0;
  const fees = computeShipmentFees({
    settings,
    seller,
    fulfilledBy,
    deliveryFee,
    paymentMethod: String(b.paymentMethod || 'cod'),
    lines: [{ product, quantity, lineTotal: price * quantity }],
  });
  const cfg = effectiveFeeConfig(settings, seller);
  res.json({
    success: true,
    data: {
      ...fees,
      monthlyFee: cfg.monthlyFee,
      payoutHoldDays: cfg.payoutHoldDays,
      commissionFreeUntil: cfg.commissionFreeUntil,
    },
  });
});

/** POST /admin/marketplace/sellers/:id/penalties { amount, reason, note } */
export const chargePenaltyAdmin = asyncHandler(async (req, res) => {
  if (!isId(req.params.id)) throw new AppError('Seller not found', 404);
  const seller = await Seller.findById(req.params.id).select('nameEn');
  if (!seller) throw new AppError('Seller not found', 404);
  const entry = await chargePenalty(seller._id, { ...req.body, actor: req.user });
  await logAudit({
    req, action: 'adjust', entityType: 'seller', entityId: seller._id, entityLabel: seller.nameEn,
    changes: { penalty: { from: null, to: entry.amount }, reason: { from: null, to: entry.reason } },
  });
  res.status(201).json({ success: true, data: entry, balance: await getSellerBalance(seller._id) });
});
