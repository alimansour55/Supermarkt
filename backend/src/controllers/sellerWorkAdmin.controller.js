/**
 * Everything staff need about one seller without leaving its panel
 * (/api/admin/marketplace/sellers/:id/…): returns, the seller's activity log, the store ↔ seller
 * messages and warnings, and a month-by-month performance trend.
 * Products and parcels reuse the listing queue and shipments endpoints with ?seller=.
 */
import mongoose from 'mongoose';
import Seller from '../models/Seller.js';
import Shipment from '../models/Shipment.js';
import SellerActivity from '../models/SellerActivity.js';
import SellerMessage, { WARNING_REASONS } from '../models/SellerMessage.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { parsePagination, paginationMeta } from '../utils/listQuery.js';
import { getMarketplaceSettingsDoc } from '../services/marketplace.service.js';
import {
  postStaffMessage, withdrawStrike, listMessages, activeStrikes, enforcementConfig,
} from '../services/sellerMessage.service.js';
import { collectSellerReturns } from './sellerReturns.controller.js';
import { sellerMonthlyTrend } from '../utils/sellerTrend.js';

const isId = (v) => mongoose.Types.ObjectId.isValid(v);
const actorOf = (req) => ({ _id: req.user._id, name: req.user.name, role: req.user.role });

async function loadSeller(id) {
  if (!isId(id)) throw new AppError('Seller not found', 404);
  const seller = await Seller.findById(id);
  if (!seller) throw new AppError('Seller not found', 404);
  return seller;
}

export const listSellerReturnsAdmin = asyncHandler(async (req, res) => {
  const seller = await loadSeller(req.params.id);
  const { rows, counts } = await collectSellerReturns(seller._id);
  const status = ['pending', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : '';
  res.json({ success: true, data: (status ? rows.filter((r) => r.status === status) : rows).slice(0, 100), counts });
});

/** The seller's own activity log — what their team did, plus staff actions on their account. */
export const listSellerActivityAdmin = asyncHandler(async (req, res) => {
  const seller = await loadSeller(req.params.id);
  const { page, limit, skip } = parsePagination(req.query, 50);
  const filter = { seller: seller._id };
  const area = String(req.query.area || '');
  if (/^[a-z_]{2,20}$/.test(area)) filter.action = { $regex: `^${area}\\.` };
  const [items, total] = await Promise.all([
    SellerActivity.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    SellerActivity.countDocuments(filter),
  ]);
  res.json({ success: true, data: items, pagination: paginationMeta(page, limit, total) });
});

async function threadPayload(seller) {
  const cfg = enforcementConfig(await getMarketplaceSettingsDoc());
  const [messages, strikes] = await Promise.all([
    listMessages(seller._id),
    activeStrikes(seller._id, { windowDays: cfg.strikeWindowDays }),
  ]);
  return { messages, strikes, enforcement: cfg };
}

/** GET — the conversation; opening it marks the seller's replies as read by staff. */
export const listSellerMessagesAdmin = asyncHandler(async (req, res) => {
  const seller = await loadSeller(req.params.id);
  await SellerMessage.updateMany({ seller: seller._id, from: 'seller', staffReadAt: null }, { $set: { staffReadAt: new Date() } });
  res.json({ success: true, data: await threadPayload(seller) });
});

/** POST { body, kind: message|warning, strike?, reason?, email? } */
export const postSellerMessageAdmin = asyncHandler(async (req, res) => {
  const seller = await loadSeller(req.params.id);
  const kind = req.body?.kind === 'warning' ? 'warning' : 'message';
  const reason = WARNING_REASONS.includes(req.body?.reason) ? req.body.reason : (kind === 'warning' ? 'other' : '');
  let result;
  try {
    result = await postStaffMessage(seller, {
      body: req.body?.body,
      kind,
      strike: req.body?.strike === true,
      reason,
      email: req.body?.email !== false,
      actor: actorOf(req),
      req,
    });
  } catch (err) {
    if (err.statusCode) throw new AppError(err.message, err.statusCode);
    throw err;
  }
  res.status(201).json({ success: true, data: await threadPayload(seller), suspended: result.suspended });
});

export const withdrawSellerStrikeAdmin = asyncHandler(async (req, res) => {
  const seller = await loadSeller(req.params.id);
  if (!isId(req.params.messageId)) throw new AppError('Warning not found', 404);
  try {
    await withdrawStrike(seller, req.params.messageId, { actor: actorOf(req) });
  } catch (err) {
    if (err.statusCode) throw new AppError(err.message, err.statusCode);
    throw err;
  }
  res.json({ success: true, data: await threadPayload(seller) });
});

/** GET /sellers/:id/trend?months=6 — orders, sales, cancel and late-shipping rates per month. */
export const getSellerTrendAdmin = asyncHandler(async (req, res) => {
  const seller = await loadSeller(req.params.id);
  const months = Math.min(12, Math.max(3, Number(req.query.months) || 6));
  const since = new Date(Date.now() - (months + 1) * 31 * 86400000);
  const shipments = await Shipment.find({ seller: seller._id, createdAt: { $gte: since } })
    .select('status createdAt shippedAt cancelledByRole fulfilledBy subtotal')
    .lean();
  res.json({
    success: true,
    data: sellerMonthlyTrend(shipments, { months, handlingDays: seller.handlingDays ?? 2, now: new Date() }),
  });
});
