import { getDescendantsUnderRoot } from './categoryHelpers';
import {
  buildQtyPromoBadge,
  buildQtyPromoSubtitle,
  buildSecondItemBadge,
  buildSecondItemSubtitle,
  isQtyPromoType,
  qtyPromoFromProduct,
  secondItemPromoFromProduct,
} from './promotionDisplay';

export const getDiscountPercent = (product) => {
  if (product?.discountPercent > 0) return Math.round(Number(product.discountPercent));
  if (product?.discount > 0) return Math.round(Number(product.discount));
  if (!product?.compareAtPrice || product.compareAtPrice <= product.price) return 0;
  return Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100);
};

const PROMOTION_BADGE_STYLES = {
  bogo: 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white',
  buy_x_get_y: 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white',
  second_percent_off: 'bg-amber-500 text-white',
  bundle: 'bg-teal-600 text-white',
  percent_off: 'bg-red-600 text-white',
  amount_off: 'bg-red-600 text-white',
  fixed_price: 'bg-red-600 text-white',
};

const PROMOTION_SUBLABELS = {
  bundle: { ar: 'باقة بسعر خاص', en: 'Bundle deal' },
};

/** Highlight badge for cards / PDP (discount % or promotion label like 1+1). */
export function getPromotionHighlight(product, language = 'ar') {
  if (!product || product.offerActive === false) return null;

  const isAr = language === 'ar';
  const discount = getDiscountPercent(product);
  const hasManagedPromotion = Boolean(product.activePromotionId || product.promotionType);
  const type = product.promotionType || null;

  if (hasManagedPromotion || (product.isOffer && (product.offerBadgeAr || product.offerBadgeEn))) {
    const { buy, get, unit } = qtyPromoFromProduct(product);
    let label = isAr
      ? (product.offerBadgeAr || product.offerBadgeEn || 'عرض')
      : (product.offerBadgeEn || product.offerBadgeAr || 'Offer');
    if (isQtyPromoType(type)) {
      label = product.offerBadgeAr && isAr
        ? product.offerBadgeAr
        : (product.offerBadgeEn && !isAr ? product.offerBadgeEn : buildQtyPromoBadge(buy, get, unit, isAr));
    } else if (type === 'second_percent_off') {
      const pct = secondItemPromoFromProduct(product);
      label = product.offerBadgeAr && isAr
        ? product.offerBadgeAr
        : (product.offerBadgeEn && !isAr ? product.offerBadgeEn : buildSecondItemBadge(pct, isAr, unit));
    }
    const sublabel = isQtyPromoType(type)
      ? buildQtyPromoSubtitle(buy, get, unit, isAr)
      : type === 'second_percent_off'
        ? buildSecondItemSubtitle(secondItemPromoFromProduct(product), unit, isAr)
        : (PROMOTION_SUBLABELS[type] ? (isAr ? PROMOTION_SUBLABELS[type].ar : PROMOTION_SUBLABELS[type].en) : null);
    return {
      kind: 'promotion',
      type,
      label,
      icon: isQtyPromoType(type) ? '🎁' : type === 'second_percent_off' ? '2️⃣' : type === 'bundle' ? '📦' : null,
      className: PROMOTION_BADGE_STYLES[type] || 'bg-orange-600 text-white',
      sublabel,
      showRibbon: isQtyPromoType(type) || type === 'second_percent_off',
      secondPercentOff: type === 'second_percent_off' ? secondItemPromoFromProduct(product) : null,
    };
  }

  if (discount > 0) {
    return {
      kind: 'discount',
      label: isAr ? `-${discount}%` : `-${discount}%`,
      className: 'bg-red-600 text-white',
    };
  }

  return null;
};

export const getProductBadges = (product, language = 'ar') => {
  const badges = [];
  const highlight = getPromotionHighlight(product, language);
  if ((product.isOffer || getDiscountPercent(product) > 0) && !highlight) {
    badges.push({ key: 'offer', labelAr: 'عرض', labelEn: 'Offer', color: 'bg-red-500 text-white' });
  }
  if (product.isNew) {
    badges.push({ key: 'new', labelAr: 'وصل حديثا', labelEn: 'New', color: 'bg-blue-500 text-white' });
  }
  if (product.isBestSeller) {
    badges.push({ key: 'bestseller', labelAr: 'الأكثر مبيعا', labelEn: 'Best Seller', color: 'bg-amber-500 text-white' });
  }
  return badges.map((b) => ({
    ...b,
    label: language === 'ar' ? b.labelAr : b.labelEn,
  }));
};

