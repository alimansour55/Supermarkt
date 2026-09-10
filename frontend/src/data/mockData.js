export const DELIVERY_LOCATIONS = [
  { id: 'cairo-helwan', nameAr: 'حلوان، القاهرة', nameEn: 'Helwan, Cairo', centerLat: 29.8453, centerLng: 31.3339 },
  { id: 'cairo-nasr', nameAr: 'مدينة نصر، القاهرة', nameEn: 'Nasr City, Cairo' },
  { id: 'cairo-maadi', nameAr: 'المعادي، القاهرة', nameEn: 'Maadi, Cairo' },
  { id: 'cairo-heliopolis', nameAr: 'مصر الجديدة، القاهرة', nameEn: 'Heliopolis, Cairo' },
  { id: 'giza-dokki', nameAr: 'الدقي، الجيزة', nameEn: 'Dokki, Giza' },
  { id: 'giza-6oct', nameAr: '6 أكتوبر، الجيزة', nameEn: '6th of October, Giza' },
  { id: 'alex-smouha', nameAr: 'سموحة، الإسكندرية', nameEn: 'Smouha, Alexandria' },
];

export const CATEGORIES = [
  // Tree 1: حفاضات
  { id: 'm1', slug: 'diapers', nameAr: 'حفاضات', nameEn: 'Diapers', icon: '👶', color: 'bg-yellow-100', level: 1 },
  { id: 's1', slug: 'pampers', nameAr: 'بامبرز', nameEn: 'Pampers', icon: '🍼', color: 'bg-amber-50', parentSlug: 'diapers', level: 2 },
  { id: 's2', slug: 'molfix', nameAr: 'مولفيكس', nameEn: 'Molfix', icon: '👶', color: 'bg-orange-50', parentSlug: 'diapers', level: 2 },
  { id: 's3', slug: 'fine-baby', nameAr: 'فاين بيبي', nameEn: 'Fine Baby', icon: '🧸', color: 'bg-pink-50', parentSlug: 'diapers', level: 2 },
  // Tree 2: منظفات
  { id: 'm2', slug: 'cleaning', nameAr: 'منظفات', nameEn: 'Cleaning', icon: '🧹', color: 'bg-purple-100', level: 1 },
  { id: 's4', slug: 'ariel', nameAr: 'أريال', nameEn: 'Ariel', icon: '🧺', color: 'bg-blue-50', parentSlug: 'cleaning', level: 2 },
  { id: 's5', slug: 'persil', nameAr: 'برسيل', nameEn: 'Persil', icon: '✨', color: 'bg-green-50', parentSlug: 'cleaning', level: 2 },
  { id: 's6', slug: 'dettol', nameAr: 'ديتول', nameEn: 'Dettol', icon: '🧴', color: 'bg-teal-50', parentSlug: 'cleaning', level: 2 },
  // Tree 3: مشروبات
  { id: 'm3', slug: 'beverages', nameAr: 'مشروبات', nameEn: 'Beverages', icon: '🥤', color: 'bg-cyan-100', level: 1 },
  { id: 's7', slug: 'soft-drinks', nameAr: 'مشروبات غازية', nameEn: 'Soft Drinks', icon: '🥤', color: 'bg-red-50', parentSlug: 'beverages', level: 2 },
  { id: 's8', slug: 'juices', nameAr: 'عصائر', nameEn: 'Juices', icon: '🍊', color: 'bg-orange-50', parentSlug: 'beverages', level: 2 },
  { id: 's9', slug: 'water', nameAr: 'مياه', nameEn: 'Water', icon: '💧', color: 'bg-sky-50', parentSlug: 'beverages', level: 2 },
];

export const HERO_SLIDES = [
  {
    id: 1,
    titleAr: 'عروض الأسبوع الكبيرة',
    titleEn: 'Big Weekly Deals',
    subtitleAr: 'خصومات تصل إلى 50% على آلاف المنتجات',
    subtitleEn: 'Up to 50% off on thousands of products',
    ctaAr: 'تسوق العروض',
    ctaEn: 'Shop Offers',
    link: '/offers',
    gradient: 'from-emerald-600 via-green-600 to-teal-700',
    emoji: '🛒',
  },
  {
    id: 2,
    titleAr: 'خضار وفواكه طازجة يومياً',
    titleEn: 'Fresh Produce Daily',
    subtitleAr: 'توصيل سريع من المزرعة إلى بابك',
    subtitleEn: 'Fast delivery from farm to your door',
    ctaAr: 'اطلب الآن',
    ctaEn: 'Order Now',
    link: '/category/diapers',
    gradient: 'from-lime-600 via-green-600 to-emerald-700',
    emoji: '🥬',
  },
  {
    id: 3,
    titleAr: 'توصيل مجاني للطلبات فوق 500 ج.م',
    titleEn: 'Free Delivery Over 500 EGP',
    subtitleAr: 'استمتع بالتسوق بدون رسوم توصيل',
    subtitleEn: 'Shop without delivery fees',
    ctaAr: 'ابدأ التسوق',
    ctaEn: 'Start Shopping',
    link: '/products',
    gradient: 'from-amber-500 via-orange-500 to-red-500',
    emoji: '🚚',
  },
];

