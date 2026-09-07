import { resolveProductLine, getAvailableStock } from './productCatalog.js';
import { computeProductRating, getApprovedReviews } from './productRating.js';

export const formatCategory = (cat) => {
  const parent = cat.parentCategory;
  const parentObj = parent && typeof parent === 'object' && parent._id ? parent : null;
  return {
  _id: cat._id,
  slug: cat.slug,
  nameAr: cat.nameAr,
  nameEn: cat.nameEn,
  name: cat.nameAr,
  image: cat.image,
  cloudinaryPublicId: cat.cloudinaryPublicId,
  parentCategory: parentObj
    ? {
      _id: parentObj._id,
      slug: parentObj.slug,
      nameAr: parentObj.nameAr,
      nameEn: parentObj.nameEn,
      ...(parentObj.parentCategory && typeof parentObj.parentCategory === 'object' && parentObj.parentCategory._id
        ? {
          parentCategory: {
            _id: parentObj.parentCategory._id,
            slug: parentObj.parentCategory.slug,
            nameAr: parentObj.parentCategory.nameAr,
            nameEn: parentObj.parentCategory.nameEn,
          },
        }
        : {}),
    }
    : (parent || null),
  parentSlug: parentObj?.slug || null,
  level: cat.level || (parentObj || parent ? 2 : 1),
  icon: cat.icon,
  color: cat.color,
  sortOrder: cat.sortOrder,
  isActive: cat.isActive,
};
};

export const formatProduct = (product) => {
  const categorySlug = product.category?.slug
    || (typeof product.category === 'object' && product.category?.slug)
    || product._categorySlug;
  const approvedReviews = getApprovedReviews(product)
    .slice()
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  const computedRating = computeProductRating(product);
  const storedRating = Number(product.rating) || 0;
  const rating = computedRating > 0 ? computedRating : storedRating;
  const ratingDistribution = [5, 4, 3, 2, 1].map((rating) => ({
    rating,
    count: approvedReviews.filter((review) => Number(review.rating) === rating).length,
  }));

  const line = resolveProductLine(product);
  const variants = (product.variants || []).map((v) => ({
    _id: v._id,
    type: v.type,
    valueAr: v.valueAr,
    valueEn: v.valueEn,
    sku: v.sku,
    barcode: v.barcode,
    price: v.price ?? product.price,
    wholesalePrice: v.wholesalePrice ?? product.wholesalePrice ?? 0,
    oldPrice: v.oldPrice ?? product.oldPrice,
    stock: v.stock ?? 0,
    availableStock: Math.max(0, (v.stock || 0) - (v.reservedStock || 0)),
    isDefault: v.isDefault === true,
  }));

  return {
    _id: product._id,
    slug: product.slug,
    sku: product.sku,
    barcode: product.barcode,
    name: product.nameAr,
    nameAr: product.nameAr,
    nameEn: product.nameEn,
    description: product.descriptionAr,
    descriptionAr: product.descriptionAr,
    descriptionEn: product.descriptionEn,
    price: line?.price ?? product.price,
    wholesalePrice: line?.wholesalePrice ?? product.wholesalePrice ?? 0,
    compareAtPrice: line?.oldPrice ?? product.oldPrice,
    oldPrice: product.oldPrice,
    discount: product.discount,
    discountPercent: product.discount || 0,
    category: categorySlug,
    categorySlug,
    categoryId: product.category?._id || product.category,
    mainCategory: product.mainCategory?._id || product.mainCategory,
    mainCategorySlug: product.mainCategory?.slug || product._mainCategorySlug || null,
    subCategory: product.subCategory?._id || product.subCategory,
    subCategorySlug: product.subCategory?.slug || product._subCategorySlug || null,
    brand: product.brand,
    brandAr: product.brandAr || '',
    brandEn: product.brandEn || product.brand || '',
    size: product.size || '',
    unitAr: product.unitAr || product.unit || '',
    unitEn: product.unitEn || product.unit || '',
    searchKeywordsAr: product.searchKeywordsAr || [],
    searchKeywordsEn: product.searchKeywordsEn || [],
    stock: product.stock,
    availableStock: product.availableStock ?? getAvailableStock(line),
    inStock: product.inStock ?? getAvailableStock(line) > 0,
    hasVariants: variants.length > 0,
    variants,
    specs: (product.specs || []).map((s) => ({
      keyAr: s.keyAr,
      keyEn: s.keyEn,
      valueAr: s.valueAr,
      valueEn: s.valueEn,
    })),
    frequentlyBoughtTogether: product.frequentlyBoughtTogether?.map((p) =>
      (p?._id ? p._id : p),
    ) || [],
    similarProducts: product.similarProducts?.map((p) =>
      (p?._id ? p._id : p),
    ) || [],
    relatedProducts: product._relatedProducts || [],
    frequentlyBoughtTogetherProducts: product._fbtProducts || [],
    unit: product.unit,
    images: product.images?.length ? product.images : (product.emoji ? [product.emoji] : []),
    image: (() => {
      const types = product.mediaTypes || [];
      const imgs = product.images || [];
      for (let i = 0; i < imgs.length; i += 1) {
        if (types[i] !== 'video' && imgs[i]) return imgs[i];
      }
      return product.emoji;
    })(),
    cloudinaryPublicIds: product.cloudinaryPublicIds || [],
    mediaTypes: product.mediaTypes || [],
    emoji: product.emoji,
    rating,
    reviews: approvedReviews.map((review) => ({
      _id: review._id,
      user: review.user?._id || review.user,
      userName: review.user?.name || 'Verified customer',
      rating: review.rating,
      title: review.title || '',
      comment: review.comment,
      verifiedPurchase: review.verifiedPurchase === true,
      pinned: review.pinned === true,
      featured: review.featured === true,
      adminReply: review.adminReply?.message
        ? {
          message: review.adminReply.message,
          repliedAt: review.adminReply.repliedAt,
          adminName: review.adminReply.repliedBy?.name || null,
        }
        : null,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
    })),
    reviewCount: approvedReviews.length,
    ratingDistribution,
    isOffer: product.isOffer,
    isFeatured: product.isFeatured,
    isNew: product.isFeatured,
    activePromotionId: product.activePromotionId || null,
    promotionType: product.promotionType || null,
    offerBadgeAr: product.offerBadgeAr || null,
    offerBadgeEn: product.offerBadgeEn || null,
    promotionBuyQty: product.promotionBuyQty || null,
    promotionGetQty: product.promotionGetQty || null,
    promotionUnit: product.promotionUnit || 'pieces',
    promotionSecondPercentOff: product.promotionSecondPercentOff || null,
    promotionCartLineAr: product.promotionCartLineAr || null,
    promotionCartLineEn: product.promotionCartLineEn || null,
    promotionCartProgressAr: product.promotionCartProgressAr || null,
    promotionCartProgressEn: product.promotionCartProgressEn || null,
    promotionCartSubtextAr: product.promotionCartSubtextAr ?? null,
    promotionCartSubtextEn: product.promotionCartSubtextEn ?? null,
    offerActive: product.offerActive !== false,
    isBestSeller: product.isBestSeller || false,
    isOurProduct: product.isOurProduct || false,
    soldCount: product.soldCount,
    isActive: product.isActive,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    stockUpdatedAt: product.stockUpdatedAt,
    stockHistory: product.stockHistory || [],
  };
};

