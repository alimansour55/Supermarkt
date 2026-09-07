import mongoose from 'mongoose';
import Promotion from '../models/Promotion.js';
import Product from '../models/Product.js';
import { PRICE_EFFECT_TYPES, getPromotionTypeMeta } from '../constants/promotionTypes.js';
import {
  badgesForQtyPromoRules,
  QTY_PROMO_TYPES,
} from '../constants/promotionQty.js';
import { parsePromotionScheduleInstant } from '../utils/storeDate.js';
import { buildCategoryRefsProductFilter } from '../utils/categoryTree.js';

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100;
}

export function normalizePromotionPayload(payload = {}, existing = null) {
  const type = payload.type || existing?.type || 'percent_off';
  const targetMode = payload.targetMode || existing?.targetMode || 'products';
  const rules = { ...(existing?.rules?.toObject?.() || existing?.rules || {}), ...(payload.rules || {}) };

  const nameEn = String(payload.nameEn ?? existing?.nameEn ?? '').trim();
  const nameAr = String(payload.nameAr ?? existing?.nameAr ?? nameEn).trim();

  return {
    nameAr: nameAr || nameEn,
    nameEn: nameEn || nameAr,
    slug: slugify(payload.slug || existing?.slug || nameEn || nameAr),
    type,
    targetMode,
    productIds: (payload.productIds ?? existing?.productIds ?? []).map(String),
    categoryIds: (payload.categoryIds ?? existing?.categoryIds ?? []).map(String),
    brandSlugs: (payload.brandSlugs ?? existing?.brandSlugs ?? []).map((b) => String(b).toLowerCase().trim()).filter(Boolean),
    rules: {
      percent: Math.min(99, Math.max(1, Number(rules.percent) || 10)),
      amountOff: Math.max(0, Number(rules.amountOff) || 0),
      fixedPrice: Math.max(0, Number(rules.fixedPrice) || 0),
      buyQty: Math.max(1, Number(rules.buyQty) || 1),
      getQty: Math.max(1, Number(rules.getQty) || 1),
      getProductIds: (rules.getProductIds || []).map(String),
      sameProduct: rules.sameProduct !== false,
      secondPercentOff: Math.min(100, Math.max(1, Number(rules.secondPercentOff) || 50)),
      bundlePrice: Math.max(0, Number(rules.bundlePrice) || 0),
      bundleProductIds: (rules.bundleProductIds || []).map(String),
      minPurchaseQty: Math.max(1, Number(rules.minPurchaseQty) || 1),
      promotionUnit: ['pieces', 'weight_kg', 'weight_l'].includes(rules.promotionUnit)
        ? rules.promotionUnit
        : (existing?.rules?.promotionUnit || 'pieces'),
    },
    badgeAr: String(payload.badgeAr ?? existing?.badgeAr ?? 'عرض').trim() || 'عرض',
    badgeEn: String(payload.badgeEn ?? existing?.badgeEn ?? 'Offer').trim() || 'Offer',
    cartLineAr: String(payload.cartLineAr ?? existing?.cartLineAr ?? '').trim(),
    cartLineEn: String(payload.cartLineEn ?? existing?.cartLineEn ?? '').trim(),
    cartProgressAr: String(payload.cartProgressAr ?? existing?.cartProgressAr ?? '').trim(),
    cartProgressEn: String(payload.cartProgressEn ?? existing?.cartProgressEn ?? '').trim(),
    cartSubtextAr: payload.cartSubtextAr !== undefined
      ? String(payload.cartSubtextAr ?? '').trim()
      : String(existing?.cartSubtextAr ?? '').trim(),
    cartSubtextEn: payload.cartSubtextEn !== undefined
      ? String(payload.cartSubtextEn ?? '').trim()
      : String(existing?.cartSubtextEn ?? '').trim(),
    startsAt: payload.startsAt
      ? parsePromotionScheduleInstant(payload.startsAt, 'start')
      : (existing?.startsAt ?? null),
    endsAt: payload.endsAt
      ? parsePromotionScheduleInstant(payload.endsAt, 'end')
      : (existing?.endsAt ?? null),
    isActive: payload.isActive !== undefined ? !!payload.isActive : (existing?.isActive !== false),
    priority: Number(payload.priority ?? existing?.priority ?? 0) || 0,
    usageLimit: payload.usageLimit ? Math.max(1, Number(payload.usageLimit)) : (existing?.usageLimit ?? null),
    notes: String(payload.notes ?? existing?.notes ?? '').trim(),
    source: payload.source || existing?.source || 'admin',
    homepageSectionId: payload.homepageSectionId !== undefined
      ? (payload.homepageSectionId || null)
      : (existing?.homepageSectionId ?? null),
  };
}

