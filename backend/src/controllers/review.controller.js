import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import User from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { formatProduct } from '../utils/formatters.js';
import { applyProductRating } from '../utils/productRating.js';
import {
  findReviewableOrderForProduct,
  isOrderDeliveredForReview,
  orderContainsProduct,
} from '../utils/reviewEligibility.js';
import {
  aggregateReviewStats,
  exportAdminReviews,
  getReviewProductFilterOptions,
  queryAdminReviews,
  REVIEW_STATUSES,
} from '../services/review.service.js';
import { toCsv, sendCsv } from '../utils/csvExport.js';

const parseRating = (value) => {
  const rating = Number(value);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new AppError('Rating must be an integer from 1 to 5', 400);
  }
  return rating;
};

const formatUserReview = (review) => {
  const replyMessage = review.adminReply?.message?.trim?.() || '';
  return {
    _id: review._id,
    rating: review.rating,
    title: review.title || '',
    comment: review.comment,
    status: review.status || 'pending',
    verifiedPurchase: review.verifiedPurchase === true,
    reReviewAllowed: review.reReviewAllowed === true,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
    adminReply: replyMessage
      ? {
        message: replyMessage,
        repliedAt: review.adminReply?.repliedAt || null,
      }
      : null,
  };
};

const formatAdminUser = (user) => {
  if (!user) return null;
  if (typeof user === 'object' && user._id) {
    return {
      _id: String(user._id),
      name: user.name || null,
      email: user.email || null,
      phone: user.phone || null,
      reviewBlocked: user.reviewBlocked === true,
    };
  }
  return { _id: String(user) };
};

const formatAdminReview = (review, product, adminName = null) => {
  const doc = review.toObject ? review.toObject() : review;
  const replyMessage = doc.adminReply?.message?.trim?.() || '';
  const imageCount = Array.isArray(doc.images) ? doc.images.length : 0;
  const hasReply = Boolean(replyMessage);

  return {
    _id: String(doc._id),
    rating: doc.rating,
    title: doc.title || '',
    comment: doc.comment,
    status: doc.status || 'pending',
    verifiedPurchase: doc.verifiedPurchase === true,
    verifiedPurchaseManual: doc.verifiedPurchaseManual,
    pinned: doc.pinned === true,
    featured: doc.featured === true,
    reReviewAllowed: doc.reReviewAllowed === true,
    reReviewGrantedAt: doc.reReviewGrantedAt || null,
    images: doc.images || [],
    imageCount,
    reportedCount: doc.reportedCount || 0,
    reports: doc.reports || [],
    internalNote: doc.internalNote || '',
    orderId: doc.order ? String(doc.order) : null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    hasReply,
    user: formatAdminUser(doc.user),
    adminReply: replyMessage
      ? {
        message: replyMessage,
        repliedAt: doc.adminReply.repliedAt,
        adminName: adminName || formatAdminUser(doc.adminReply?.repliedBy)?.name || null,
      }
      : null,
    product: {
      _id: String(product._id),
      slug: product.slug,
      nameAr: product.nameAr,
      nameEn: product.nameEn,
      image: product.images?.[0] || product.emoji,
    },
  };
};

const findProductReview = async (productId, reviewId) => {
  const product = await Product.findById(productId)
    .populate('reviews.user', 'name email phone reviewBlocked')
    .populate('reviews.adminReply.repliedBy', 'name')
    .populate('reviews.reReviewGrantedBy', 'name');
  if (!product) throw new AppError('Product not found', 404);
  const review = product.reviews.id(reviewId);
  if (!review) throw new AppError('Review not found', 404);
  return { product, review };
};

