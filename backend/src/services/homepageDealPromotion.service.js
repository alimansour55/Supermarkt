import Promotion from '../models/Promotion.js';
import HomepageSection from '../models/HomepageSection.js';
import Product from '../models/Product.js';
import { AppError } from '../utils/AppError.js';
import { endOfStoreDay, parsePromotionScheduleInstant } from '../utils/storeDate.js';
import { formatProduct } from '../utils/formatters.js';
import { applyOffersOnlyFilter } from '../utils/offersFilter.js';
import { mergeCategoryIntoProductFilter } from '../utils/categoryTree.js';
import { resolveSectionCategoryRef } from '../utils/homepageSectionCategory.js';
import {
  applyPromotion,
  ensureUniqueSlug,
  formatPromotion,
  normalizePromotionPayload,
  resolveTargetProducts,
  revertPromotion,
  syncPromotionLifecycle,
  syncTimedPromotionLifecycles,
  countPromotionProducts,
} from './promotion.service.js';

const DEAL_SECTION_TYPES = ['daily_offers', 'flash_sale'];

export function isHomepageDealSectionType(type) {
  return DEAL_SECTION_TYPES.includes(type);
}

function parseOptionalNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function resolveStandaloneEndsAt(section) {
  const config = section.dealConfig || {};
  const now = Date.now();

  if (config.countdownMode === 'custom' && config.countdownEnd) {
    const custom = parsePromotionScheduleInstant(config.countdownEnd, 'end');
    if (custom) return custom;
  }

  if (config.countdownMode === 'duration') {
    const hours = Math.min(72, Math.max(1, parseOptionalNumber(config.countdownDurationHours, 6)));
    return new Date(now + hours * 3600000);
  }

  return endOfStoreDay(new Date());
}

export function computeDealCountdownEnd(section, promotion = null) {
  const raw = section.dealConfig || {};
  const style = raw.style || (section.type === 'flash_sale' ? 'flash' : 'standard');
  if (style === 'minimal' || raw.showCountdown === false) return null;

  const campaignMode = raw.campaignMode === 'linked'
    ? 'linked'
    : raw.campaignMode === 'standalone'
      ? 'standalone'
      : (section.promotionId ? 'linked' : 'standalone');
  const countdownMode = campaignMode === 'linked'
    ? 'promotion'
    : (raw.countdownMode || 'end_of_day');
  const now = new Date();

  if (promotion?.endsAt) {
    const end = new Date(promotion.endsAt);
    const status = typeof promotion.resolveStatus === 'function'
      ? promotion.resolveStatus(now)
      : 'active';

    if (status === 'scheduled' && promotion.startsAt) {
      const start = new Date(promotion.startsAt);
      if (start > now) return start.toISOString();
    }

    if (end > now) {
      if (campaignMode === 'linked' || countdownMode === 'promotion' || section.promotionId) {
        return end.toISOString();
      }
    }
  }

  if (countdownMode === 'custom' && raw.countdownEnd) {
    const end = parsePromotionScheduleInstant(raw.countdownEnd, 'end');
    if (end && end > now) return end.toISOString();
  }

  if (countdownMode === 'duration') {
    const hours = Math.min(72, Math.max(1, parseOptionalNumber(raw.countdownDurationHours, 6)));
    return new Date(now.getTime() + hours * 3600000).toISOString();
  }

  const end = endOfStoreDay(now);
  return end > now ? end.toISOString() : null;
}

async function resolveSectionProductIds(section) {
  if (section.products?.length) {
    return section.products.map(String).filter(Boolean);
  }

  const query = section.productQuery || {};
  const filter = { isActive: true };
  const categoryRef = resolveSectionCategoryRef(section);
  if (categoryRef) {
    await mergeCategoryIntoProductFilter(filter, categoryRef);
  }
  if (query.section === 'top' || query.section === 'new-arrivals') filter.isFeatured = true;
  if (query.brand) filter.brand = query.brand;
  if (query.offers || section.type === 'daily_offers' || section.type === 'flash_sale') {
    applyOffersOnlyFilter(filter);
  }

  const sortMap = {
    newest: { createdAt: -1 },
    'best-selling': { soldCount: -1, rating: -1 },
    discount: { discount: -1, price: 1 },
    top: { rating: -1 },
    'price-low': { price: 1 },
    'price-high': { price: -1 },
  };

  const limit = parseOptionalNumber(query.limit, 8);
  const rows = await Product.find(filter)
    .sort(sortMap[query.sort] || sortMap.newest)
    .limit(limit)
    .select('_id');

  return rows.map((row) => String(row._id));
}