export const formatCartItem = (item) => {
  const product = item.product;
  if (!product || typeof product !== 'object') return null;

  const line = resolveProductLine(product, item.variantId);

  return {
    productId: product._id.toString(),
    variantId: item.variantId?.toString() || line?.variantId?.toString() || null,
    cartKey: `${product._id}:${item.variantId || line?.variantId || ''}`,
    slug: product.slug,
    name: product.nameAr,
    nameAr: product.nameAr,
    nameEn: product.nameEn,
    variantLabelAr: line?.labelAr || item.variantLabelAr,
    variantLabelEn: line?.labelEn || item.variantLabelEn,
    sku: line?.sku || product.sku,
    price: line?.price ?? product.price,
    oldPrice: line?.oldPrice ?? product.oldPrice ?? null,
    compareAtPrice: line?.oldPrice ?? product.oldPrice ?? null,
    discount: product.discount ?? null,
    discountPercent: product.discount || 0,
    isOffer: product.isOffer === true,
    activePromotionId: product.activePromotionId || null,
    emoji: product.emoji,
    image: line?.image || product.images?.[0] || product.emoji,
    unit: product.unit,
    quantity: item.quantity,
    availableStock: getAvailableStock(line),
    promotionType: product.promotionType || null,
    offerBadgeAr: product.offerBadgeAr || null,
    offerBadgeEn: product.offerBadgeEn || null,
    promotionBuyQty: product.promotionBuyQty || null,
    promotionGetQty: product.promotionGetQty || null,
    promotionUnit: product.promotionUnit || 'pieces',
    promotionSecondPercentOff: product.promotionSecondPercentOff || null,
    promotionCartLineAr: product.promotionCartLineAr || null,
    promotionCartLineEn: product.promotionCartLineEn || null,
    promotionCartProgressAr: product.promotionCartProgressAr || null,
    promotionCartProgressEn: product.promotionCartProgressEn || null,
    promotionCartSubtextAr: product.promotionCartSubtextAr ?? null,
    promotionCartSubtextEn: product.promotionCartSubtextEn ?? null,
  };
};

export const formatCoupon = (coupon) => ({
  _id: coupon._id,
  code: coupon.code,
  type: coupon.discountType,
  discountType: coupon.discountType,
  value: coupon.discountValue,
  discountValue: coupon.discountValue,
  minSubtotal: coupon.minSubtotal || 0,
  labelAr: coupon.labelAr,
  labelEn: coupon.labelEn,
  expiryDate: coupon.expiryDate,
  usageLimit: coupon.usageLimit,
  isActive: coupon.isActive,
});

export const formatOrder = (order) => {
  const raw = order.toObject?.() ?? order;
  return {
    ...raw,
    status: order.orderStatus,
    discountAmount: order.discount,
    discountCode: order.couponCode,
    pointsRedeemed: order.pointsRedeemed || 0,
    pointsDiscount: order.pointsDiscount || 0,
    pointsEarned: order.pointsEarned || 0,
    deliveryZoneNameAr: order.deliveryZoneNameAr,
    deliveryZoneNameEn: order.deliveryZoneNameEn,
    deliveryTimeSlot: order.deliveryTimeSlot,
    items: (raw.items || []).map((item) => ({
      ...item,
      productId: item.product?._id || item.product || item.productId || null,
      product: item.product?._id || item.product || item.productId || null,
    })),
  };
};
