/**
 * The seller's own store sections (/api/seller/categories) and their public listing on the
 * seller's store page (/api/sellers/:slug/categories). Every seller query is scoped by
 * `req.seller._id`.
 */
import mongoose from 'mongoose';
import SellerCategory from '../models/SellerCategory.js';
import Seller from '../models/Seller.js';
import Product from '../models/Product.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  MAX_SELLER_CATEGORIES,
  formatSellerCategory,
  orderSellerCategories,
  uniqueSellerCategorySlug,
} from '../services/sellerCategory.service.js';

const isId = (v) => mongoose.Types.ObjectId.isValid(String(v ?? ''));
const clean = (v, max = 80) => String(v ?? '').trim().slice(0, max);

/** product count per section: { total, live } maps keyed by section id. */
async function sectionCounts(sellerId) {
  const rows = await Product.aggregate([
    { $match: { seller: sellerId, sellerCategories: { $exists: true, $ne: [] } } },
    { $unwind: '$sellerCategories' },
    { $group: { _id: '$sellerCategories', total: { $sum: 1 }, live: { $sum: { $cond: ['$isActive', 1, 0] } } } },
  ]);
  return {
    total: new Map(rows.map((r) => [String(r._id), r.total])),
    live: new Map(rows.map((r) => [String(r._id), r.live])),
  };
}

async function findOwn(req) {
  if (!isId(req.params.id)) throw new AppError('Section not found', 404);
  const category = await SellerCategory.findOne({ _id: req.params.id, seller: req.seller._id });
  if (!category) throw new AppError('Section not found', 404);
  return category;
}

/** A parent must be one of the seller's top-level sections, and not the section itself. */
async function resolveParent(sellerId, parent, selfId = null) {
  if (!parent) return null;
  if (!isId(parent)) throw new AppError('Invalid parent section', 400);
  if (selfId && String(parent) === String(selfId)) throw new AppError('A section cannot be inside itself', 400);
  const doc = await SellerCategory.findOne({ _id: parent, seller: sellerId }).select('parent').lean();
  if (!doc) throw new AppError('Parent section not found', 400);
  if (doc.parent) throw new AppError('Sections can be nested one level only', 400);
  if (selfId && await SellerCategory.exists({ seller: sellerId, parent: selfId })) {
    throw new AppError('This section has sub-sections — it must stay top-level', 400);
  }
  return doc._id;
}

const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Two sections with the same name would look identical in the store's filter list. */
async function assertUniqueName(sellerId, { nameAr, nameEn }, excludeId = null) {
  const exact = (v) => ({ $regex: `^${escapeRegex(v)}$`, $options: 'i' });
  const clash = await SellerCategory.exists({
    seller: sellerId,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    $or: [{ nameAr: exact(nameAr) }, { nameEn: exact(nameEn) }],
  });
  if (clash) throw new AppError('You already have a section with this name', 409);
}

function readNames(body, current = {}) {
  const nameAr = body.nameAr !== undefined ? clean(body.nameAr) : current.nameAr;
  const nameEn = body.nameEn !== undefined ? clean(body.nameEn) : current.nameEn;
  // One name is enough — the other language falls back to it.
  const ar = nameAr || nameEn;
  const en = nameEn || nameAr;
  if (!ar || !en) throw new AppError('Enter a section name', 400);
  return { nameAr: ar, nameEn: en };
}

export const listMyCategories = asyncHandler(async (req, res) => {
  const [list, counts, uncategorized] = await Promise.all([
    SellerCategory.find({ seller: req.seller._id }).lean(),
    sectionCounts(req.seller._id),
    Product.countDocuments({ seller: req.seller._id, sellerCategories: { $size: 0 } }),
  ]);
  res.json({
    success: true,
    data: orderSellerCategories(list).map((c) => formatSellerCategory(c, counts)),
    meta: { uncategorized, max: MAX_SELLER_CATEGORIES },
  });
});

