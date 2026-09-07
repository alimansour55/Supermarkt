import Promotion from '../models/Promotion.js';
import Product from '../models/Product.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { parsePagination, parseSort, paginationMeta } from '../utils/listQuery.js';
import { buildOffersProductFilter, REAL_OFFER_CONDITION } from '../utils/offersFilter.js';
import { applyProductCategoryQueryToFilter } from '../utils/categoryTree.js';
import {
  applyPromotion,
  countPromotionProducts,
  ensureUniqueSlug,
  formatPromotion,
  normalizePromotionPayload,
  revertPromotion,
  syncPromotionLifecycle,
  syncTimedPromotionLifecycles,
} from '../services/promotion.service.js';
import {
  listHomepageCampaignCandidates as fetchHomepageCampaignCandidates,
  syncLinkedHomepageSection,
  detachPromotionFromHomepage,
} from '../services/homepageDealPromotion.service.js';
import { clearPublicHomepageCache } from '../controllers/homepageSection.controller.js';

const ADMIN_SORT = ['createdAt', 'nameEn', 'startsAt', 'endsAt', 'priority'];

function buildPromotionStatusFilter(status) {
  const now = new Date();
  switch (status) {
    case 'paused':
      return { isActive: false };
    case 'scheduled':
      return { isActive: true, startsAt: { $gt: now } };
    case 'ended':
      return {
        isActive: true,
        $or: [
          { endsAt: { $ne: null, $lt: now } },
          {
            usageLimit: { $ne: null },
            $expr: { $gte: ['$usedCount', '$usageLimit'] },
          },
        ],
      };
    case 'active':
      return {
        isActive: true,
        $and: [
          { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
          { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] },
          {
            $or: [
              { usageLimit: null },
              { $expr: { $lt: ['$usedCount', '$usageLimit'] } },
            ],
          },
        ],
      };
    default:
      return {};
  }
}

function buildAdminFilter(query) {
  const filter = {};
  if (query.status) {
    Object.assign(filter, buildPromotionStatusFilter(query.status));
  } else if (query.isActive !== undefined && query.isActive !== '') {
    filter.isActive = query.isActive === 'true';
  }
  if (query.schedule === 'limited') {
    filter.endsAt = { $ne: null };
  } else if (query.schedule === 'open') {
    filter.endsAt = null;
  }
  if (query.type) {
    filter.type = query.type === 'bogo'
      ? { $in: ['bogo', 'buy_x_get_y'] }
      : query.type;
  }
  if (query.targetMode) filter.targetMode = query.targetMode;
  if (query.q) {
    const rx = { $regex: query.q, $options: 'i' };
    filter.$or = [{ nameAr: rx }, { nameEn: rx }, { slug: rx }, { badgeAr: rx }, { badgeEn: rx }];
  }
  return filter;
}

function dateInputValue(value) {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
}

function sameInstant(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return new Date(a).getTime() === new Date(b).getTime();
}

function assertScheduleNotInPast(normalized, existing = null) {
  const now = new Date();
  if (normalized.startsAt) {
    const unchanged = existing && sameInstant(normalized.startsAt, existing.startsAt);
    if (!unchanged && normalized.startsAt < now) {
      throw new AppError('Start time cannot be in the past', 400);
    }
  }
  if (normalized.endsAt) {
    const unchanged = existing && sameInstant(normalized.endsAt, existing.endsAt);
    if (!unchanged && normalized.endsAt < now) {
      throw new AppError('End time cannot be in the past', 400);
    }
  }
  if (normalized.startsAt && normalized.endsAt && normalized.endsAt <= normalized.startsAt) {
    throw new AppError('End time must be after start time', 400);
  }
}

export const listAdminPromotions = asyncHandler(async (req, res) => {
  await syncTimedPromotionLifecycles({ force: true });

  const { page, limit, skip } = parsePagination(req.query);
  const filter = buildAdminFilter(req.query);
  const sort = parseSort(req.query.sort, ADMIN_SORT, { createdAt: -1 });

  const [rows, total] = await Promise.all([
    Promotion.find(filter).sort(sort).skip(skip).limit(limit),
    Promotion.countDocuments(filter),
  ]);

  const data = await Promise.all(
    rows.map(async (row) => {
      const productCount = await countPromotionProducts(row);
      return formatPromotion(row, { productCount });
    }),
  );

  res.json({
    success: true,
    data,
    pagination: paginationMeta(page, limit, total),
  });
});