export const PROMO_BANNERS = [
  { id: 1, titleAr: 'حفاضات الأطفال', titleEn: 'Baby Diapers', link: '/category/diapers', bg: 'bg-gradient-to-l from-amber-400 to-orange-500', emoji: '👶' },
  { id: 2, titleAr: 'منظفات المنزل', titleEn: 'Home Cleaning', link: '/category/cleaning', bg: 'bg-gradient-to-l from-purple-500 to-violet-600', emoji: '🧹' },
  { id: 3, titleAr: 'مشروبات منعشة', titleEn: 'Refreshing Drinks', link: '/category/beverages', bg: 'bg-gradient-to-l from-cyan-500 to-teal-600', emoji: '🥤' },
];

export const PRODUCTS = [
  { _id: 'p1', slug: 'pampers-pants-size-4', name: 'بامبرز بنطلون مقاس 4', nameEn: 'Pampers Pants Size 4', price: 289.99, compareAtPrice: 329.99, mainCategorySlug: 'diapers', category: 'pampers', categorySlug: 'pampers', brand: 'Pampers', sections: ['offers', 'top', 'baby'], emoji: '👶', unit: '52 حفاضة', rating: 4.9, stock: 45, inStock: true, isOffer: true, isFeatured: true },
  { _id: 'p2', slug: 'pampers-baby-dry-size-3', name: 'بامبرز بيبي دراي مقاس 3', nameEn: 'Pampers Baby Dry Size 3', price: 259.99, compareAtPrice: null, mainCategorySlug: 'diapers', category: 'pampers', categorySlug: 'pampers', brand: 'Pampers', sections: ['top', 'baby'], emoji: '🍼', unit: '58 حفاضة', rating: 4.8, stock: 38, inStock: true, isOffer: false, isFeatured: true },
  { _id: 'p3', slug: 'pampers-wipes-64', name: 'مناديل بامبرز', nameEn: 'Pampers Wipes 64', price: 55, compareAtPrice: 65, mainCategorySlug: 'diapers', category: 'pampers', categorySlug: 'pampers', brand: 'Pampers', sections: ['offers', 'baby'], emoji: '🧻', unit: '64 منديل', rating: 4.7, stock: 80, inStock: true, isOffer: true },
  { _id: 'p4', slug: 'molfix-size-5', name: 'مولفيكس مقاس 5', nameEn: 'Molfix Size 5', price: 219.99, compareAtPrice: 249.99, mainCategorySlug: 'diapers', category: 'molfix', categorySlug: 'molfix', brand: 'Molfix', sections: ['offers', 'baby'], emoji: '👶', unit: '48 حفاضة', rating: 4.6, stock: 52, inStock: true, isOffer: true },
  { _id: 'p5', slug: 'molfix-size-4', name: 'مولفيكس مقاس 4', nameEn: 'Molfix Size 4', price: 199.99, compareAtPrice: null, mainCategorySlug: 'diapers', category: 'molfix', categorySlug: 'molfix', brand: 'Molfix', sections: ['baby'], emoji: '👶', unit: '52 حفاضة', rating: 4.5, stock: 60, inStock: true, isOffer: false },
  { _id: 'p6', slug: 'fine-baby-size-4', name: 'فاين بيبي مقاس 4', nameEn: 'Fine Baby Size 4', price: 179.99, compareAtPrice: 199.99, mainCategorySlug: 'diapers', category: 'fine-baby', categorySlug: 'fine-baby', brand: 'Fine Baby', sections: ['offers', 'baby'], emoji: '👶', unit: '50 حفاضة', rating: 4.4, stock: 40, inStock: true, isOffer: true },
  { _id: 'p7', slug: 'ariel-gel-3kg', name: 'أريال جل غسيل 3 كجم', nameEn: 'Ariel Gel 3kg', price: 189.99, compareAtPrice: 219.99, mainCategorySlug: 'cleaning', category: 'ariel', categorySlug: 'ariel', brand: 'Ariel', sections: ['offers', 'top'], emoji: '🧺', unit: '3 كجم', rating: 4.6, stock: 55, inStock: true, isOffer: true, isFeatured: true },
  { _id: 'p8', slug: 'ariel-pods-15', name: 'أريال كapsules 15', nameEn: 'Ariel Pods 15 tabs', price: 249.99, compareAtPrice: null, mainCategorySlug: 'cleaning', category: 'ariel', categorySlug: 'ariel', brand: 'Ariel', sections: ['supermarket'], emoji: '✨', unit: '15 كapsule', rating: 4.8, stock: 30, inStock: true, isOffer: false },
  { _id: 'p9', slug: 'persil-powder-4kg', name: 'برسيل مسحوق 4 كجم', nameEn: 'Persil Powder 4kg', price: 169.99, compareAtPrice: 189.99, mainCategorySlug: 'cleaning', category: 'persil', categorySlug: 'persil', brand: 'Persil', sections: ['offers'], emoji: '🧺', unit: '4 كجم', rating: 4.5, stock: 44, inStock: true, isOffer: true },
  { _id: 'p10', slug: 'dettol-antiseptic-750ml', name: 'ديتول مطهر 750 مل', nameEn: 'Dettol Antiseptic 750ml', price: 89.99, compareAtPrice: 99.99, mainCategorySlug: 'cleaning', category: 'dettol', categorySlug: 'dettol', brand: 'Dettol', sections: ['offers', 'top'], emoji: '🧴', unit: '750 مل', rating: 4.7, stock: 70, inStock: true, isOffer: true, isFeatured: true },
  { _id: 'p11', slug: 'coca-cola-1.5l', name: 'كوكاكولا 1.5 لتر', nameEn: 'Coca-Cola 1.5L', price: 22, compareAtPrice: 25, mainCategorySlug: 'beverages', category: 'soft-drinks', categorySlug: 'soft-drinks', brand: 'Coca-Cola', sections: ['offers', 'beverages', 'top'], emoji: '🥤', unit: '1.5 لتر', rating: 4.9, stock: 150, inStock: true, isOffer: true, isFeatured: true },
  { _id: 'p12', slug: 'pepsi-1.5l', name: 'بيبسي 1.5 لتر', nameEn: 'Pepsi 1.5L', price: 21, compareAtPrice: 24, mainCategorySlug: 'beverages', category: 'soft-drinks', categorySlug: 'soft-drinks', brand: 'Pepsi', sections: ['offers', 'beverages'], emoji: '🥤', unit: '1.5 لتر', rating: 4.8, stock: 140, inStock: true, isOffer: true },
  { _id: 'p13', slug: 'juhayna-orange-1l', name: 'عصير جهينة برتقال', nameEn: 'Juhayna Orange Juice 1L', price: 35.99, compareAtPrice: 42, mainCategorySlug: 'beverages', category: 'juices', categorySlug: 'juices', brand: 'Juhayna', sections: ['offers', 'beverages', 'top'], emoji: '🍊', unit: '1 لتر', rating: 4.6, stock: 65, inStock: true, isOffer: true, isFeatured: true },
  { _id: 'p14', slug: 'nestle-pure-life-1.5l', name: 'نستله بيور لايف 1.5 لتر', nameEn: 'Nestle Pure Life 1.5L', price: 8.5, compareAtPrice: null, mainCategorySlug: 'beverages', category: 'water', categorySlug: 'water', brand: 'Nestle', sections: ['beverages', 'supermarket'], emoji: '💧', unit: '1.5 لتر', rating: 4.5, stock: 300, inStock: true, isOffer: false },
  { _id: 'p15', slug: 'aquafina-600ml', name: 'أكوافينا 600 مل', nameEn: 'Aquafina 600ml', price: 5, compareAtPrice: 6, mainCategorySlug: 'beverages', category: 'water', categorySlug: 'water', brand: 'Aquafina', sections: ['offers', 'beverages'], emoji: '💧', unit: '600 مل', rating: 4.3, stock: 400, inStock: true, isOffer: true },
];

