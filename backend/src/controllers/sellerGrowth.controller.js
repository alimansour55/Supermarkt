/**
 * Growth tools: seller promotions (seller creates → staff approve → job runs them), store
 * page design (tagline, banners, featured products) and product traffic (views → carts →
 * orders). Seller routes are scoped by req.seller; staff routes live under admin/marketplace.
 */
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import SellerCategory from '../models/SellerCategory.js';
import SellerPromotion from '../models/SellerPromotion.js';
import ProductStat from '../models/ProductStat.js';
import Shipment from '../models/Shipment.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { parsePagination, paginationMeta } from '../utils/listQuery.js';
import { uploadFilesToCloudinary, deleteManyFromCloudinary, CLOUDINARY_FOLDERS } from '../utils/cloudinaryUpload.js';
import { notifySellerUsers } from '../services/marketplace.service.js';
import { logSellerActivity } from '../services/sellerActivity.service.js';
import { logAudit } from '../services/auditLog.service.js';
import { activatePromotion, endPromotion, promotionProductFilter } from '../services/sellerPromotion.service.js';

const isId = (v) => mongoose.Types.ObjectId.isValid(String(v ?? ''));
const DAY = 86400000;
const MAX_PROMO_DAYS = 31;

// ── Promotions (seller) ──

function formatPromotion(p, productCount = null) {
  return {
    _id: p._id,
    name: p.name,
    percent: p.percent,
    scope: p.scope,
    sections: p.sections || [],
    products: p.products || [],
    startsAt: p.startsAt,
    endsAt: p.endsAt,
    status: p.status,
    reviewNote: p.reviewNote || '',
    appliedCount: (p.applied || []).length,
    skipped: p.skipped || 0,
    productCount,
    createdAt: p.createdAt,
    seller: p.seller?.nameEn ? { _id: p.seller._id, nameAr: p.seller.nameAr, nameEn: p.seller.nameEn } : undefined,
  };
}

export const listMyPromotions = asyncHandler(async (req, res) => {
  const items = await SellerPromotion.find({ seller: req.seller._id }).sort({ createdAt: -1 }).limit(100).lean();
  res.json({ success: true, data: items.map((p) => formatPromotion(p)) });
});

export const createMyPromotion = asyncHandler(async (req, res) => {
  const b = req.body || {};
  const name = String(b.name || '').trim().slice(0, 120);
  const percent = Math.round(Number(b.percent));
  const startsAt = new Date(b.startsAt);
  const endsAt = new Date(b.endsAt);
  if (name.length < 2) throw new AppError('Name your promotion', 400);
  if (!(percent >= 5 && percent <= 70)) throw new AppError('Discount must be 5%–70%', 400);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) throw new AppError('Choose start and end dates', 400);
  if (endsAt <= startsAt || endsAt <= new Date()) throw new AppError('The end must be after the start and in the future', 400);
  if (endsAt - startsAt > MAX_PROMO_DAYS * DAY) throw new AppError(`A promotion can run up to ${MAX_PROMO_DAYS} days`, 400);

  const scope = ['all', 'sections', 'products'].includes(b.scope) ? b.scope : 'all';
  const ids = (list) => [...new Set((Array.isArray(list) ? list : []).map(String).filter(isId))].slice(0, 200);
  let sections = [];
  let products = [];
  if (scope === 'sections') {
    sections = (await SellerCategory.find({ seller: req.seller._id, _id: { $in: ids(b.sections) } }).select('_id').lean()).map((s) => s._id);
    if (!sections.length) throw new AppError('Pick at least one of your sections', 400);
  }
  if (scope === 'products') {
    products = (await Product.find({ seller: req.seller._id, _id: { $in: ids(b.products) } }).select('_id').lean()).map((p) => p._id);
    if (!products.length) throw new AppError('Pick at least one of your products', 400);
  }

  const promo = await SellerPromotion.create({
    seller: req.seller._id, name, percent, scope, sections, products, startsAt, endsAt, createdBy: req.user._id,
  });
  const productCount = await Product.countDocuments(promotionProductFilter(promo));
  await logSellerActivity(req, { action: 'promotion.create', entityType: 'promotion', entityId: promo._id, label: name, details: { percent } });
  res.status(201).json({ success: true, data: formatPromotion(promo.toObject(), productCount) });
});

