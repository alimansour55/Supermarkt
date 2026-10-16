/**
 * Staff: closing / reopening stores, per-product commission, monthly statements & fee invoices,
 * and bulk status / message actions from the Sellers list.
 */
import mongoose from 'mongoose';
import Seller from '../models/Seller.js';
import Product from '../models/Product.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { toCsv, sendCsv } from '../utils/csvExport.js';
import { logAudit } from '../services/auditLog.service.js';
import { changeSellerStatus } from '../services/marketplace.service.js';
import { closureCheck, closeSeller, reopenSeller } from '../services/sellerLifecycle.service.js';
import { monthlyStatement } from '../services/sellerStatement.service.js';
import { statementCsvRows } from '../utils/sellerStatement.js';
import { postStaffMessage } from '../services/sellerMessage.service.js';
import { WARNING_REASONS } from '../models/SellerMessage.js';

const isId = (v) => mongoose.Types.ObjectId.isValid(v);
const MAX_BULK = 200;
const actorOf = (req) => ({ _id: req.user._id, name: req.user.name, role: req.user.role });

async function loadSeller(id) {
  if (!isId(id)) throw new AppError('Seller not found', 404);
  const seller = await Seller.findById(id);
  if (!seller) throw new AppError('Seller not found', 404);
  return seller;
}

/** GET /sellers/:id/closure-check — open parcels and money left, before staff confirm closing. */
export const getClosureCheckAdmin = asyncHandler(async (req, res) => {
  const seller = await loadSeller(req.params.id);
  res.json({ success: true, data: await closureCheck(seller._id) });
});

/**
 * Status changes that need more than a flag: closing (checks, logins off) and reopening
 * (logins back on). Called from changeSellerStatusAdmin. Returns extra info for the response.
 */
export async function lifecycleStatusChange(seller, status, { reason, acknowledgeBalance, req }) {
  if (status === 'closed' && seller.status === 'closed') return {};
  if (status === 'closed') return closeSeller(seller, { reason, acknowledgeBalance, actor: req.user });
  if (seller.status === 'closed') return reopenSeller(seller, { status, reason, actor: req.user });
  return null;
}

/** PUT /listings/:id/commission { rate } — one product's own commission (null = seller deal). */
export const setProductCommissionAdmin = asyncHandler(async (req, res) => {
  if (!isId(req.params.id)) throw new AppError('Product not found', 404);
  const product = await Product.findOne({ _id: req.params.id, seller: { $ne: null } });
  if (!product) throw new AppError('Product not found', 404);
  const raw = req.body?.rate;
  let rate = null;
  if (raw !== null && raw !== undefined && raw !== '') {
    rate = Number(raw);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) throw new AppError('Commission must be 0–100%', 400);
  }
  const from = product.sellerCommissionRate ?? null;
  // A field-only update: the pre-validate visibility hook has nothing to recompute here.
  await Product.updateOne({ _id: product._id }, { $set: { sellerCommissionRate: rate } });
  await logAudit({
    req, action: 'update', entityType: 'product', entityId: product._id, entityLabel: product.nameEn,
    changes: { sellerCommissionRate: { from, to: rate } },
  });
  await logAudit({
    req, action: 'update', entityType: 'seller', entityId: product.seller, entityLabel: product.nameEn,
    changes: { productCommission: { from: { product: product.nameEn, rate: from }, to: { product: product.nameEn, rate } } },
  });
  res.json({ success: true, data: { _id: product._id, sellerCommissionRate: rate } });
});

/** GET /sellers/:id/statement?month=YYYY-MM[&format=csv] */
export const getSellerStatementAdmin = asyncHandler(async (req, res) => {
  const seller = await loadSeller(req.params.id);
  const statement = await monthlyStatement(seller, req.query.month);
  if (req.query.format === 'csv') {
    const csv = toCsv(statementCsvRows(statement), [
      { header: 'date', value: (r) => r.date },
      { header: 'type', value: (r) => r.type },
      { header: 'reference', value: (r) => r.reference },
      { header: 'note', value: (r) => r.note },
      { header: 'amount', value: (r) => r.amount },
    ]);
    return sendCsv(res, `statement-${seller.slug}-${statement.month}.csv`, csv);
  }
  res.json({ success: true, data: statement });
});

function bulkIds(body) {
  const ids = [...new Set((Array.isArray(body?.sellerIds) ? body.sellerIds : []).map(String))].filter(isId);
  if (!ids.length) throw new AppError('Choose at least one seller', 400);
  if (ids.length > MAX_BULK) throw new AppError(`Up to ${MAX_BULK} sellers at a time`, 400);
  return ids;
}

/** POST /sellers/bulk-status { sellerIds, status: active|suspended, reason } */
export const bulkSellerStatusAdmin = asyncHandler(async (req, res) => {
  const ids = bulkIds(req.body);
  const status = req.body?.status;
  if (!['active', 'suspended'].includes(status)) throw new AppError('Bulk change can activate or suspend only', 400);
  const reason = String(req.body?.reason || '').trim().slice(0, 500);
  if (status === 'suspended' && !reason) throw new AppError('A reason is required', 400);
  const sellers = await Seller.find({ _id: { $in: ids } });
  const result = { updated: 0, skipped: [], failed: [] };
  for (const seller of sellers) {
    if (seller.status === status) { result.skipped.push(seller.nameEn); continue; }
    try {
      const from = seller.status;
      // eslint-disable-next-line no-await-in-loop
      await changeSellerStatus(seller, status, { reason, actor: req.user });
      // eslint-disable-next-line no-await-in-loop
      await logAudit({
        req, action: 'status_change', entityType: 'seller', entityId: seller._id, entityLabel: seller.nameEn,
        changes: { status: { from, to: status }, ...(reason ? { reason: { from: null, to: reason } } : {}), via: { from: null, to: 'bulk' } },
      });
      result.updated += 1;
    } catch (err) {
      result.failed.push({ name: seller.nameEn, message: err.message });
    }
  }
  res.json({ success: true, data: result });
});

/** POST /sellers/bulk-message { sellerIds, body, kind?, strike?, reason?, email? } */
export const bulkSellerMessageAdmin = asyncHandler(async (req, res) => {
  const ids = bulkIds(req.body);
  const body = String(req.body?.body || '').trim();
  if (!body) throw new AppError('Write a message', 400);
  const kind = req.body?.kind === 'warning' ? 'warning' : 'message';
  const reason = WARNING_REASONS.includes(req.body?.reason) ? req.body.reason : (kind === 'warning' ? 'other' : '');
  const sellers = await Seller.find({ _id: { $in: ids } });
  const result = { sent: 0, suspended: 0 };
  for (const seller of sellers) {
    // eslint-disable-next-line no-await-in-loop
    const r = await postStaffMessage(seller, {
      body, kind, reason, strike: kind === 'warning' && req.body?.strike === true, email: req.body?.email !== false, actor: actorOf(req), req,
    });
    result.sent += 1;
    if (r.suspended) result.suspended += 1;
  }
  res.json({ success: true, data: result });
});