const MOCK_BRANDS = ['MarketPlus', 'Juhayna', 'Coca-Cola', 'Pampers', 'Samsung', 'Nestle', 'HyperOne'];
PRODUCTS.forEach((p, i) => {
  p.categorySlug = p.category;
  p.stock = p.stock ?? (p.inStock ? 100 : 0);
  p.brand = p.brand || MOCK_BRANDS[i % MOCK_BRANDS.length];
  p.isNew = p.isNew ?? i % 6 === 0;
  p.isBestSeller = p.isBestSeller ?? i % 5 === 0;
  p.soldCount = p.soldCount ?? 80 + i * 35;
});

export const HOME_SECTIONS = [
  { key: 'offers', titleAr: 'عروض متتفوتش', titleEn: 'Unmissable Offers', link: '/offers' },
  { key: 'top', titleAr: 'أهم المنتجات', titleEn: 'Top Products', link: '/products?sort=top' },
  { key: 'baby', titleAr: 'حفاضات الأطفال', titleEn: 'Baby Diapers', link: '/category/diapers' },
  { key: 'cleaning', titleAr: 'منظفات', titleEn: 'Cleaning', link: '/category/cleaning' },
  { key: 'beverages', titleAr: 'المشروبات', titleEn: 'Beverages', link: '/category/beverages' },
];