/** Withdraw a pending/approved promotion, or stop a running one early (prices restore). */
export const cancelMyPromotion = asyncHandler(async (req, res) => {
  if (!isId(req.params.id)) throw new AppError('Promotion not found', 404);
  const promo = await SellerPromotion.findOne({ _id: req.params.id, seller: req.seller._id });
  if (!promo) throw new AppError('Promotion not found', 404);
  if (promo.status === 'active') await endPromotion(promo, { status: 'cancelled' });
  else if (['pending', 'approved'].includes(promo.status)) {
    promo.status = 'cancelled';
    await promo.save();
  } else throw new AppError('This promotion already finished', 400);
  await logSellerActivity(req, { action: 'promotion.cancel', entityType: 'promotion', entityId: promo._id, label: promo.name });
  res.json({ success: true, data: formatPromotion(promo.toObject()) });
});

// ── Promotions (staff review) ──

export const listPromotionsAdmin = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, 100);
  const filter = {};
  if (['pending', 'approved', 'active', 'ended', 'rejected', 'cancelled'].includes(req.query.status)) filter.status = req.query.status;
  const [items, total] = await Promise.all([
    SellerPromotion.find(filter).sort({ status: 1, startsAt: 1 }).skip(skip).limit(limit).populate('seller', 'nameAr nameEn').lean(),
    SellerPromotion.countDocuments(filter),
  ]);
  const counts = await Promise.all(items.map((p) => Product.countDocuments(promotionProductFilter({ ...p, seller: p.seller?._id || p.seller }))));
  res.json({ success: true, data: items.map((p, i) => formatPromotion(p, counts[i])), pagination: paginationMeta(page, limit, total) });
});

export const reviewPromotionAdmin = asyncHandler(async (req, res) => {
  if (!isId(req.params.id)) throw new AppError('Promotion not found', 404);
  const promo = await SellerPromotion.findById(req.params.id);
  if (!promo || promo.status !== 'pending') throw new AppError('Only pending promotions can be reviewed', 400);
  const approve = req.body?.decision === 'approve';
  const note = String(req.body?.note || '').trim().slice(0, 500);
  if (!approve && !note) throw new AppError('Tell the seller why', 400);
  promo.status = approve ? 'approved' : 'rejected';
  promo.reviewNote = note;
  promo.reviewedBy = req.user._id;
  promo.reviewedAt = new Date();
  await promo.save();
  if (approve && promo.startsAt <= new Date() && promo.endsAt > new Date()) await activatePromotion(promo);
  await logAudit({ req, action: approve ? 'approve' : 'reject', entityType: 'seller', entityId: promo.seller, entityLabel: `promotion: ${promo.name}` });
  await notifySellerUsers(promo.seller, {
    type: 'seller_promotion',
    titleAr: approve ? 'تمت الموافقة على العرض' : 'لم تتم الموافقة على العرض',
    titleEn: approve ? 'Promotion approved' : 'Promotion not approved',
    messageAr: `«${promo.name}»${note ? `: ${note}` : ''}`,
    messageEn: `"${promo.name}"${note ? `: ${note}` : ''}`,
    link: '/seller-center/promotions',
  });
  res.json({ success: true, data: formatPromotion(promo.toObject()) });
});

// ── Store page design ──

const formatStorefront = (s) => ({
  taglineAr: s.storefront?.taglineAr || '',
  taglineEn: s.storefront?.taglineEn || '',
  banners: s.storefront?.banners || [],
  featuredProducts: (s.storefront?.featuredProducts || []).map(String),
});

export const getMyStorefront = asyncHandler(async (req, res) => {
  res.json({ success: true, data: formatStorefront(req.seller) });
});

export const uploadStorefrontMedia = asyncHandler(async (req, res) => {
  if (!req.files?.length) throw new AppError('No image uploaded', 400);
  const uploaded = await uploadFilesToCloudinary(req.files, CLOUDINARY_FOLDERS.sellers);
  res.json({ success: true, data: uploaded });
});