async function unlinkPreviousPromotion(section, nextPromotionId = null) {
  if (!section.promotionId) return;
  if (nextPromotionId && String(section.promotionId) === String(nextPromotionId)) return;
  await Promotion.updateOne(
    { _id: section.promotionId, homepageSectionId: section._id },
    { $set: { homepageSectionId: null } },
  );
}

export async function findLimitedPromotionCandidates() {
  const now = new Date();
  const rows = await Promotion.find({
    endsAt: { $ne: null, $gte: now },
  })
    .sort({ startsAt: 1, endsAt: 1, priority: -1, createdAt: -1 })
    .limit(100);

  return rows.filter((row) => {
    const status = row.resolveStatus(now);
    return status === 'active' || status === 'scheduled' || status === 'paused';
  });
}

export async function findActiveLimitedPromotions() {
  const now = new Date();
  const rows = await Promotion.find({
    endsAt: { $ne: null, $gte: now },
    isActive: { $ne: false },
    $or: [{ startsAt: null }, { startsAt: { $lte: now } }],
  })
    .sort({ endsAt: 1, priority: -1, createdAt: -1 })
    .limit(50);

  return rows.filter((row) => row.resolveStatus(now) === 'active');
}

export function resolveLimitedDealsCountdownEnd(promotions = []) {
  const now = Date.now();
  let nearest = null;
  for (const promo of promotions) {
    if (!promo?.endsAt) continue;
    const end = new Date(promo.endsAt).getTime();
    if (end > now && (nearest === null || end < nearest)) nearest = end;
  }
  return nearest ? new Date(nearest) : null;
}

async function collectProductIdsFromLimitedPromotions(promotions, maxIds = 200) {
  const seen = new Set();
  const ordered = [];

  for (const promo of promotions) {
    const products = await resolveTargetProducts(promo);
    for (const product of products) {
      if (product.isActive === false) continue;
      const id = String(product._id);
      if (seen.has(id)) continue;
      seen.add(id);
      ordered.push(id);
      if (ordered.length >= maxIds) return ordered;
    }
  }

  return ordered;
}

async function snapshotPromotionProductIds(promotion, limit = 48) {
  const products = await resolveTargetProducts(promotion);
  return products
    .filter((p) => p.isActive !== false)
    .slice(0, limit)
    .map((p) => p._id);
}

export async function findPrimaryHomepageDealSection() {
  return HomepageSection.findOne({
    type: { $in: DEAL_SECTION_TYPES },
    isActive: true,
    promotionId: { $ne: null },
  })
    .sort({ sortOrder: 1, createdAt: 1 });
}

function sortDealProducts(products, sort = 'discount') {
  const rows = [...products];
  if (sort === 'discount') {
    rows.sort((a, b) => (Number(b.discount) || 0) - (Number(a.discount) || 0) || Number(a.price) - Number(b.price));
  } else if (sort === 'best-selling') {
    rows.sort((a, b) => (Number(b.soldCount) || 0) - (Number(a.soldCount) || 0) || (Number(b.rating) || 0) - (Number(a.rating) || 0));
  } else if (sort === 'top') {
    rows.sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0));
  } else if (sort === 'price-low' || sort === 'price-asc') {
    rows.sort((a, b) => Number(a.price) - Number(b.price));
  } else if (sort === 'price-high' || sort === 'price-desc') {
    rows.sort((a, b) => Number(b.price) - Number(a.price));
  } else {
    rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
  return rows;
}