export const listHomepageCampaignCandidates = asyncHandler(async (_req, res) => {
  const data = await fetchHomepageCampaignCandidates();
  res.json({ success: true, data });
});

export const getAdminPromotion = asyncHandler(async (req, res) => {
  const promotion = await Promotion.findById(req.params.id);
  if (!promotion) throw new AppError('Promotion not found', 404);
  const productCount = await countPromotionProducts(promotion);
  res.json({ success: true, data: formatPromotion(promotion, { productCount }) });
});

export const createPromotion = asyncHandler(async (req, res) => {
  const normalized = normalizePromotionPayload(req.body);
  if (!normalized.nameEn && !normalized.nameAr) {
    throw new AppError('nameAr and nameEn are required', 400);
  }
  normalized.slug = await ensureUniqueSlug(normalized.slug);
  normalized.createdBy = req.user?._id || null;
  assertScheduleNotInPast(normalized);

  const promotion = await Promotion.create(normalized);
  if (promotion.isActive && promotion.resolveStatus() === 'active') {
    await applyPromotion(promotion._id);
  }
  await syncLinkedHomepageSection(promotion);
  clearPublicHomepageCache();

  const productCount = await countPromotionProducts(promotion);
  res.status(201).json({ success: true, data: formatPromotion(promotion, { productCount }) });
});

export const updatePromotion = asyncHandler(async (req, res) => {
  const promotion = await Promotion.findById(req.params.id);
  if (!promotion) throw new AppError('Promotion not found', 404);

  await revertPromotion(promotion._id);

  const normalized = normalizePromotionPayload(req.body, promotion);
  normalized.slug = await ensureUniqueSlug(normalized.slug, promotion._id);
  assertScheduleNotInPast(normalized, promotion);

  Object.assign(promotion, normalized);
  await promotion.save();

  await syncPromotionLifecycle(promotion);
  await syncLinkedHomepageSection(promotion);
  clearPublicHomepageCache();

  const productCount = await countPromotionProducts(promotion);
  res.json({ success: true, data: formatPromotion(promotion, { productCount }) });
});

export const deletePromotion = asyncHandler(async (req, res) => {
  const promotion = await Promotion.findById(req.params.id);
  if (!promotion) throw new AppError('Promotion not found', 404);
  await revertPromotion(promotion._id);
  await detachPromotionFromHomepage(promotion._id);
  await promotion.deleteOne();
  clearPublicHomepageCache();
  res.json({ success: true, message: 'Promotion deleted' });
});

export const togglePromotion = asyncHandler(async (req, res) => {
  const promotion = await Promotion.findById(req.params.id);
  if (!promotion) throw new AppError('Promotion not found', 404);

  promotion.isActive = req.body.isActive !== undefined ? !!req.body.isActive : !promotion.isActive;
  await promotion.save();
  await syncPromotionLifecycle(promotion);
  await syncLinkedHomepageSection(promotion);
  clearPublicHomepageCache();

  const productCount = await countPromotionProducts(promotion);
  res.json({ success: true, data: formatPromotion(promotion, { productCount }) });
});

export const bulkPromotions = asyncHandler(async (req, res) => {
  const { ids = [], action } = req.body;
  if (!Array.isArray(ids) || !ids.length) throw new AppError('ids required', 400);

  if (action === 'delete') {
    for (const id of ids) {
      await revertPromotion(id);
    }
    await Promotion.deleteMany({ _id: { $in: ids } });
  } else if (action === 'activate') {
    await Promotion.updateMany({ _id: { $in: ids } }, { $set: { isActive: true } });
    for (const id of ids) {
      const p = await Promotion.findById(id);
      if (p) await syncPromotionLifecycle(p);
    }
  } else if (action === 'pause') {
    await Promotion.updateMany({ _id: { $in: ids } }, { $set: { isActive: false } });
    for (const id of ids) {
      await revertPromotion(id);
    }
  } else {
    throw new AppError('Invalid bulk action', 400);
  }

  res.json({ success: true, message: 'Bulk action completed' });
});