export const updateMyStorefront = asyncHandler(async (req, res) => {
  const b = req.body || {};
  const seller = req.seller;
  const before = (seller.storefront?.banners || []).map((x) => x.publicId).filter(Boolean);
  const str = (v, max) => String(v ?? '').trim().slice(0, max);
  if (b.taglineAr !== undefined) seller.set('storefront.taglineAr', str(b.taglineAr, 160));
  if (b.taglineEn !== undefined) seller.set('storefront.taglineEn', str(b.taglineEn, 160));
  if (b.banners !== undefined) {
    const banners = (Array.isArray(b.banners) ? b.banners : [])
      .filter((x) => typeof x?.url === 'string' && /^https:\/\/res\.cloudinary\.com\//.test(x.url))
      .slice(0, 5)
      .map((x) => ({ url: x.url, publicId: str(x.publicId, 200), link: /^\/[^/]/.test(String(x.link || '')) ? str(x.link, 300) : '' }));
    seller.set('storefront.banners', banners);
  }
  if (b.featuredProducts !== undefined) {
    const wanted = [...new Set((Array.isArray(b.featuredProducts) ? b.featuredProducts : []).map(String).filter(isId))].slice(0, 12);
    const own = await Product.find({ seller: seller._id, _id: { $in: wanted } }).select('_id').lean();
    const ownSet = new Set(own.map((p) => String(p._id)));
    seller.set('storefront.featuredProducts', wanted.filter((id) => ownSet.has(id)));
  }
  await seller.save();
  const after = new Set((seller.storefront?.banners || []).map((x) => x.publicId).filter(Boolean));
  const dropped = before.filter((id) => !after.has(id));
  if (dropped.length) await deleteManyFromCloudinary(dropped);
  await logSellerActivity(req, { action: 'store.design', entityType: 'seller', entityId: seller._id });
  res.json({ success: true, data: formatStorefront(seller) });
});

// ── Traffic ──

const cairoDay = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

/** Public, best-effort: count a view or add-to-cart on a marketplace product. */
export const trackProductEvent = asyncHandler(async (req, res) => {
  const type = req.body?.type === 'cart' ? 'carts' : req.body?.type === 'view' ? 'views' : null;
  if (!type || !isId(req.body?.product)) return res.status(204).end();
  const product = await Product.findOne({ _id: req.body.product, isActive: true, seller: { $ne: null } }).select('seller').lean();
  if (!product) return res.status(204).end();
  await ProductStat.updateOne(
    { product: product._id, day: cairoDay() },
    { $inc: { [type]: 1 }, $setOnInsert: { seller: product.seller } },
    { upsert: true },
  );
  return res.status(204).end();
});

export const getTrafficReport = asyncHandler(async (req, res) => {
  const sellerId = req.seller._id;
  const days = [7, 30, 90].includes(Number(req.query.days)) ? Number(req.query.days) : 30;
  const to = new Date();
  const from = new Date(to.getTime() - days * DAY);
  const [stats, sales] = await Promise.all([
    ProductStat.aggregate([
      { $match: { seller: sellerId, day: { $gte: cairoDay(from), $lte: cairoDay(to) } } },
      { $group: { _id: '$product', views: { $sum: '$views' }, carts: { $sum: '$carts' } } },
    ]),
    Shipment.aggregate([
      { $match: { seller: sellerId, status: { $ne: 'cancelled' }, createdAt: { $gte: from, $lt: to } } },
      { $unwind: '$items' },
      { $group: { _id: '$items.product', units: { $sum: '$items.quantity' }, orders: { $addToSet: '$_id' }, gross: { $sum: '$items.lineTotal' } } },
    ]),
  ]);
  const byId = new Map();
  stats.forEach((s) => byId.set(String(s._id), { views: s.views, carts: s.carts, units: 0, orders: 0, gross: 0 }));
  sales.forEach((s) => {
    if (!s._id) return;
    const row = byId.get(String(s._id)) || { views: 0, carts: 0 };
    byId.set(String(s._id), { ...row, units: s.units, orders: s.orders.length, gross: Math.round(s.gross * 100) / 100 });
  });
  const products = await Product.find({ _id: { $in: [...byId.keys()] }, seller: sellerId }).select('nameAr nameEn images sku').lean();
  const pct = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);
  const rows = products.map((p) => {
    const r = byId.get(String(p._id));
    return {
      product: p._id, nameAr: p.nameAr, nameEn: p.nameEn, sku: p.sku, image: p.images?.[0] || '',
      ...r, cartRate: pct(r.carts, r.views), conversion: pct(r.orders, r.views),
    };
  }).sort((a, b) => b.views - a.views || b.orders - a.orders);
  const totals = rows.reduce((t, r) => ({ views: t.views + r.views, carts: t.carts + r.carts, orders: t.orders + r.orders, units: t.units + r.units }), { views: 0, carts: 0, orders: 0, units: 0 });
  res.json({
    success: true,
    data: { days, totals: { ...totals, cartRate: pct(totals.carts, totals.views), conversion: pct(totals.orders, totals.views) }, products: rows },
  });
});

/** Public seller page: featured products, in the seller's chosen order. */
export async function featuredProductsFor(seller) {
  const ids = seller.storefront?.featuredProducts || [];
  if (!ids.length) return [];
  const list = await Product.find({ _id: { $in: ids }, seller: seller._id, isActive: true })
    .populate([{ path: 'category', select: 'slug nameAr nameEn' }, { path: 'mainCategory', select: 'slug nameAr nameEn' }]);
  const order = new Map(ids.map((id, i) => [String(id), i]));
  return list.sort((a, b) => order.get(String(a._id)) - order.get(String(b._id)));
}

