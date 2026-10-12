import mongoose from 'mongoose';
import Seller from '../models/Seller.js';
import Shipment from '../models/Shipment.js';
import Order from '../models/Order.js';
import SellerReview from '../models/SellerReview.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { parsePagination, paginationMeta } from '../utils/listQuery.js';
import { logAudit } from '../services/auditLog.service.js';
import { refreshSellerRating, getSellerPerformance } from '../services/sellerReputation.service.js';

const isId = (v) => mongoose.Types.ObjectId.isValid(v);

const publicReview = (r) => ({
  _id: r._id,
  rating: r.rating,
  comment: r.comment,
  // First name only on the storefront.
  userName: String(r.userName || '').split(/\s+/)[0] || '',
  createdAt: r.createdAt,
});

/** Customer rates the seller of one of its delivered shipments (once). */
export const rateShipmentSeller = asyncHandler(async (req, res) => {
  const { id: orderId, shipmentId } = req.params;
  if (!isId(orderId) || !isId(shipmentId)) throw new AppError('Shipment not found', 404);
  const order = await Order.findOne({ _id: orderId, user: req.user._id }).select('_id').lean();
  if (!order) throw new AppError('Order not found', 404);
  const shipment = await Shipment.findOne({ _id: shipmentId, order: orderId }).select('seller status').lean();
  if (!shipment) throw new AppError('Shipment not found', 404);
  if (shipment.status !== 'delivered') throw new AppError('You can rate the seller once the shipment is delivered', 400);

  const rating = Math.round(Number(req.body?.rating));
  if (!(rating >= 1 && rating <= 5)) throw new AppError('Rating must be between 1 and 5', 400);
  const comment = String(req.body?.comment || '').trim().slice(0, 1000);

  try {
    const review = await SellerReview.create({
      seller: shipment.seller,
      shipment: shipment._id,
      order: order._id,
      user: req.user._id,
      userName: req.user.name || '',
      rating,
      comment,
    });
    await refreshSellerRating(shipment.seller);
    res.status(201).json({ success: true, data: publicReview(review) });
  } catch (err) {
    if (err?.code === 11000) throw new AppError('You already rated this seller for this shipment', 409);
    throw err;
  }
});

export const listPublicSellerReviews = asyncHandler(async (req, res) => {
  const seller = await Seller.findOne({ slug: String(req.params.slug).toLowerCase(), status: 'active' }).select('_id rating ratingCount').lean();
  if (!seller) throw new AppError('Seller not found', 404);
  const { page, limit, skip } = parsePagination(req.query, 50);
  const filter = { seller: seller._id, status: 'visible' };
  const [items, total, distribution] = await Promise.all([
    SellerReview.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    SellerReview.countDocuments(filter),
    SellerReview.aggregate([{ $match: filter }, { $group: { _id: '$rating', count: { $sum: 1 } } }]),
  ]);
  res.json({
    success: true,
    data: items.map(publicReview),
    rating: seller.rating,
    ratingCount: seller.ratingCount,
    distribution: [5, 4, 3, 2, 1].map((r) => ({ rating: r, count: distribution.find((d) => d._id === r)?.count || 0 })),
    pagination: paginationMeta(page, limit, total),
  });
});

// ── Seller portal ──

export const listMyReviews = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, 50);
  const filter = { seller: req.seller._id, status: 'visible' };
  const [items, total, performance] = await Promise.all([
    SellerReview.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    SellerReview.countDocuments(filter),
    getSellerPerformance(req.seller._id),
  ]);
  res.json({ success: true, data: items.map(publicReview), performance, pagination: paginationMeta(page, limit, total) });
});

// ── Admin ──

export const listSellerReviewsAdmin = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, 100);
  const filter = {};
  if (isId(req.query.seller)) filter.seller = req.query.seller;
  if (['visible', 'hidden'].includes(req.query.status)) filter.status = req.query.status;
  if (Number(req.query.maxRating)) filter.rating = { $lte: Number(req.query.maxRating) };
  const [items, total] = await Promise.all([
    SellerReview.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('seller', 'nameAr nameEn').lean(),
    SellerReview.countDocuments(filter),
  ]);
  res.json({ success: true, data: items, pagination: paginationMeta(page, limit, total) });
});

export const setSellerReviewStatusAdmin = asyncHandler(async (req, res) => {
  if (!isId(req.params.id)) throw new AppError('Review not found', 404);
  const status = req.body?.status;
  if (!['visible', 'hidden'].includes(status)) throw new AppError('Unknown status', 400);
  const review = await SellerReview.findByIdAndUpdate(req.params.id, { $set: { status } }, { new: true });
  if (!review) throw new AppError('Review not found', 404);
  await refreshSellerRating(review.seller);
  await logAudit({ req, action: status === 'hidden' ? 'reject' : 'approve', entityType: 'seller', entityId: review.seller, entityLabel: `Seller review ${review._id}` });
  res.json({ success: true, data: review });
});