export const listPromotionProducts = asyncHandler(async (req, res) => {
  const promotion = await Promotion.findById(req.params.id);
  if (!promotion) throw new AppError('Promotion not found', 404);

  const { page, limit, skip } = parsePagination(req.query);
  const baseFilter = { activePromotionId: promotion._id, isActive: true };
  const filter = req.query.realOffersOnly === 'false' ? baseFilter : buildOffersProductFilter(baseFilter);

  const [products, total] = await Promise.all([
    Product.find(filter).sort({ discount: -1, nameEn: 1 }).skip(skip).limit(limit),
    Product.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: products.map((p) => ({
      _id: p._id,
      nameAr: p.nameAr,
      nameEn: p.nameEn,
      price: p.price,
      oldPrice: p.oldPrice,
      discount: p.discount,
      brand: p.brand,
      promotionType: p.promotionType,
      offerBadgeAr: p.offerBadgeAr,
      offerBadgeEn: p.offerBadgeEn,
    })),
    pagination: paginationMeta(page, limit, total),
  });
});

export const getPromotionStats = asyncHandler(async (_req, res) => {
  const all = await Promotion.find({});
  const stats = {
    total: all.length,
    active: all.filter((p) => p.resolveStatus() === 'active').length,
    scheduled: all.filter((p) => p.resolveStatus() === 'scheduled').length,
    paused: all.filter((p) => p.resolveStatus() === 'paused').length,
    ended: all.filter((p) => p.resolveStatus() === 'ended').length,
    offerProducts: await Product.countDocuments(buildOffersProductFilter({ isActive: true })),
    catalogOffers: await Product.countDocuments(buildOffersProductFilter({ isActive: true })),
    legacyOffers: await Product.countDocuments({
      $and: [REAL_OFFER_CONDITION, { isActive: true }, { activePromotionId: null }],
    }),
    managedOffers: await Product.countDocuments({ activePromotionId: { $ne: null } }),
  };
  res.json({ success: true, data: stats });
});

const CATALOG_SORT = ['discount', 'price', 'nameEn', 'nameAr', 'createdAt', 'brand'];

async function buildCatalogOffersFilter(query) {
  const and = [REAL_OFFER_CONDITION];

  if (query.productActive === 'false') {
    and.push({ isActive: false });
  } else if (query.productActive !== 'all') {
    and.push({ isActive: true });
  }

  if (query.source === 'legacy') {
    and.push({ activePromotionId: null });
  } else if (query.source === 'managed') {
    and.push({ activePromotionId: { $ne: null } });
  }

  if (query.offerActive === 'true') {
    and.push({ offerActive: { $ne: false } });
  } else if (query.offerActive === 'false') {
    and.push({ offerActive: false });
  }

  if (query.brand?.trim()) {
    and.push({ brand: { $regex: query.brand.trim(), $options: 'i' } });
  }

  const categoryFilter = {};
  await applyProductCategoryQueryToFilter(categoryFilter, query);
  if (categoryFilter.$and?.length) {
    and.push(...categoryFilter.$and);
  }

  if (query.minDiscount || query.maxDiscount) {
    const discount = {};
    if (query.minDiscount) discount.$gte = Number(query.minDiscount);
    if (query.maxDiscount) discount.$lte = Number(query.maxDiscount);
    and.push({ discount });
  }

  if (query.q?.trim()) {
    const rx = { $regex: query.q.trim(), $options: 'i' };
    and.push({
      $or: [
        { nameAr: rx },
        { nameEn: rx },
        { slug: rx },
        { brand: rx },
        { sku: rx },
      ],
    });
  }

  return { $and: and };
}

function formatCatalogOffer(product) {
  const managed = Boolean(product.activePromotionId);
  return {
    _id: product._id,
    slug: product.slug,
    sku: product.sku || '',
    nameAr: product.nameAr,
    nameEn: product.nameEn,
    price: product.price,
    oldPrice: product.oldPrice,
    discount: product.discount || 0,
    brand: product.brand,
    image: product.images?.[0] || null,
    emoji: product.emoji || '🛍️',
    isActive: product.isActive !== false,
    isOffer: product.isOffer === true,
    offerActive: product.offerActive !== false,
    source: managed ? 'managed' : 'legacy',
    activePromotionId: product.activePromotionId || null,
    promotionType: product.promotionType || null,
    offerBadgeAr: product.offerBadgeAr,
    offerBadgeEn: product.offerBadgeEn,
    promotionBuyQty: product.promotionBuyQty || null,
    promotionGetQty: product.promotionGetQty || null,
    promotionUnit: product.promotionUnit || 'pieces',
    category: product.category,
    subCategory: product.subCategory,
  };
}

