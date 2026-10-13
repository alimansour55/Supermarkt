/**
 * Seller catalog tools: vacation mode, catalog export (for the Excel round-trip), product
 * questions & answers, and replies to product reviews. Public Q&A endpoints live here too.
 */
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Seller from '../models/Seller.js';
import SellerCategory from '../models/SellerCategory.js';
import ProductQuestion from '../models/ProductQuestion.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { toCsv, sendCsv } from '../utils/csvExport.js';
import { parsePagination, paginationMeta } from '../utils/listQuery.js';
import { syncSellerProductVisibility, notifySellerUsers } from '../services/marketplace.service.js';
import { logSellerActivity } from '../services/sellerActivity.service.js';

const isId = (v) => mongoose.Types.ObjectId.isValid(String(v ?? ''));
const clean = (v, max) => String(v ?? '').trim().slice(0, max);

// ── Vacation mode ──

export const setVacation = asyncHandler(async (req, res) => {
  const seller = req.seller;
  const enabled = req.body?.enabled === true;
  let until = null;
  if (enabled && req.body?.until) {
    until = new Date(req.body.until);
    if (Number.isNaN(until.getTime()) || until <= new Date()) throw new AppError('Pick a return date in the future', 400);
    if (until - Date.now() > 120 * 86400000) throw new AppError('Vacation can last up to 120 days', 400);
  }
  seller.vacation = {
    enabled,
    startedAt: enabled ? (seller.vacation?.enabled ? seller.vacation.startedAt : new Date()) : null,
    until,
    messageAr: clean(req.body?.messageAr, 300),
    messageEn: clean(req.body?.messageEn, 300),
  };
  await seller.save();
  await syncSellerProductVisibility(seller._id);
  await logSellerActivity(req, { action: enabled ? 'store.vacation_on' : 'store.vacation_off', entityType: 'seller', entityId: seller._id, details: until ? { until: until.toISOString().slice(0, 10) } : null });
  res.json({ success: true, data: seller.vacation });
});

/** Job: end vacations whose return date has passed. */
export async function endExpiredVacations(now = new Date()) {
  const due = await Seller.find({ 'vacation.enabled': true, 'vacation.until': { $ne: null, $lte: now } }).select('_id');
  for (const s of due) {
    // eslint-disable-next-line no-await-in-loop
    await Seller.updateOne({ _id: s._id }, { $set: { 'vacation.enabled': false, 'vacation.startedAt': null, 'vacation.until': null } });
    // eslint-disable-next-line no-await-in-loop
    await syncSellerProductVisibility(s._id);
    // eslint-disable-next-line no-await-in-loop
    await notifySellerUsers(s._id, {
      type: 'seller_account',
      titleAr: 'مرحباً بعودتك 👋',
      titleEn: 'Welcome back 👋',
      messageAr: 'انتهت الإجازة ومنتجاتك معروضة مرة أخرى.',
      messageEn: 'Your vacation ended and your products are visible again.',
      link: '/seller-center',
    });
  }
  return due.length;
}

// ── Catalog export (Excel round-trip with POST /products/import) ──

export const exportSellerCatalog = asyncHandler(async (req, res) => {
  const [products, sections] = await Promise.all([
    Product.find({ seller: req.seller._id }).sort({ nameEn: 1 }).lean(),
    SellerCategory.find({ seller: req.seller._id }).select('nameEn nameAr').lean(),
  ]);
  const sectionName = new Map(sections.map((s) => [String(s._id), s.nameEn || s.nameAr]));
  const csv = toCsv(products, [
    { header: 'id', value: (p) => String(p._id) },
    { header: 'sku', value: (p) => p.sku || '' },
    { header: 'nameAr', value: (p) => p.nameAr },
    { header: 'nameEn', value: (p) => p.nameEn },
    { header: 'price', value: (p) => p.price },
    { header: 'oldPrice', value: (p) => p.oldPrice || '' },
    { header: 'stock', value: (p) => (p.variants?.length ? '' : p.stock ?? 0) },
    { header: 'lowStockThreshold', value: (p) => p.lowStockThreshold ?? '' },
    { header: 'storeCategory', value: (p) => (p.sellerCategories || []).map((id) => sectionName.get(String(id))).filter(Boolean).join('|') },
    { header: 'brand', value: (p) => p.brand || '' },
    { header: 'barcode', value: (p) => p.barcode || '' },
    { header: 'status', value: (p) => p.listingStatus },
    { header: 'fulfilledBy', value: (p) => p.fulfilledBy || '' },
  ]);
  sendCsv(res, `catalog-${new Date().toISOString().slice(0, 10)}.csv`, csv);
});