export async function productsFromActiveLimitedPromotions({
  limit = 8,
  sort = 'discount',
  page = 1,
  promotionId = null,
} = {}) {
  let promotions;
  if (promotionId) {
    const promotion = await Promotion.findById(promotionId);
    if (!promotion || !isPromotionVisibleOnStorefront(promotion) || !promotion.endsAt) {
      return { products: [], total: 0, countdownEnd: null, promotions: [] };
    }
    promotions = [promotion];
  } else {
    const primarySection = await findPrimaryHomepageDealSection();
    if (primarySection?.promotionId) {
      const promotion = await Promotion.findById(primarySection.promotionId);
      if (promotion && isPromotionVisibleOnStorefront(promotion) && promotion.endsAt) {
        const sectionProducts = await productsFromLinkedPromotion(primarySection);
        const countdownEnd = computeDealCountdownEnd(primarySection, promotion);
        return {
          products: sectionProducts.slice(0, Number(limit) || 8),
          total: sectionProducts.length,
          countdownEnd: countdownEnd ? new Date(countdownEnd) : null,
          promotions: [promotion],
        };
      }
    }
    promotions = await findActiveLimitedPromotions();
  }

  const poolSize = Math.max(Number(limit) || 8, 8) * 5;
  const productIds = await collectProductIdsFromLimitedPromotions(promotions, poolSize);

  if (!productIds.length) {
    return { products: [], total: 0, countdownEnd: null, promotions };
  }

  const products = await Product.find({ _id: { $in: productIds }, isActive: true })
    .populate('category', 'slug nameAr nameEn');

  const sorted = sortDealProducts(products, sort);
  const total = sorted.length;
  const skip = (Math.max(1, Number(page)) - 1) * Number(limit);
  const slice = sorted.slice(skip, skip + Number(limit));

  return {
    products: slice.map(formatProduct),
    total,
    countdownEnd: resolveLimitedDealsCountdownEnd(promotions),
    promotions,
  };
}

export async function listHomepageCampaignCandidates() {
  await syncTimedPromotionLifecycles({ force: true });

  const rows = await findLimitedPromotionCandidates();

  return Promise.all(
    rows.map(async (row) => {
      const productCount = await countPromotionProducts(row);
      return formatPromotion(row, { productCount });
    }),
  );
}

export function isPromotionVisibleOnStorefront(promotion) {
  if (!promotion) return false;
  const status = promotion.resolveStatus();
  return status === 'active' || status === 'scheduled';
}

export async function resolveDealSectionProducts(section) {
  const query = section.productQuery || {};
  const limit = parseOptionalNumber(query.limit, 8);
  const sort = query.sort || 'discount';

  if (section.promotionId) {
    return productsFromLinkedPromotion(section);
  }

  const { products } = await productsFromActiveLimitedPromotions({
    limit,
    sort,
    page: 1,
  });
  return products;
}

export async function productsFromLinkedPromotion(section) {
  if (!section.promotionId) return [];

  const promotion = await Promotion.findById(section.promotionId);
  if (!promotion || !isPromotionVisibleOnStorefront(promotion)) return [];

  let products = await resolveTargetProducts(promotion);
  products = products.filter((p) => p.isActive !== false);

  if (promotion.targetMode === 'products' && promotion.productIds?.length) {
    const order = new Map(promotion.productIds.map((id, index) => [String(id), index]));
    products.sort((a, b) => (order.get(String(a._id)) ?? 999) - (order.get(String(b._id)) ?? 999));
  } else {
    products = sortDealProducts(products, section.productQuery?.sort || 'discount');
  }

  const limit = parseOptionalNumber(section.productQuery?.limit, 8);
  return products.slice(0, limit).map(formatProduct);
}

async function upsertStandalonePromotion(section) {
  const productIds = await resolveSectionProductIds(section);
  if (!productIds.length) {
    throw new AppError('Add at least one product or enable filters that match products', 400);
  }

  const config = section.dealConfig || {};
  const endsAt = resolveStandaloneEndsAt(section);
  const startsAt = parsePromotionScheduleInstant(new Date().toISOString(), 'start');
  const percent = Math.min(99, Math.max(1, parseOptionalNumber(config.discountPercent, 15)));

  const basePayload = {
    nameAr: section.titleAr?.trim() || 'عروض اليوم',
    nameEn: section.titleEn?.trim() || "Today's deals",
    type: 'percent_off',
    targetMode: 'products',
    productIds,
    rules: { percent },
    badgeAr: section.titleAr?.trim()?.slice(0, 24) || 'عرض',
    badgeEn: section.titleEn?.trim()?.slice(0, 24) || 'Deal',
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    isActive: section.isActive !== false,
    notes: 'Synced from homepage CMS',
    source: 'homepage',
    homepageSectionId: section._id,
  };

  let promotion = section.promotionId
    ? await Promotion.findById(section.promotionId)
    : null;

  if (promotion && promotion.source !== 'homepage' && promotion.homepageSectionId
    && String(promotion.homepageSectionId) !== String(section._id)) {
    promotion = null;
  }

  if (promotion) {
    await revertPromotion(promotion._id);
    const normalized = normalizePromotionPayload(basePayload, promotion);
    normalized.slug = await ensureUniqueSlug(normalized.slug, promotion._id);
    Object.assign(promotion, normalized);
    promotion.source = 'homepage';
    promotion.homepageSectionId = section._id;
    await promotion.save();
    await syncPromotionLifecycle(promotion);
    return promotion;
  }

  const normalized = normalizePromotionPayload(basePayload);
  normalized.slug = await ensureUniqueSlug(normalized.slug);
  promotion = await Promotion.create({
    ...normalized,
    source: 'homepage',
    homepageSectionId: section._id,
  });
  if (promotion.isActive && promotion.resolveStatus() === 'active') {
    await applyPromotion(promotion._id);
  }
  return promotion;
}

