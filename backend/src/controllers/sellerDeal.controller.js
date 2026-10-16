/**
 * Staff view and change of seller deals (/api/admin/marketplace/sellers/…): the effective deal
 * summary, change history, scheduled changes and the bulk "change deal" action.
 */
import mongoose from 'mongoose';
import Seller from '../models/Seller.js';
import Category from '../models/Category.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { sellerDealSummary } from '../utils/sellerFees.js';
import { getMarketplaceSettingsDoc } from '../services/marketplace.service.js';
import {
  validateDealChanges, applyDealNow, scheduleDeal, cancelScheduledDeal, sellerHistory,
} from '../services/sellerDeal.service.js';

const isId = (v) => mongoose.Types.ObjectId.isValid(v);
const MAX_BULK = 200;

async function loadSeller(id) {
  if (!isId(id)) throw new AppError('Seller not found', 404);
  const seller = await Seller.findById(id);
  if (!seller) throw new AppError('Seller not found', 404);
  return seller;
}

const scheduledRows = (seller) => [...(seller.scheduledDeals || [])]
  .sort((a, b) => (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1) || new Date(a.applyAt) - new Date(b.applyAt))
  .slice(0, 15)
  .map((d) => ({
    _id: d._id, applyAt: d.applyAt, changes: d.changes, note: d.note, status: d.status,
    createdByName: d.createdByName, createdAt: d.createdAt, doneAt: d.doneAt,
  }));

/** GET /sellers/:id/deal — what this seller pays today, per category, plus waiting changes. */
export const getSellerDealAdmin = asyncHandler(async (req, res) => {
  const seller = await loadSeller(req.params.id);
  const settings = (await getMarketplaceSettingsDoc()).toObject();
  const dealCats = [
    ...(seller.categoryCommissions || []).map((r) => String(r.category)),
    ...(settings.categoryCommissions || []).map((r) => String(r.category)),
  ];
  const categories = await Category.find({
    $or: [{ parentCategory: null, isActive: { $ne: false } }, { _id: { $in: dealCats.filter(isId) } }],
  }).select('nameAr nameEn parentCategory sortOrder').sort({ parentCategory: 1, sortOrder: 1, nameEn: 1 }).lean();
  const summary = sellerDealSummary({ settings, seller: seller.toObject(), categories, now: new Date() });
  res.json({ success: true, data: { ...summary, scheduled: scheduledRows(seller) } });
});

/** GET /sellers/:id/history?type=deal — field-level change history from the audit log. */
export const getSellerHistoryAdmin = asyncHandler(async (req, res) => {
  const seller = await loadSeller(req.params.id);
  const rows = await sellerHistory(seller._id, {
    onlyDeal: req.query.type === 'deal',
    limit: Math.min(100, Math.max(1, Number(req.query.limit) || 30)),
    before: req.query.before || null,
  });
  res.json({ success: true, data: rows });
});

/** POST /sellers/:id/deal-schedule { applyAt, changes, note } */
export const scheduleSellerDealAdmin = asyncHandler(async (req, res) => {
  const seller = await loadSeller(req.params.id);
  const changes = await validateDealChanges(req.body?.changes || {});
  await scheduleDeal(seller, changes, { applyAt: req.body?.applyAt, note: req.body?.note, req });
  res.status(201).json({ success: true, data: scheduledRows(seller) });
});

/** DELETE /sellers/:id/deal-schedule/:changeId */
export const cancelSellerDealAdmin = asyncHandler(async (req, res) => {
  const seller = await loadSeller(req.params.id);
  if (!isId(req.params.changeId)) throw new AppError('Change not found', 404);
  await cancelScheduledDeal(seller, req.params.changeId, { req });
  res.json({ success: true, data: scheduledRows(seller) });
});

/**
 * POST /sellers/bulk-deal { sellerIds, changes, applyAt?, note? }
 * Same change for many sellers — now, or scheduled for each of them on `applyAt`.
 */
export const bulkSellerDealAdmin = asyncHandler(async (req, res) => {
  const ids = [...new Set((Array.isArray(req.body?.sellerIds) ? req.body.sellerIds : []).map(String))].filter(isId);
  if (!ids.length) throw new AppError('Choose at least one seller', 400);
  if (ids.length > MAX_BULK) throw new AppError(`Up to ${MAX_BULK} sellers at a time`, 400);
  const settingsDoc = await getMarketplaceSettingsDoc();
  const changes = await validateDealChanges(req.body?.changes || {}, { settingsDoc });
  const applyAt = req.body?.applyAt || null;
  const note = String(req.body?.note || '').slice(0, 300);

  const sellers = await Seller.find({ _id: { $in: ids } });
  const result = { updated: 0, scheduled: 0, failed: [] };
  for (const seller of sellers) {
    try {
      if (applyAt) {
        // eslint-disable-next-line no-await-in-loop
        await scheduleDeal(seller, changes, { applyAt, note, req });
        result.scheduled += 1;
      } else {
        // eslint-disable-next-line no-await-in-loop
        await applyDealNow(seller, changes, { req, note });
        result.updated += 1;
      }
    } catch (err) {
      if (err.statusCode === 400 && applyAt && /date/i.test(err.message)) throw err; // same bad date for everyone
      result.failed.push({ id: String(seller._id), name: seller.nameEn, message: err.message });
    }
  }
  const missing = ids.length - sellers.length;
  if (missing) result.failed.push({ id: '', name: '', message: `${missing} seller(s) not found` });
  res.json({ success: true, data: result });
});