export const getReviewEligibility = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { orderId } = req.query;

  const orderContextPromise = orderId && mongoose.Types.ObjectId.isValid(orderId)
    ? Order.findOne({ _id: orderId, user: req.user._id })
    : Promise.resolve(null);

  const [product, user, reviewableOrder, orderContext] = await Promise.all([
    Product.findOne({ _id: productId, isActive: true }).select('reviews slug nameAr nameEn'),
    User.findById(req.user._id).select('reviewBlocked'),
    findReviewableOrderForProduct(req.user._id, productId, orderId || null),
    orderContextPromise,
  ]);

  if (!product) throw new AppError('Product not found', 404);
  if (user?.reviewBlocked) {
    return res.json({
      success: true,
      data: {
        canReview: false,
        hasReview: false,
        myReview: null,
        blocked: true,
        requiresDelivery: true,
      },
    });
  }

  const existing = product.reviews.find((review) => String(review.user) === String(req.user._id));
  const reReviewAllowed = existing?.reReviewAllowed === true;
  const contextOrder = orderContext || reviewableOrder;
  const delivered = isOrderDeliveredForReview(contextOrder);
  const productInOrder = contextOrder ? orderContainsProduct(contextOrder, productId) : false;

  res.json({
    success: true,
    data: {
      canReview: Boolean(reviewableOrder) && (!existing || reReviewAllowed),
      hasReview: Boolean(existing) && !reReviewAllowed,
      reReviewAllowed,
      myReview: existing && !reReviewAllowed ? formatUserReview(existing) : null,
      orderId: reviewableOrder?._id || orderContext?._id || null,
      orderStatus: contextOrder?.orderStatus || contextOrder?.status || null,
      requiresDelivery: orderContext ? !delivered : !reviewableOrder,
      productNotInOrder: Boolean(orderContext) && delivered && !productInOrder,
    },
  });
});

export const upsertMyReview = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { comment = '', title = '', orderId = null } = req.body;
  const rating = parseRating(req.body.rating);

  const user = await User.findById(req.user._id).select('reviewBlocked');
  if (user?.reviewBlocked) {
    throw new AppError('You are not allowed to submit reviews', 403);
  }

  const [product, reviewableOrder] = await Promise.all([
    Product.findOne({ _id: productId, isActive: true }),
    findReviewableOrderForProduct(req.user._id, productId, orderId || null),
  ]);

  if (!product) throw new AppError('Product not found', 404);
  if (!reviewableOrder) {
    throw new AppError('You can review this product after your order is delivered', 403);
  }

  const existingIndex = product.reviews.findIndex(
    (review) => String(review.user) === String(req.user._id),
  );
  const existing = existingIndex >= 0 ? product.reviews[existingIndex] : null;

  if (existing && !existing.reReviewAllowed) {
    throw new AppError('You have already submitted a review for this product', 409);
  }

  if (existing && existing.reReviewAllowed) {
    product.reviews.splice(existingIndex, 1);
  }

  const verifiedPurchase = isOrderDeliveredForReview(reviewableOrder);

  product.reviews.push({
    user: req.user._id,
    rating,
    title: String(title || '').trim().slice(0, 200),
    comment,
    status: 'pending',
    order: reviewableOrder._id,
    verifiedPurchase,
  });

  applyProductRating(product);
  await product.save();

  res.json({
    success: true,
    message: 'Review submitted for moderation',
    data: formatProduct(product),
  });
});

export const deleteMyReview = asyncHandler(async (_req, res) => {
  throw new AppError('Reviews cannot be deleted or edited after submission', 403);
});

export const getAdminReviewStats = asyncHandler(async (_req, res) => {
  const stats = await aggregateReviewStats(Product);
  res.json({ success: true, data: stats });
});

export const getAdminReviewProductFilters = asyncHandler(async (req, res) => {
  const data = await getReviewProductFilterOptions(Product, req.query);
  res.json({ success: true, data });
});

export const getAdminReviews = asyncHandler(async (req, res) => {
  const result = await queryAdminReviews(Product, req.query);
  res.json({ success: true, ...result });
});

export const exportReviewsCsv = asyncHandler(async (req, res) => {
  const rows = await exportAdminReviews(Product, req.query);
  const csv = toCsv(rows, [
    { header: 'Review ID', value: (r) => r._id },
    { header: 'Customer', value: (r) => r.user?.name || '' },
    { header: 'Product', value: (r) => r.product?.nameEn || r.product?.nameAr || '' },
    { header: 'Rating', value: (r) => r.rating },
    { header: 'Title', value: (r) => r.title || '' },
    { header: 'Comment', value: (r) => r.comment || '' },
    { header: 'Status', value: (r) => r.status },
    { header: 'Verified', value: (r) => (r.verifiedPurchase ? 'Yes' : 'No') },
    { header: 'Has Reply', value: (r) => (r.adminReply?.message ? 'Yes' : 'No') },
    { header: 'Reported', value: (r) => r.reportedCount || 0 },
    { header: 'Created', value: (r) => (r.createdAt ? new Date(r.createdAt).toISOString() : '') },
  ]);
  sendCsv(res, 'reviews-export.csv', csv);
});