export const createMyCategory = asyncHandler(async (req, res) => {
  const sellerId = req.seller._id;
  if (await SellerCategory.countDocuments({ seller: sellerId }) >= MAX_SELLER_CATEGORIES) {
    throw new AppError(`Up to ${MAX_SELLER_CATEGORIES} sections per store`, 400);
  }
  const names = readNames(req.body || {});
  await assertUniqueName(sellerId, names);
  const parent = await resolveParent(sellerId, req.body?.parent);
  const last = await SellerCategory.findOne({ seller: sellerId, parent }).sort({ sortOrder: -1 }).select('sortOrder').lean();
  const category = await SellerCategory.create({
    seller: sellerId,
    ...names,
    slug: await uniqueSellerCategorySlug(sellerId, names.nameEn),
    parent,
    sortOrder: (last?.sortOrder ?? -1) + 1,
    isActive: req.body?.isActive !== false,
  });
  res.status(201).json({ success: true, data: formatSellerCategory(category.toObject()) });
});

export const updateMyCategory = asyncHandler(async (req, res) => {
  const category = await findOwn(req);
  const body = req.body || {};
  if (body.nameAr !== undefined || body.nameEn !== undefined) {
    const names = readNames(body, category);
    await assertUniqueName(req.seller._id, names, category._id);
    if (names.nameEn !== category.nameEn) {
      category.slug = await uniqueSellerCategorySlug(req.seller._id, names.nameEn, category._id);
    }
    Object.assign(category, names);
  }
  if (body.parent !== undefined) category.parent = await resolveParent(req.seller._id, body.parent, category._id);
  if (body.isActive !== undefined) category.isActive = body.isActive === true || body.isActive === 'true';
  await category.save();
  const counts = await sectionCounts(req.seller._id);
  res.json({ success: true, data: formatSellerCategory(category.toObject(), counts) });
});

/** Products stay — they're only taken out of the section. Sub-sections move to the top level. */
export const deleteMyCategory = asyncHandler(async (req, res) => {
  const category = await findOwn(req);
  await Product.updateMany({ seller: req.seller._id, sellerCategories: category._id }, { $pull: { sellerCategories: category._id } });
  await SellerCategory.updateMany({ seller: req.seller._id, parent: category._id }, { $set: { parent: null } });
  await category.deleteOne();
  res.json({ success: true });
});

/** Body: { ids: [...] } in the new order (any subset; positions are per list order). */
export const reorderMyCategories = asyncHandler(async (req, res) => {
  const ids = (Array.isArray(req.body?.ids) ? req.body.ids : []).map(String).filter(isId).slice(0, MAX_SELLER_CATEGORIES);
  if (!ids.length) throw new AppError('Nothing to reorder', 400);
  await SellerCategory.bulkWrite(ids.map((id, index) => ({
    updateOne: { filter: { _id: id, seller: req.seller._id }, update: { $set: { sortOrder: index } } },
  })));
  res.json({ success: true });
});

/** Public: the active sections of a store that have at least one live product. */
export const listPublicSellerCategories = asyncHandler(async (req, res) => {
  const seller = await Seller.findOne({ slug: String(req.params.slug).toLowerCase(), status: 'active' }).select('_id').lean();
  if (!seller) throw new AppError('Seller not found', 404);
  const [list, counts] = await Promise.all([
    SellerCategory.find({ seller: seller._id, isActive: true }).lean(),
    sectionCounts(seller._id),
  ]);
  const withCounts = list.map((c) => formatSellerCategory(c, counts));
  // Hide empty sections — a parent stays when one of its sub-sections has live products.
  const visible = withCounts.filter((c) => c.liveCount > 0
    || withCounts.some((child) => child.parent && String(child.parent) === String(c._id) && child.liveCount > 0));
  res.json({
    success: true,
    data: orderSellerCategories(visible).map(({ productCount, ...c }) => ({ ...c, productCount: c.liveCount })),
  });
});