async function linkExistingPromotion(section, promotionId) {
  const promotion = await Promotion.findById(promotionId);
  if (!promotion) throw new AppError('Campaign not found', 404);
  if (!promotion.endsAt) {
    throw new AppError('Only limited-time campaigns can power homepage deals', 400);
  }
  if (promotion.resolveStatus() === 'ended') {
    throw new AppError('This campaign has already ended', 400);
  }

  await unlinkPreviousPromotion(section, promotion._id);

  promotion.homepageSectionId = section._id;
  await promotion.save();

  section.products = (await snapshotPromotionProductIds(promotion, 48)).map(String);

  section.promotionId = promotion._id;
  section.dealConfig = {
    ...(section.dealConfig || {}),
    campaignMode: 'linked',
    countdownMode: 'promotion',
  };

  if (isPromotionVisibleOnStorefront(promotion)) {
    section.isActive = true;
  }

  return promotion;
}

export async function syncHomepageDealSection(section) {
  if (!isHomepageDealSectionType(section.type)) return section;

  const config = section.dealConfig || {};
  const mode = config.campaignMode === 'linked' ? 'linked' : 'standalone';

  if (mode === 'linked') {
    if (!section.promotionId) {
      throw new AppError('Select a limited-time campaign for this section', 400);
    }
    await linkExistingPromotion(section, section.promotionId);
    return section;
  }

  await unlinkPreviousPromotion(section);
  const promotion = await upsertStandalonePromotion(section);
  section.promotionId = promotion._id;
  section.dealConfig = {
    ...(section.dealConfig || {}),
    campaignMode: 'standalone',
  };
  section.products = (await snapshotPromotionProductIds(promotion, 48)).map(String);
  if (isPromotionVisibleOnStorefront(promotion)) {
    section.isActive = true;
  }
  return section;
}

export async function syncLinkedHomepageSection(promotion) {
  if (!promotion?.homepageSectionId) return null;

  const section = await HomepageSection.findById(promotion.homepageSectionId);
  if (!section || !isHomepageDealSectionType(section.type)) return null;

  section.promotionId = promotion._id;
  section.dealConfig = {
    ...(section.dealConfig?.toObject?.() || section.dealConfig || {}),
    campaignMode: 'linked',
    countdownMode: 'promotion',
  };

  section.products = (await snapshotPromotionProductIds(promotion, 48)).map(String);

  await section.save();
  return section;
}

export async function clearHomepagePromotionLink(sectionId) {
  await Promotion.updateMany(
    { homepageSectionId: sectionId },
    { $set: { homepageSectionId: null } },
  );
}

export async function detachPromotionFromHomepage(promotionId) {
  await HomepageSection.updateMany(
    { promotionId },
    { $set: { promotionId: null } },
  );
}

export function formatLinkedPromotionSummary(promotion) {
  if (!promotion) return null;
  return {
    _id: promotion._id,
    nameAr: promotion.nameAr,
    nameEn: promotion.nameEn,
    badgeAr: promotion.badgeAr,
    status: promotion.resolveStatus?.() || 'active',
    startsAt: promotion.startsAt,
    endsAt: promotion.endsAt,
    productCount: promotion.productIds?.length || 0,
    source: promotion.source || 'admin',
    homepageSectionId: promotion.homepageSectionId,
  };
}