export async function resolveTargetProducts(promotion) {
  const filter = { isActive: true };

  if (promotion.targetMode === 'products') {
    const ids = (promotion.productIds || []).filter(Boolean);
    if (!ids.length) return [];
    filter._id = { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) };
  } else if (promotion.targetMode === 'categories') {
    const catIds = promotion.categoryIds || [];
    if (!catIds.length) return [];
    const categoryClause = await buildCategoryRefsProductFilter(catIds);
    if (!categoryClause) return [];
    filter.$and = [...(filter.$and || []), categoryClause];
  } else if (promotion.targetMode === 'brands') {
    const brands = (promotion.brandSlugs || []).filter(Boolean);
    if (!brands.length) return [];
    filter.brand = { $in: brands };
  }

  return Product.find(filter);
}

function defaultBadgeForType(type, isAr) {
  const map = {
    percent_off: { ar: 'خصم', en: 'Sale' },
    amount_off: { ar: 'خصم', en: 'Save' },
    fixed_price: { ar: 'سعر خاص', en: 'Special' },
    bogo: { ar: '1+1', en: 'BOGO' },
    buy_x_get_y: { ar: 'عرض', en: 'Deal' },
    second_percent_off: { ar: 'الثاني أرخص', en: '2nd off' },
    bundle: { ar: 'باقة', en: 'Bundle' },
  };
  const entry = map[type] || map.percent_off;
  return isAr ? entry.ar : entry.en;
}

function computePriceUpdates(product, promotion) {
  const rules = promotion.rules || {};
  const basePrice = Number(product.prePromotionPrice ?? product.price ?? 0);
  const meta = getPromotionTypeMeta(promotion.type);

  if (!meta.priceEffect) {
    return { isOffer: true };
  }

  let newPrice = basePrice;
  let newOldPrice = basePrice;

  switch (promotion.type) {
    case 'percent_off':
      newPrice = roundMoney(basePrice * (1 - (Number(rules.percent) || 10) / 100));
      newOldPrice = basePrice;
      break;
    case 'amount_off':
      newPrice = roundMoney(Math.max(0, basePrice - (Number(rules.amountOff) || 0)));
      newOldPrice = basePrice;
      break;
    case 'fixed_price':
      newPrice = roundMoney(Number(rules.fixedPrice) || basePrice);
      newOldPrice = basePrice;
      break;
    default:
      break;
  }

  if (newOldPrice <= newPrice) {
    return { isOffer: false, price: basePrice, oldPrice: null, discount: 0 };
  }

  const discount = Math.round(((newOldPrice - newPrice) / newOldPrice) * 100);
  return {
    price: newPrice,
    oldPrice: newOldPrice,
    discount,
    isOffer: discount > 0,
  };
}

export async function applyPromotionToProduct(product, promotion) {
  const priceUpdates = computePriceUpdates(product, promotion);
  const rules = promotion.rules || {};
  const isQtyPromo = QTY_PROMO_TYPES.has(promotion.type);
  const isSecondOff = promotion.type === 'second_percent_off';
  const isBundle = promotion.type === 'bundle';
  const usesUnit = isQtyPromo || isSecondOff || isBundle;
  const unit = rules.promotionUnit || 'pieces';
  const qtyBadges = isQtyPromo ? badgesForQtyPromoRules(rules) : null;
  const secondPct = isSecondOff
    ? Math.min(100, Math.max(1, Number(rules.secondPercentOff) || 50))
    : null;

  const set = {
    activePromotionId: promotion._id,
    promotionType: qtyBadges?.type || promotion.type,
    offerBadgeAr: qtyBadges?.badgeAr || promotion.badgeAr || defaultBadgeForType(promotion.type, true),
    offerBadgeEn: qtyBadges?.badgeEn || promotion.badgeEn || defaultBadgeForType(promotion.type, false),
    promotionBuyQty: isQtyPromo ? Math.max(1, Number(rules.buyQty) || 1) : null,
    promotionGetQty: isQtyPromo ? Math.max(1, Number(rules.getQty) || 1) : null,
    promotionUnit: usesUnit ? unit : null,
    promotionSecondPercentOff: secondPct,
    promotionCartLineAr: promotion.cartLineAr || null,
    promotionCartLineEn: promotion.cartLineEn || null,
    promotionCartProgressAr: promotion.cartProgressAr || null,
    promotionCartProgressEn: promotion.cartProgressEn || null,
    promotionCartSubtextAr: promotion.cartSubtextAr ?? null,
    promotionCartSubtextEn: promotion.cartSubtextEn ?? null,
    ...priceUpdates,
  };

  if (isSecondOff) {
    const badgeHasPct = (s) => /%/.test(String(s || ''));
    const badgeAr = badgeHasPct(promotion.badgeAr) ? promotion.badgeAr : `الثاني -${secondPct}%`;
    const badgeEn = badgeHasPct(promotion.badgeEn) ? promotion.badgeEn : `2nd -${secondPct}%`;
    if (unit !== 'pieces') {
      const suffix = unit === 'weight_kg' ? ' ك.ل' : ' ل';
      set.offerBadgeAr = badgeHasPct(promotion.badgeAr) ? promotion.badgeAr : `${badgeAr}${suffix}`;
      set.offerBadgeEn = badgeHasPct(promotion.badgeEn) ? promotion.badgeEn : `${badgeEn}${unit === 'weight_kg' ? ' kg' : ' L'}`;
    } else {
      set.offerBadgeAr = badgeAr;
      set.offerBadgeEn = badgeEn;
    }
  }

  if (PRICE_EFFECT_TYPES.includes(promotion.type) && product.prePromotionPrice == null) {
    set.prePromotionPrice = product.price;
    set.prePromotionOldPrice = product.oldPrice ?? null;
  }

  if (!PRICE_EFFECT_TYPES.includes(promotion.type)) {
    set.isOffer = true;
  }

  await Product.updateOne({ _id: product._id }, { $set: set });
}