export const listCatalogOffers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = await buildCatalogOffersFilter(req.query);
  const sortKey = CATALOG_SORT.includes(req.query.sort) ? req.query.sort : 'discount';
  const order = req.query.order === 'asc' ? 1 : -1;
  const sort = { [sortKey]: order };
  if (sortKey === 'discount') sort.price = 1;

  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate('category', 'slug nameAr nameEn')
      .populate('subCategory', 'slug nameAr nameEn')
      .sort(sort)
      .skip(skip)
      .limit(limit),
    Product.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: products.map(formatCatalogOffer),
    pagination: paginationMeta(page, limit, total),
  });
});

export const patchCatalogOffer = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.productId);
  if (!product) throw new AppError('Product not found', 404);

  const managed = Boolean(product.activePromotionId);

  if (req.body.offerActive !== undefined) {
    product.offerActive = !!req.body.offerActive;
  }

  if (!managed) {
    if (req.body.discountPercent != null && Number(req.body.discountPercent) > 0) {
      const pct = Math.min(99, Math.max(1, Number(req.body.discountPercent)));
      const base = Number(req.body.basePrice ?? product.oldPrice ?? product.price);
      product.oldPrice = base;
      product.price = Math.round(base * (1 - pct / 100) * 100) / 100;
      product.isOffer = true;
      if (req.body.offerActive !== false) product.offerActive = true;
    } else {
      if (req.body.price != null) product.price = Number(req.body.price);
      if (req.body.oldPrice !== undefined) {
        product.oldPrice = req.body.oldPrice ? Number(req.body.oldPrice) : null;
      }
      if (product.oldPrice && product.oldPrice > product.price) {
        product.isOffer = true;
      }
    }
  } else if (req.body.price != null || req.body.oldPrice != null || req.body.discountPercent != null) {
    throw new AppError('Price is managed by a campaign — edit the campaign or pause this offer', 400);
  }

  if (product.offerActive && product.discount > 0) product.isOffer = true;
  await product.save();

  res.json({ success: true, data: formatCatalogOffer(product) });
});

/** @deprecated use patchCatalogOffer */
export const toggleCatalogOffer = patchCatalogOffer;

export const bulkCatalogOffers = asyncHandler(async (req, res) => {
  const { ids = [], action } = req.body;
  if (!Array.isArray(ids) || !ids.length) throw new AppError('ids required', 400);

  if (action === 'activate') {
    await Product.updateMany({ _id: { $in: ids } }, { $set: { offerActive: true, isOffer: true } });
  } else if (action === 'pause') {
    await Product.updateMany({ _id: { $in: ids } }, { $set: { offerActive: false } });
  } else if (action === 'clear') {
    const products = await Product.find({ _id: { $in: ids }, activePromotionId: null });
    for (const product of products) {
      const updates = { offerActive: false, isOffer: false, discount: 0, oldPrice: null };
      if (product.oldPrice && product.oldPrice > product.price) {
        updates.price = product.oldPrice;
      }
      await Product.updateOne({ _id: product._id }, { $set: updates });
    }
  } else {
    throw new AppError('Invalid bulk action', 400);
  }

  res.json({ success: true, message: 'Bulk action completed' });
});

export const importCatalogOffers = asyncHandler(async (req, res) => {
  const { productIds = [], all = false } = req.body;
  const filter = {
    activePromotionId: null,
    $or: [{ discount: { $gt: 0 } }, { isOffer: true }],
  };
  if (!all && productIds.length) {
    filter._id = { $in: productIds };
  }

  const products = await Product.find(filter);
  let created = 0;

  for (const product of products) {
    const percent = product.discount || (
      product.oldPrice > product.price
        ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)
        : 10
    );
    const slug = await ensureUniqueSlug(`${product.slug}-offer`);
    const promotion = await Promotion.create({
      nameAr: `عرض — ${product.nameAr}`,
      nameEn: `Offer — ${product.nameEn}`,
      slug,
      type: 'percent_off',
      targetMode: 'products',
      productIds: [product._id],
      rules: { percent: Math.max(1, percent) },
      badgeAr: 'عرض',
      badgeEn: 'Sale',
      isActive: product.offerActive !== false,
      startsAt: new Date(),
      endsAt: null,
    });
    if (promotion.isActive) await applyPromotion(promotion._id);
    created += 1;
  }

  res.json({ success: true, created, message: `Imported ${created} offer(s)` });
});

export { dateInputValue };