// ── Questions & answers ──

function formatQuestion(q, { withProduct = false } = {}) {
  return {
    _id: q._id,
    question: q.question,
    answer: q.answer || '',
    userName: q.userName,
    status: q.status,
    createdAt: q.createdAt,
    answeredAt: q.answeredAt,
    ...(withProduct && q.product?._id ? {
      product: { _id: q.product._id, nameAr: q.product.nameAr, nameEn: q.product.nameEn, image: q.product.images?.[0] || '', slug: q.product.slug },
    } : {}),
  };
}

/** Public: answered questions of a product (newest answers first). */
export const listProductQuestions = asyncHandler(async (req, res) => {
  if (!isId(req.query.product)) throw new AppError('Product is required', 400);
  const { page, limit, skip } = parsePagination(req.query, 20);
  const filter = { product: req.query.product, status: 'visible', answeredAt: { $ne: null } };
  const [items, total] = await Promise.all([
    ProductQuestion.find(filter).sort({ answeredAt: -1 }).skip(skip).limit(limit).lean(),
    ProductQuestion.countDocuments(filter),
  ]);
  res.json({ success: true, data: items.map((q) => formatQuestion(q)), pagination: paginationMeta(page, limit, total) });
});

/** Signed-in customers ask about a live marketplace product; the seller is notified. */
export const askProductQuestion = asyncHandler(async (req, res) => {
  const question = clean(req.body?.question, 500);
  if (question.length < 5) throw new AppError('Write your question (at least 5 characters)', 400);
  if (!isId(req.body?.product)) throw new AppError('Product is required', 400);
  const product = await Product.findOne({ _id: req.body.product, isActive: true, seller: { $ne: null } }).select('seller nameAr nameEn').lean();
  if (!product) throw new AppError('Questions are available on marketplace products only', 404);
  const recent = await ProductQuestion.countDocuments({ user: req.user._id, createdAt: { $gte: new Date(Date.now() - 86400000) } });
  if (recent >= 10) throw new AppError('You asked many questions today — try again tomorrow', 429);

  const q = await ProductQuestion.create({
    product: product._id, seller: product.seller, user: req.user._id, userName: req.user.name || '', question,
  });
  await notifySellerUsers(product.seller, {
    type: 'seller_question',
    titleAr: 'سؤال جديد من عميل',
    titleEn: 'New customer question',
    messageAr: `«${product.nameAr}»: ${question.slice(0, 120)}`,
    messageEn: `"${product.nameEn}": ${question.slice(0, 120)}`,
    link: '/seller-center/questions',
  });
  res.status(201).json({ success: true, data: formatQuestion(q.toObject()), message: 'Thanks — the seller will answer soon.' });
});

export const listSellerQuestions = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, 50);
  const filter = { seller: req.seller._id };
  if (req.query.state === 'unanswered') Object.assign(filter, { answeredAt: null, status: 'visible' });
  else if (req.query.state === 'answered') filter.answeredAt = { $ne: null };
  else if (req.query.state === 'hidden') filter.status = 'hidden';
  const [items, total, unanswered] = await Promise.all([
    ProductQuestion.find(filter).sort({ answeredAt: 1, createdAt: -1 }).skip(skip).limit(limit)
      .populate('product', 'nameAr nameEn images slug').lean(),
    ProductQuestion.countDocuments(filter),
    ProductQuestion.countDocuments({ seller: req.seller._id, answeredAt: null, status: 'visible' }),
  ]);
  res.json({ success: true, data: items.map((q) => formatQuestion(q, { withProduct: true })), unanswered, pagination: paginationMeta(page, limit, total) });
});

