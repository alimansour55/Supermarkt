import Product from '../models/Product.js';
import Category from '../models/Category.js';
import Order from '../models/Order.js';
import Cart from '../models/Cart.js';
import Coupon from '../models/Coupon.js';
import Banner from '../models/Banner.js';
import ContentPage from '../models/ContentPage.js';
import StoreSettings from '../models/StoreSettings.js';
import Promotion from '../models/Promotion.js';
import {
  formatProduct,
  formatOrder,
  formatCategory,
  formatCoupon,
  formatCartItem,
} from '../utils/formatters.js';
import { resolveProductSearchFilter, fetchRankedProducts } from '../utils/searchQuery.js';
import { getAvailableStock } from '../utils/productCatalog.js';
import { buildOffersProductFilter } from '../utils/offersFilter.js';
import { buildNestedCategoryTree } from '../utils/categoryTree.js';
import {
  productsFromActiveLimitedPromotions,
  findActiveLimitedPromotions,
} from './homepageDealPromotion.service.js';
import { formatPromotion, syncTimedPromotionLifecycles } from './promotion.service.js';
import { listPublicDeliveryZones } from './deliveryZone.service.js';
import { getLoyaltySettings, buildLoyaltySummary, pointsToCashValue } from './loyalty.service.js';
import { PROMOTION_TYPES } from '../constants/promotionTypes.js';
import { CONTENT_PAGE_SLUGS } from '../constants/contentPages.js';

const SETTINGS_KEY = 'main';

export const PRODUCT_RETURNING_TOOLS = new Set([
  'search_products',
  'list_offers',
  'get_todays_deals',
]);

const OFFER_SORT = {
  discount: { discount: -1, price: 1 },
  price: { price: 1 },
  newest: { createdAt: -1 },
};

function promotionTypeLabel(type, isAr) {
  const row = PROMOTION_TYPES.find((item) => item.value === type);
  if (!row) return type;
  return isAr ? row.labelAr : row.labelEn;
}

function activeBannerScheduleFilter(now = new Date()) {
  return {
    $or: [
      { startsAt: null, endsAt: null },
      { startsAt: null, endsAt: { $gte: now } },
      { startsAt: { $lte: now }, endsAt: null },
      { startsAt: { $lte: now }, endsAt: { $gte: now } },
    ],
  };
}

export function compactProduct(product) {
  const formatted = formatProduct(product);
  const stock = getAvailableStock(product);
  return {
    _id: formatted._id,
    slug: formatted.slug,
    nameAr: formatted.nameAr,
    nameEn: formatted.nameEn,
    price: formatted.price,
    oldPrice: formatted.oldPrice || null,
    discount: formatted.discount || null,
    image: formatted.image || formatted.images?.[0] || null,
    emoji: formatted.emoji || null,
    inStock: stock == null ? true : stock > 0,
    stock: stock == null ? null : stock,
    isOffer: Boolean(formatted.isOffer),
    offerBadgeAr: formatted.offerBadgeAr || null,
    offerBadgeEn: formatted.offerBadgeEn || null,
    promotionType: formatted.promotionType || null,
  };
}

async function loadStoreSettings() {
  return StoreSettings.findOne({ key: SETTINGS_KEY })
    .select(
      'storeNameAr storeNameEn supportPhone supportEmail whatsappUrl deliveryPromiseAr deliveryPromiseEn freeDeliveryThreshold freeDeliveryEnabled currency paymentMethods loyalty customerService',
    )
    .lean();
}

export async function toolSearchProducts({ query, limit = 5 }) {
  const q = String(query || '').trim();
  if (q.length < 2) return { products: [], total: 0 };

  const max = Math.min(Math.max(Number(limit) || 5, 1), 8);
  const baseFilter = { isActive: true };
  const { filter, useTextScore, rankedIds } = await resolveProductSearchFilter(baseFilter, q, Product, Category);

  let products;
  let total;
  if (rankedIds) {
    ({ products, total } = await fetchRankedProducts(Product, filter, rankedIds, { limit: max, lean: true }));
  } else {
    const productQuery = Product.find(filter).limit(max);
    productQuery.sort(useTextScore ? { score: { $meta: 'textScore' } } : { soldCount: -1, rating: -1 });
    [products, total] = await Promise.all([
      productQuery.lean(),
      Product.countDocuments(filter),
    ]);
  }

  return {
    query: q,
    total,
    products: products.map(compactProduct),
  };
}