export const DEMO_ORDERS = [
  {
    _id: 'ord1',
    orderNumber: 'MP-20260531-001',
    date: '2026-05-28',
    status: 'delivered',
    total: 456.50,
    items: [{ name: 'طماطم طازجة', quantity: 2, price: 18.99 }, { name: 'لبن كامل الدسم', quantity: 3, price: 32.50 }],
  },
  {
    _id: 'ord2',
    orderNumber: 'MP-20260525-002',
    date: '2026-05-25',
    status: 'shipped',
    total: 289.99,
    items: [{ name: 'بامبرز بنطلون مقاس 4', quantity: 1, price: 289.99 }],
  },
  {
    _id: 'ord3',
    orderNumber: 'MP-20260520-003',
    date: '2026-05-20',
    status: 'processing',
    total: 145.00,
    items: [{ name: 'صدور دجاج', quantity: 1, price: 145.00 }],
  },
];

export function getProductBySlug(slug) {
  return PRODUCTS.find((p) => p.slug === slug);
}

export function getProductById(id) {
  return PRODUCTS.find((p) => p._id === id);
}

export function getCategoryBySlug(slug) {
  return CATEGORIES.find((c) => c.slug === slug);
}

export function getCategorySlugsInTree(slug) {
  const childSlugs = CATEGORIES.filter((c) => c.parentSlug === slug).map((c) => c.slug);
  if (childSlugs.length > 0) return [slug, ...childSlugs];
  return [slug];
}

export function getProductsByCategory(slug) {
  const children = CATEGORIES.filter((c) => c.parentSlug === slug);
  if (children.length > 0) return [];
  return PRODUCTS.filter((p) => (p.categorySlug || p.category) === slug);
}

export function getProductsByMainCategory(mainSlug) {
  const subSlugs = CATEGORIES.filter((c) => c.parentSlug === mainSlug).map((c) => c.slug);
  return PRODUCTS.filter((p) => subSlugs.includes(p.categorySlug || p.category));
}

export function getSubcategoriesMock(slug) {
  const cat = getCategoryBySlug(slug);
  if (cat?.parentSlug) {
    return CATEGORIES.filter((c) => c.parentSlug === cat.parentSlug);
  }
  return CATEGORIES.filter((c) => c.parentSlug === slug);
}

export function getParentCategoryMock(slug) {
  const cat = getCategoryBySlug(slug);
  if (!cat?.parentSlug) return null;
  return getCategoryBySlug(cat.parentSlug);
}

export function getProductsBySection(sectionKey) {
  if (sectionKey === 'baby' || sectionKey === 'diapers') return getProductsByMainCategory('diapers');
  if (sectionKey === 'cleaning') return getProductsByMainCategory('cleaning');
  if (sectionKey === 'beverages') return getProductsByMainCategory('beverages');
  if (sectionKey === 'offers') return getOfferProducts();
  if (sectionKey === 'top') return PRODUCTS.filter((p) => p.isFeatured || p.sections?.includes('top'));
  return PRODUCTS.filter((p) => p.sections?.includes(sectionKey));
}

export function getOfferProducts() {
  return PRODUCTS.filter((p) => p.isOffer);
}

export function searchProducts(query, categorySlug) {
  const q = query?.toLowerCase().trim();
  let results = PRODUCTS;
  if (categorySlug && categorySlug !== 'all') {
    const cat = getCategoryBySlug(categorySlug);
    if (cat?.parentSlug) {
      results = results.filter((p) => (p.categorySlug || p.category) === categorySlug);
    } else {
      const subSlugs = CATEGORIES.filter((c) => c.parentSlug === categorySlug).map((c) => c.slug);
      results = results.filter((p) => subSlugs.includes(p.categorySlug || p.category));
    }
  }
  if (!q) return results;
  return results.filter(
    (p) =>
      p.name.includes(q) ||
      p.nameEn.toLowerCase().includes(q) ||
      p.slug.includes(q),
  );
}

export function getDiscountPercent(product) {
  if (!product?.compareAtPrice || product.compareAtPrice <= product.price) return 0;
  return Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100);
}