export const getStockStatus = (product, language = 'ar', options = {}) => {
  const {
    lowStockThreshold = 10,
    lowStockEnabled = true,
    lowStockMessageAr,
    lowStockMessageEn,
  } = options;

  const available = getProductAvailableStock(product);
  const stock = available ?? product.stock;

  if (!product.inStock && stock !== undefined && stock <= 0) {
    return { key: 'out', label: language === 'ar' ? 'غير متوفر' : 'Out of stock', color: 'text-red-600' };
  }

  if (
    lowStockEnabled !== false
    && stock > 0
    && stock <= (Number(lowStockThreshold) || 10)
  ) {
    return {
      key: 'low',
      label: formatLowStockMessage(stock, language, { lowStockMessageAr, lowStockMessageEn }),
      color: 'text-amber-600',
    };
  }

  return { key: 'in', label: language === 'ar' ? 'متوفر' : 'In stock', color: 'text-primary-600' };
};

export function formatLowStockMessage(stock, language = 'ar', settings = {}) {
  const qty = String(stock ?? 0);
  const template = language === 'ar'
    ? (settings.lowStockMessageAr || 'باقي {{qty}} فقط')
    : (settings.lowStockMessageEn || 'Only {{qty}} left');
  return template.replace(/\{\{\s*qty\s*\}\}/g, qty);
}

export function shouldShowLowStockAlert(stock, settings = {}) {
  if (settings.lowStockAlertEnabled === false) return false;
  const threshold = Number(settings.lowStockAlertThreshold);
  const limit = Number.isFinite(threshold) && threshold > 0 ? threshold : 10;
  return stock != null && stock > 0 && stock <= limit;
}

/** Sellable quantity for a product line (respects variants + reserved stock). */
export function getProductAvailableStock(product, variantId = null) {
  if (!product) return null;

  const variants = product.variants || [];
  if (variantId && variants.length) {
    const variant = variants.find((v) => String(v._id) === String(variantId));
    if (!variant) return null;
    const raw = variant.availableStock ?? variant.stock;
    return Number.isFinite(Number(raw)) ? Math.max(0, Number(raw)) : null;
  }

  if (variants.length) {
    const def = variants.find((v) => v.isDefault) || variants[0];
    const raw = def?.availableStock ?? def?.stock;
    return Number.isFinite(Number(raw)) ? Math.max(0, Number(raw)) : null;
  }

  const raw = product.availableStock ?? product.stock;
  return Number.isFinite(Number(raw)) ? Math.max(0, Number(raw)) : null;
}

export function clampQuantityToStock(quantity, maxStock) {
  const qty = Math.max(0, Number(quantity) || 0);
  if (maxStock == null || !Number.isFinite(maxStock)) return qty;
  return Math.min(qty, Math.max(0, maxStock));
}