export async function toolListOffers({ limit = 8, sort = 'discount' } = {}) {
  await syncTimedPromotionLifecycles();
  const max = Math.min(Math.max(Number(limit) || 8, 1), 8);
  const sortKey = OFFER_SORT[sort] ? sort : 'discount';
  const filter = buildOffersProductFilter();

  const [products, total] = await Promise.all([
    Product.find(filter).sort(OFFER_SORT[sortKey]).limit(max).lean(),
    Product.countDocuments(filter),
  ]);

  return {
    total,
    sort: sortKey,
    products: products.map(compactProduct),
  };
}

export async function toolGetTodaysDeals({ limit = 8 } = {}) {
  await syncTimedPromotionLifecycles();
  const max = Math.min(Math.max(Number(limit) || 8, 1), 8);
  const result = await productsFromActiveLimitedPromotions({ limit: max, sort: 'discount', page: 1 });
  const promotions = await findActiveLimitedPromotions();

  return {
    total: result.total,
    countdownEnd: result.countdownEnd?.toISOString?.() || null,
    promotionCount: promotions.length,
    promotions: promotions.slice(0, 5).map((promo) => ({
      nameAr: promo.nameAr,
      nameEn: promo.nameEn,
      type: promo.type,
      endsAt: promo.endsAt,
      badgeAr: promo.badgeAr || null,
      badgeEn: promo.badgeEn || null,
    })),
    products: (result.products || []).map((p) => compactProduct(p)),
  };
}

export async function toolGetActivePromotions({ limit = 8 } = {}) {
  await syncTimedPromotionLifecycles();
  const now = new Date();
  const max = Math.min(Math.max(Number(limit) || 8, 1), 12);
  const rows = await Promotion.find({
    isActive: { $ne: false },
    $or: [{ endsAt: null }, { endsAt: { $gte: now } }],
  })
    .sort({ priority: -1, endsAt: 1 })
    .limit(max * 2);

  const active = rows.filter((row) => {
    const status = row.resolveStatus?.(now);
    return status === 'active' || status === 'scheduled';
  }).slice(0, max);

  const promotions = await Promise.all(
    active.map(async (promo) => {
      const productCount = await Product.countDocuments({ activePromotionId: promo._id, isActive: true });
      const formatted = formatPromotion(promo, { productCount });
      return {
        nameAr: formatted.nameAr,
        nameEn: formatted.nameEn,
        type: formatted.type,
        typeLabelAr: promotionTypeLabel(formatted.type, true),
        typeLabelEn: promotionTypeLabel(formatted.type, false),
        badgeAr: formatted.badgeAr,
        badgeEn: formatted.badgeEn,
        startsAt: formatted.startsAt,
        endsAt: formatted.endsAt,
        status: formatted.status,
        productCount,
      };
    }),
  );

  return { total: promotions.length, promotions };
}

export async function toolBrowseCategories({ parentSlug = null, depth = 2 } = {}) {
  const all = await Category.find({ isActive: true })
    .select('slug nameAr nameEn parentCategory sortOrder')
    .sort({ sortOrder: 1, nameEn: 1 })
    .lean();

  const nested = buildNestedCategoryTree(all);
  const maxDepth = Math.min(Math.max(Number(depth) || 2, 1), 3);

  const toNode = (node, level = 1) => ({
    ...formatCategory(node.category),
    children: level < maxDepth ? node.children.map((child) => toNode(child, level + 1)) : [],
  });

  const findNode = (nodes, slug) => {
    for (const node of nodes) {
      const formatted = formatCategory(node.category);
      if (formatted.slug === slug) return toNode(node);
      const childMatch = findNode(node.children, slug);
      if (childMatch) return childMatch;
    }
    return null;
  };

  if (parentSlug) {
    const match = findNode(nested, String(parentSlug).trim());
    if (!match) return { category: null, children: [], message: 'Category not found' };
    return {
      category: { slug: match.slug, nameAr: match.nameAr, nameEn: match.nameEn },
      children: match.children,
    };
  }

  const tree = nested.map((node) => toNode(node));
  return { total: tree.length, categories: tree };
}