export const bulkAdminReviews = asyncHandler(async (req, res) => {
  const { items = [], action } = req.body;
  if (!Array.isArray(items) || !items.length) {
    throw new AppError('No reviews selected', 400);
  }

  const statusMap = {
    publish: 'approved',
    approve: 'approved',
    hide: 'hidden',
    reject: 'rejected',
    restore: 'pending',
  };

  let updated = 0;

  for (const item of items) {
    const { productId, reviewId } = item;
    if (!productId || !reviewId) continue;

    const product = await Product.findById(productId);
    if (!product) continue;
    const review = product.reviews.id(reviewId);
    if (!review) continue;

    if (action === 'delete') {
      review.deleteOne();
    } else if (action === 'feature') {
      review.featured = true;
    } else if (action === 'unfeature') {
      review.featured = false;
    } else if (action === 'pin') {
      review.pinned = true;
    } else if (action === 'unpin') {
      review.pinned = false;
    } else if (statusMap[action]) {
      review.status = statusMap[action];
    } else {
      continue;
    }

    applyProductRating(product);
    await product.save();
    updated += 1;
  }

  res.json({ success: true, message: `${updated} review(s) updated`, data: { updated } });
});

export const updateAdminReviewStatus = asyncHandler(async (req, res) => {
  const { productId, reviewId } = req.params;
  const {
    status,
    adminReply,
    internalNote,
    rating,
    comment,
    title,
    pinned,
    featured,
    verifiedPurchase,
    grantReReview,
    blockUserFromReviews,
    clearAdminReply,
  } = req.body;

  const { product, review } = await findProductReview(productId, reviewId);

  if (status !== undefined) {
    if (!REVIEW_STATUSES.includes(status)) {
      throw new AppError('Invalid review status', 400);
    }
    review.status = status;
  }

  if (rating !== undefined) review.rating = parseRating(rating);
  if (comment !== undefined) review.comment = String(comment || '').slice(0, 1000);
  if (title !== undefined) review.title = String(title || '').trim().slice(0, 200);
  if (pinned !== undefined) review.pinned = Boolean(pinned);
  if (featured !== undefined) review.featured = Boolean(featured);

  if (verifiedPurchase !== undefined) {
    review.verifiedPurchaseManual = Boolean(verifiedPurchase);
    review.verifiedPurchase = Boolean(verifiedPurchase);
  }

  if (internalNote !== undefined) {
    review.internalNote = String(internalNote || '').trim().slice(0, 2000);
  }

  if (grantReReview === true) {
    review.reReviewAllowed = true;
    review.reReviewGrantedAt = new Date();
    review.reReviewGrantedBy = req.user._id;
  }

  if (clearAdminReply === true) {
    review.set('adminReply', { message: '', repliedAt: null, repliedBy: null });
  } else if (adminReply !== undefined) {
    const message = String(adminReply || '').trim();
    if (message) {
      review.set('adminReply.message', message);
      review.set('adminReply.repliedAt', new Date());
      review.set('adminReply.repliedBy', req.user._id);
    } else {
      review.set('adminReply', { message: '', repliedAt: null, repliedBy: null });
    }
    product.markModified('reviews');
  }

  if (blockUserFromReviews === true && review.user) {
    await User.findByIdAndUpdate(review.user._id || review.user, { reviewBlocked: true });
  } else if (blockUserFromReviews === false && review.user) {
    await User.findByIdAndUpdate(review.user._id || review.user, { reviewBlocked: false });
  }

  applyProductRating(product);
  await product.save();

  const updated = formatAdminReview(review, product, req.user?.name || null);

  res.json({
    success: true,
    message: status === 'approved'
      ? 'Review approved'
      : status === 'hidden'
        ? 'Review hidden'
        : status === 'rejected'
          ? 'Review rejected'
          : grantReReview
            ? 'Customer can submit a new review'
            : 'Review updated',
    data: updated,
  });
});

export const deleteAdminReview = asyncHandler(async (req, res) => {
  const { productId, reviewId } = req.params;
  const { product, review } = await findProductReview(productId, reviewId);

  review.deleteOne();
  applyProductRating(product);
  await product.save();

  res.json({ success: true, message: 'Review deleted' });
});

export const requestReviewForOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const order = await Order.findById(orderId).populate('user', 'name email phone');
  if (!order) throw new AppError('Order not found', 404);
  if (order.orderStatus !== 'delivered') {
    throw new AppError('Review requests can only be sent for delivered orders', 400);
  }

  const { sendReviewRequest } = await import('../services/reviewRequest.service.js');
  const result = await sendReviewRequest(order, order.user, 'ar', { force: true });

  res.json({
    success: true,
    message: 'Review request sent',
    data: result,
  });
});
