export const getDiscountPercent = (product) => {
  if (!product?.compareAtPrice || product.compareAtPrice <= product.price) return 0;
  return Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100);
};

export const getProductBadges = (product, language = 'ar') => {
  const badges = [];
  if (product.isOffer || getDiscountPercent(product) > 0) {
    badges.push({ key: 'offer', labelAr: 'عرض', labelEn: 'Offer', color: 'bg-red-500 text-white' });
  }
  if (product.isNew) {
    badges.push({ key: 'new', labelAr: 'جديد', labelEn: 'New', color: 'bg-blue-500 text-white' });
  }
  if (product.isBestSeller) {
    badges.push({ key: 'bestseller', labelAr: 'الأكثر مبيعاً', labelEn: 'Best Seller', color: 'bg-amber-500 text-white' });
  }
  return badges.map((b) => ({
    ...b,
    label: language === 'ar' ? b.labelAr : b.labelEn,
  }));
};

export const getStockStatus = (product, language = 'ar') => {
  if (!product.inStock && product.stock !== undefined && product.stock <= 0) {
    return { key: 'out', label: language === 'ar' ? 'غير متوفر' : 'Out of Stock', color: 'text-red-600' };
  }
  if (product.stock > 0 && product.stock <= 10) {
    return { key: 'low', label: language === 'ar' ? `باقي ${product.stock} فقط` : `Only ${product.stock} left`, color: 'text-amber-600' };
  }
  return { key: 'in', label: language === 'ar' ? 'متوفر' : 'In Stock', color: 'text-primary-600' };
};

export const filterProductsMock = (products, params = {}) => {
  let result = [...products];

  if (params.category) result = result.filter((p) => (p.categorySlug || p.category) === params.category);
  if (params.brand) result = result.filter((p) => p.brand === params.brand);
  if (params.offers === 'true' || params.offers === true) {
    result = result.filter((p) => p.isOffer || getDiscountPercent(p) > 0);
  }
  if (params.minPrice) result = result.filter((p) => p.price >= Number(params.minPrice));
  if (params.maxPrice) result = result.filter((p) => p.price <= Number(params.maxPrice));
  if (params.minRating) result = result.filter((p) => (p.rating || 0) >= Number(params.minRating));
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