export async function toolGetProductDetails({ slug, productId }) {
  const filter = { isActive: true };
  if (productId) filter._id = productId;
  else if (slug) filter.slug = String(slug).trim();
  else return { error: 'missing_identifier', message: 'slug or productId is required' };

  const product = await Product.findOne(filter)
    .populate('category', 'slug nameAr nameEn')
    .lean();
  if (!product) return { product: null };

  const formatted = formatProduct(product);
  const stock = getAvailableStock(product);
  return {
    product: {
      ...compactProduct(product),
      descriptionAr: formatted.descriptionAr,
      descriptionEn: formatted.descriptionEn,
      brand: formatted.brand,
      brandAr: formatted.brandAr,
      brandEn: formatted.brandEn,
      rating: formatted.rating,
      reviewCount: formatted.reviewCount,
      categorySlug: formatted.categorySlug,
      stock: stock == null ? null : stock,
    },
  };
}

export async function toolGetStoreInfo() {
  const settings = await loadStoreSettings();
  const loyalty = await getLoyaltySettings();
  const loyaltySummary = buildLoyaltySummary(loyalty, 'ar');

  return {
    storeNameAr: settings?.storeNameAr || 'MarketPlus',
    storeNameEn: settings?.storeNameEn || 'MarketPlus',
    deliveryPromiseAr: settings?.deliveryPromiseAr || null,
    deliveryPromiseEn: settings?.deliveryPromiseEn || null,
    freeDeliveryEnabled: settings?.freeDeliveryEnabled !== false,
    freeDeliveryThreshold: settings?.freeDeliveryThreshold ?? null,
    currency: settings?.currency || 'EGP',
    supportPhone: settings?.supportPhone || null,
    supportEmail: settings?.supportEmail || null,
    whatsappUrl: settings?.whatsappUrl || null,
    supportChannels: (settings?.customerService?.enabled === false ? [] : settings?.customerService?.channels || [])
      .filter((ch) => ch.enabled !== false)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((ch) => ({ type: ch.type, labelAr: ch.labelAr, labelEn: ch.labelEn })),
    paymentMethods: (settings?.paymentMethods || [])
      .filter((m) => m.isActive !== false)
      .map((m) => ({
        id: m.id,
        labelAr: m.labelAr,
        labelEn: m.labelEn,
      })),
    loyaltyEnabled: loyalty.enabled === true,
    loyaltyEarnDescriptionAr: loyaltySummary.earnDescription,
    loyaltyRedeemDescriptionAr: loyaltySummary.redeemDescription,
  };
}

export async function toolListDeliveryZones() {
  const zones = await listPublicDeliveryZones();
  return {
    total: zones.length,
    zones: zones.map((zone) => ({
      id: zone.id || zone._id,
      nameAr: zone.nameAr,
      nameEn: zone.nameEn,
      scheduledFee: zone.scheduledFee,
      expressFee: zone.expressFee,
      minimumOrder: zone.minimumOrder,
      freeDeliveryThreshold: zone.freeDeliveryThreshold,
      scheduledAvailable: zone.scheduledAvailable !== false,
      expressAvailable: zone.expressAvailable !== false,
      estimatedScheduled: zone.estimatedScheduled || null,
      estimatedExpress: zone.estimatedExpress || null,
    })),
  };
}

export async function toolListCoupons() {
  const coupons = await Coupon.find({ isActive: true, expiryDate: { $gt: new Date() } })
    .select('code discountType discountValue minSubtotal labelAr labelEn expiryDate usageLimit usedCount')
    .sort({ createdAt: -1 })
    .limit(12)
    .lean();

  return {
    total: coupons.length,
    coupons: coupons.map((coupon) => {
      const formatted = formatCoupon(coupon);
      return {
        code: formatted.code,
        labelAr: formatted.labelAr || coupon.labelAr,
        labelEn: formatted.labelEn || coupon.labelEn,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        minSubtotal: coupon.minSubtotal || 0,
        expiryDate: coupon.expiryDate,
      };
    }),
  };
}

export async function toolGetBanners({ placement = null } = {}) {
  const filter = {
    isActive: true,
    ...activeBannerScheduleFilter(),
    targetAudience: { $in: ['all'] },
  };
  if (placement) filter.placement = String(placement).trim();

  const banners = await Banner.find(filter)
    .sort({ priority: -1, sortOrder: 1, createdAt: -1 })
    .limit(8)
    .lean();

  return {
    total: banners.length,
    banners: banners.map((banner) => ({
      titleAr: banner.titleAr,
      titleEn: banner.titleEn,
      subtitleAr: banner.subtitleAr || null,
      subtitleEn: banner.subtitleEn || null,
      link: banner.link || '/offers',
      placement: banner.placement || null,
    })),
  };
}

