export const formatCategory = (cat) => ({
  _id: cat._id,
  slug: cat.slug,
  nameAr: cat.nameAr,
  nameEn: cat.nameEn,
  name: cat.nameAr,
  image: cat.image,
  cloudinaryPublicId: cat.cloudinaryPublicId,
  parentCategory: cat.parentCategory,
  icon: cat.icon,
  color: cat.color,
  sortOrder: cat.sortOrder,
  isActive: cat.isActive,
});

export const formatProduct = (product) => {
  const categorySlug = product.category?.slug
    || (typeof product.category === 'object' && product.category?.slug)
    || product._categorySlug;

  return {
    _id: product._id,
    slug: product.slug,
    name: product.nameAr,
    nameAr: product.nameAr,
    nameEn: product.nameEn,
    description: product.descriptionAr,
    descriptionAr: product.descriptionAr,
    descriptionEn: product.descriptionEn,
    price: product.price,
    wholesalePrice: product.wholesalePrice ?? 0,
    compareAtPrice: product.oldPrice,
    oldPrice: product.oldPrice,
    discount: product.discount,
    discountPercent: product.discount || 0,
    category: categorySlug,
    categorySlug,
    categoryId: product.category?._id || product.category,
    subCategory: product.subCategory?._id || product.subCategory,
    brand: product.brand,
    stock: product.stock,
    inStock: product.stock > 0,
    unit: product.unit,
    images: product.images?.length ? product.images : (product.emoji ? [product.emoji] : []),
    image: product.images?.[0] || product.emoji,
    cloudinaryPublicIds: product.cloudinaryPublicIds || [],
    emoji: product.emoji,
    rating: product.rating,
    reviews: product.reviews || [],
    isOffer: product.isOffer,
    isFeatured: product.isFeatured,
    isNew: product.isFeatured,
    isBestSeller: product.soldCount >= 200,
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

  return {
    productId: product._id.toString(),
    slug: product.slug,
    name: product.nameAr,
    nameAr: product.nameAr,
    nameEn: product.nameEn,
    price: product.price,
    emoji: product.emoji,
    unit: product.unit,
    quantity: item.quantity,
  };
};

export const formatCoupon = (coupon) => ({
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

export const formatOrder = (order) => ({
  ...order.toObject?.() ?? order,
  status: order.orderStatus,
  discountAmount: order.discount,
  discountCode: order.couponCode,
});