export const buildMockProductFilters = (products, categories, params = {}) => {
  const mains = categories.filter((c) => !c.parentSlug && !c.parentCategory);
  const countFor = (extra = {}) => {
    const p = { ...params, ...extra };
    return filterProductsMock(products, { ...p, page: 1, limit: 99999 }).pagination.total;
  };

  const mainCategories = mains.map((main) => ({
    ...main,
    count: countFor({ mainCategory: main.slug, subCategory: '', category: '' }),
  }));

  let subcategories = [];
  const mainSlug = params.mainCategory || params.main;
  if (mainSlug) {
    subcategories = getDescendantsUnderRoot(categories, mainSlug).map((sub) => ({
      ...sub,
      count: countFor({ subCategory: sub.slug, mainCategory: '', category: '' }),
    }));
  }

  const matched = filterProductsMock(products, { ...params, page: 1, limit: 99999 }).data;
  const brandMap = new Map();
  matched.forEach((p) => {
    if (!p.brand) return;
    brandMap.set(p.brand, (brandMap.get(p.brand) || 0) + 1);
  });
  const brands = [...brandMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));

  const prices = matched.map((p) => p.price).filter((n) => Number.isFinite(n));
  const priceRange = prices.length
    ? { minPrice: Math.min(...prices), maxPrice: Math.max(...prices) }
    : { minPrice: 0, maxPrice: 0 };

  const sourceDefs = [
    { id: 'all', labelAr: 'كل المنتجات', labelEn: 'All products' },
    { id: 'our_products', labelAr: 'منتجاتنا', labelEn: 'Our products' },
    { id: 'offers', labelAr: 'عروض وخصومات', labelEn: 'Offers & discounts' },
    { id: 'best_sellers', labelAr: 'الأكثر مبيعاً', labelEn: 'Best sellers' },
    { id: 'new_arrivals', labelAr: 'وصل حديثاً', labelEn: 'New arrivals' },
  ];
  const productSources = sourceDefs.map((row) => ({
    ...row,
    count: countFor({ ...params, productSource: row.id === 'all' ? '' : row.id }),
  }));

  return {
    mainCategories,
    subcategories,
    categories: mainCategories,
    brands,
    priceRange,
    totalMatching: countFor(),
    totalAllCategories: countFor({ mainCategory: '', subCategory: '', category: '' }),
    productSources,
  };
};

export const filterProductsMock = (products, params = {}) => {
  let result = [...products];

  if (params.subCategory) {
    result = result.filter((p) => (p.categorySlug || p.category) === params.subCategory);
  } else if (params.mainCategory) {
    result = result.filter((p) => p.mainCategorySlug === params.mainCategory);
  } else if (params.category) {
    result = result.filter((p) => (p.categorySlug || p.category) === params.category);
  }
  if (params.brand) result = result.filter((p) => p.brand === params.brand);
  if (params.productSource === 'our_products') {
    result = result.filter((p) => p.isOurProduct === true);
  } else if (params.productSource === 'best_sellers') {
    // Ranked by soldCount when sort=best-selling is applied.
  } else if (params.productSource === 'new_arrivals') {
    result = result.filter((p) => p.isNew || p.isFeatured);
  } else if (params.productSource === 'offers') {
    result = result.filter((p) => p.isOffer || getDiscountPercent(p) > 0);
  }
  if (params.offers === 'true' || params.offers === true) {
    result = result.filter((p) => p.isOffer || getDiscountPercent(p) > 0);
  }
  if (params.section === 'new-arrivals') {
    result = result.filter((p) => p.isNew || p.isFeatured);
  }
  if (params.section === 'best-sellers' && !params.sort) {
    params.sort = 'best-selling';
  }
  if (params.productSource === 'best_sellers' && !params.sort) {
    params.sort = 'best-selling';
  }
  if (params.minPrice) result = result.filter((p) => p.price >= Number(params.minPrice));
  if (params.maxPrice) result = result.filter((p) => p.price <= Number(params.maxPrice));
  if (params.minRating) result = result.filter((p) => (p.rating || 0) >= Number(params.minRating));
  if (params.inStock === 'true') {
    result = result.filter((p) => p.inStock !== false && (p.stock === undefined || p.stock > 0));
  }
  if (params.q) {
    const q = params.q.toLowerCase();
    const qRaw = params.q.trim();
    result = result.filter(
      (p) =>
        p.name?.includes(qRaw)
        || p.nameEn?.toLowerCase().includes(q)
        || p.slug?.toLowerCase().includes(q)
        || p.brand?.toLowerCase().includes(q),
    );
  }

  switch (params.sort) {
    case 'price-low': result.sort((a, b) => a.price - b.price); break;
    case 'price-high': result.sort((a, b) => b.price - a.price); break;
    case 'newest': result.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)); break;
    case 'best-selling': result.sort((a, b) => (b.soldCount || 0) - (a.soldCount || 0)); break;
    case 'discount': result.sort((a, b) => getDiscountPercent(b) - getDiscountPercent(a)); break;
    case 'top': result.sort((a, b) => (b.rating || 0) - (a.rating || 0)); break;
    default: break;
  }

  const page = Number(params.page) || 1;
  const limit = Number(params.limit) || 24;
  const total = result.length;
  const start = (page - 1) * limit;

  return {
    data: result.slice(start, start + limit),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
};