export async function toolGetContentPage({ slug }) {
  const pageSlug = String(slug || '').trim().toLowerCase();
  if (!pageSlug) {
    return {
      error: 'missing_slug',
      availableSlugs: CONTENT_PAGE_SLUGS,
    };
  }

  const page = await ContentPage.findOne({ slug: pageSlug, isActive: true }).lean();
  if (!page) {
    return { error: 'not_found', availableSlugs: CONTENT_PAGE_SLUGS };
  }

  const sections = [...(page.sections || [])]
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    .map((section) => ({
      headingAr: section.headingAr || null,
      headingEn: section.headingEn || null,
      bodyAr: section.bodyAr || null,
      bodyEn: section.bodyEn || null,
    }));

  return {
    slug: page.slug,
    titleAr: page.titleAr,
    titleEn: page.titleEn,
    sections,
  };
}

export async function toolGetUserOrders(user, { limit = 5 } = {}) {
  if (!user?._id) {
    return { error: 'not_authenticated', message: 'User must sign in to view orders.' };
  }

  const max = Math.min(Math.max(Number(limit) || 5, 1), 8);
  const orders = await Order.find({ user: user._id })
    .sort({ createdAt: -1 })
    .limit(max)
    .lean();

  return {
    orders: orders.map((order) => {
      const formatted = formatOrder(order);
      return {
        _id: formatted._id,
        orderNumber: formatted.orderNumber,
        status: formatted.orderStatus || formatted.status,
        total: formatted.total || formatted.grandTotal,
        createdAt: formatted.createdAt,
      };
    }),
  };
}

export async function toolGetUserCart(user) {
  if (!user?._id) {
    return { error: 'not_authenticated', message: 'User must sign in to view cart.' };
  }

  let cart = await Cart.findOne({ user: user._id }).populate({
    path: 'items.product',
    select: 'nameAr nameEn slug price emoji isActive',
  });

  if (!cart) {
    return { itemCount: 0, items: [], subtotal: 0 };
  }

  const items = cart.items
    .map(formatCartItem)
    .filter(Boolean)
    .map((item) => ({
      nameAr: item.nameAr || item.name,
      nameEn: item.nameEn,
      quantity: item.quantity,
      price: item.price,
      lineTotal: Number(item.price || 0) * Number(item.quantity || 0),
    }));

  const subtotal = items.reduce((sum, item) => sum + (Number(item.lineTotal) || 0), 0);

  return {
    itemCount: items.reduce((sum, item) => sum + (item.quantity || 0), 0),
    uniqueItems: items.length,
    subtotal,
    items: items.slice(0, 8),
  };
}

export async function toolGetLoyaltyInfo(user) {
  if (!user?._id) {
    return { error: 'not_authenticated', message: 'User must sign in to view loyalty points.' };
  }

  const rules = await getLoyaltySettings();
  const summaryAr = buildLoyaltySummary(rules, 'ar');
  const summaryEn = buildLoyaltySummary(rules, 'en');
  const pointsBalance = user.pointsBalance || 0;

  return {
    enabled: rules.enabled === true,
    pointsBalance,
    cashbackValue: pointsToCashValue(pointsBalance, rules),
    earnDescriptionAr: summaryAr.earnDescription,
    earnDescriptionEn: summaryEn.earnDescription,
    redeemDescriptionAr: summaryAr.redeemDescription,
    redeemDescriptionEn: summaryEn.redeemDescription,
    minRedeemPoints: rules.minRedeemPoints,
  };
}

export async function runAssistantTool(name, args, user) {
  switch (name) {
    case 'search_products':
      return toolSearchProducts(args);
    case 'list_offers':
      return toolListOffers(args);
    case 'get_todays_deals':
      return toolGetTodaysDeals(args);
    case 'get_active_promotions':
      return toolGetActivePromotions(args);
    case 'browse_categories':
      return toolBrowseCategories(args);
    case 'get_product_details':
      return toolGetProductDetails(args);
    case 'get_store_info':
      return toolGetStoreInfo();
    case 'get_delivery_info':
      return toolGetStoreInfo();
    case 'list_delivery_zones':
      return toolListDeliveryZones();
    case 'list_coupons':
      return toolListCoupons();
    case 'get_banners':
      return toolGetBanners(args);
    case 'get_content_page':
      return toolGetContentPage(args);
    case 'get_user_orders':
      return toolGetUserOrders(user, args);
    case 'get_user_cart':
      return toolGetUserCart(user);
    case 'get_loyalty_info':
      return toolGetLoyaltyInfo(user);
    default:
      return { error: 'unknown_tool', message: `Unknown tool: ${name}` };
  }
}