async function findOwnQuestion(req) {
  if (!isId(req.params.id)) throw new AppError('Question not found', 404);
  const q = await ProductQuestion.findOne({ _id: req.params.id, seller: req.seller._id });
  if (!q) throw new AppError('Question not found', 404);
  return q;
}

export const answerQuestion = asyncHandler(async (req, res) => {
  const q = await findOwnQuestion(req);
  const answer = clean(req.body?.answer, 1500);
  if (answer.length < 2) throw new AppError('Write an answer', 400);
  q.answer = answer;
  q.answeredBy = req.user._id;
  q.answeredAt = q.answeredAt || new Date();
  q.status = 'visible';
  await q.save();
  await logSellerActivity(req, { action: 'product.answer', entityType: 'product', entityId: q.product, label: q.question.slice(0, 80) });
  res.json({ success: true, data: formatQuestion(q.toObject()) });
});

export const setQuestionVisibility = asyncHandler(async (req, res) => {
  const q = await findOwnQuestion(req);
  q.status = req.body?.hidden === true ? 'hidden' : 'visible';
  await q.save();
  res.json({ success: true, data: formatQuestion(q.toObject()) });
});

// ── Product reviews (read + reply) ──

export const listSellerProductReviews = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, 50);
  const match = { 'reviews.status': 'approved' };
  const rating = Number(req.query.rating);
  if ([1, 2, 3, 4, 5].includes(rating)) match['reviews.rating'] = rating;
  if (req.query.unreplied === 'true') match['reviews.adminReply.message'] = { $in: ['', null] };

  const base = [
    { $match: { seller: req.seller._id, 'reviews.0': { $exists: true } } },
    { $unwind: '$reviews' },
    { $match: match },
  ];
  const [rows, countRows, dist] = await Promise.all([
    Product.aggregate([
      ...base,
      { $sort: { 'reviews.createdAt': -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $project: {
          productId: '$_id', nameAr: 1, nameEn: 1, slug: 1, image: { $arrayElemAt: ['$images', 0] },
          review: { _id: '$reviews._id', rating: '$reviews.rating', title: '$reviews.title', comment: '$reviews.comment', createdAt: '$reviews.createdAt', verifiedPurchase: '$reviews.verifiedPurchase', reply: '$reviews.adminReply' },
        },
      },
    ]),
    Product.aggregate([...base, { $count: 'n' }]),
    Product.aggregate([
      { $match: { seller: req.seller._id } },
      { $unwind: '$reviews' },
      { $match: { 'reviews.status': 'approved' } },
      { $group: { _id: '$reviews.rating', count: { $sum: 1 } } },
    ]),
  ]);
  const total = countRows[0]?.n || 0;
  res.json({
    success: true,
    data: rows,
    distribution: [5, 4, 3, 2, 1].map((r) => ({ rating: r, count: dist.find((d) => d._id === r)?.count || 0 })),
    pagination: paginationMeta(page, limit, total),
  });
});

export const replyToProductReview = asyncHandler(async (req, res) => {
  const message = clean(req.body?.message, 2000);
  if (!isId(req.params.productId) || !isId(req.params.reviewId)) throw new AppError('Review not found', 404);
  const product = await Product.findOne({ _id: req.params.productId, seller: req.seller._id });
  const review = product?.reviews?.id(req.params.reviewId);
  if (!review || review.status !== 'approved') throw new AppError('Review not found', 404);
  review.adminReply = message
    ? { message, repliedAt: new Date(), repliedBy: req.user._id, byRole: 'seller' }
    : { message: '', repliedAt: null, repliedBy: null, byRole: 'seller' };
  product.markModified('reviews');
  await product.save({ validateBeforeSave: false });
  await logSellerActivity(req, { action: 'product.review_reply', entityType: 'product', entityId: product._id, label: product.nameEn });
  res.json({ success: true, data: review.adminReply });
});