export async function revertPromotionFromProduct(product) {
  const restore = {
    activePromotionId: null,
    promotionType: null,
    offerBadgeAr: null,
    offerBadgeEn: null,
    promotionBuyQty: null,
    promotionGetQty: null,
    promotionUnit: null,
    promotionSecondPercentOff: null,
    promotionCartLineAr: null,
    promotionCartLineEn: null,
    promotionCartProgressAr: null,
    promotionCartProgressEn: null,
    promotionCartSubtextAr: null,
    promotionCartSubtextEn: null,
  };

  if (product.prePromotionPrice != null) {
    restore.price = product.prePromotionPrice;
    restore.oldPrice = product.prePromotionOldPrice ?? null;
    restore.prePromotionPrice = null;
    restore.prePromotionOldPrice = null;
    if (restore.oldPrice && restore.oldPrice > restore.price) {
      restore.discount = Math.round(((restore.oldPrice - restore.price) / restore.oldPrice) * 100);
      restore.isOffer = restore.discount > 0;
    } else {
      restore.discount = 0;
      restore.isOffer = false;
    }
  } else {
    restore.isOffer = false;
    restore.discount = 0;
  }

  await Product.updateOne({ _id: product._id }, { $set: restore });
}

export async function applyPromotion(promotionId) {
  const promotion = await Promotion.findById(promotionId);
  if (!promotion) return { applied: 0 };

  const products = await resolveTargetProducts(promotion);
  for (const product of products) {
    await applyPromotionToProduct(product, promotion);
  }
  return { applied: products.length };
}

export async function revertPromotion(promotionId) {
  const products = await Product.find({ activePromotionId: promotionId });
  for (const product of products) {
    await revertPromotionFromProduct(product);
  }
  return { reverted: products.length };
}

export async function syncPromotionLifecycle(promotion) {
  const status = promotion.resolveStatus();
  if (status === 'active') {
    return applyPromotion(promotion._id);
  }
  return revertPromotion(promotion._id);
}

/** Apply/revert timed campaigns so storefront prices match the schedule window. */
let lastTimedLifecycleSyncAt = 0;

export async function syncTimedPromotionLifecycles({ force = false, maxAgeMs = 60_000 } = {}) {
  const now = Date.now();
  if (!force && now - lastTimedLifecycleSyncAt < maxAgeMs) return;
  lastTimedLifecycleSyncAt = now;

  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

  const rows = await Promotion.find({
    endsAt: { $ne: null, $gte: weekAgo },
  })
    .limit(250);

  for (const promotion of rows) {
    try {
      await syncPromotionLifecycle(promotion);
    } catch {
      // keep syncing remaining campaigns
    }
  }
}

export function formatPromotion(promotion, { productCount = 0 } = {}) {
  const status = promotion.resolveStatus?.() || 'active';
  return {
    _id: promotion._id,
    id: String(promotion._id),
    nameAr: promotion.nameAr,
    nameEn: promotion.nameEn,
    slug: promotion.slug,
    type: promotion.type,
    targetMode: promotion.targetMode,
    productIds: (promotion.productIds || []).map(String),
    categoryIds: (promotion.categoryIds || []).map(String),
    brandSlugs: promotion.brandSlugs || [],
    rules: promotion.rules || {},
    badgeAr: promotion.badgeAr,
    badgeEn: promotion.badgeEn,
    startsAt: promotion.startsAt,
    endsAt: promotion.endsAt,
    isActive: promotion.isActive !== false,
    priority: promotion.priority || 0,
    usageLimit: promotion.usageLimit,
    usedCount: promotion.usedCount || 0,
    notes: promotion.notes || '',
    source: promotion.source || 'admin',
    homepageSectionId: promotion.homepageSectionId || null,
    status,
    productCount,
    createdAt: promotion.createdAt,
    updatedAt: promotion.updatedAt,
  };
}

export async function countPromotionProducts(promotion) {
  if (promotion.targetMode === 'products') return (promotion.productIds || []).length;
  const products = await resolveTargetProducts(promotion);
  return products.length;
}

export async function ensureUniqueSlug(baseSlug, excludeId = null) {
  let slug = baseSlug || 'promotion';
  let suffix = 0;
  while (true) {
    const candidate = suffix ? `${slug}-${suffix}` : slug;
    const filter = { slug: candidate };
    if (excludeId) filter._id = { $ne: excludeId };
    const exists = await Promotion.findOne(filter).select('_id');
    if (!exists) return candidate;
    suffix += 1;
  }
}
