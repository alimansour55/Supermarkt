export const DELIVERY_LOCATIONS = [
  { id: 'cairo-nasr', nameAr: 'مدينة نصر، القاهرة', nameEn: 'Nasr City, Cairo' },
  { id: 'cairo-maadi', nameAr: 'المعادي، القاهرة', nameEn: 'Maadi, Cairo' },
  { id: 'cairo-heliopolis', nameAr: 'مصر الجديدة، القاهرة', nameEn: 'Heliopolis, Cairo' },
  { id: 'giza-dokki', nameAr: 'الدقي، الجيزة', nameEn: 'Dokki, Giza' },
  { id: 'giza-6oct', nameAr: '6 أكتوبر، الجيزة', nameEn: '6th of October, Giza' },
  { id: 'alex-smouha', nameAr: 'سموحة، الإسكندرية', nameEn: 'Smouha, Alexandria' },
];

export const CATEGORIES = [
  { id: '1', slug: 'fruits-vegetables', nameAr: 'فواكه وخضروات', nameEn: 'Fruits & Vegetables', icon: '🥬', color: 'bg-green-100' },
  { id: '2', slug: 'dairy', nameAr: 'ألبان وجبن', nameEn: 'Dairy & Cheese', icon: '🥛', color: 'bg-blue-100' },
  { id: '2a', slug: 'dairy-milk', nameAr: 'حليب', nameEn: 'Milk', icon: '🥛', color: 'bg-blue-50', parentSlug: 'dairy' },
  { id: '2b', slug: 'dairy-cheese', nameAr: 'جبن', nameEn: 'Cheese', icon: '🧀', color: 'bg-blue-50', parentSlug: 'dairy' },
  { id: '3', slug: 'bakery', nameAr: 'مخبوزات', nameEn: 'Bakery', icon: '🍞', color: 'bg-amber-100' },
  { id: '4', slug: 'meat-poultry', nameAr: 'لحوم ودواجن', nameEn: 'Meat & Poultry', icon: '🥩', color: 'bg-red-100' },
  { id: '5', slug: 'beverages', nameAr: 'مشروبات', nameEn: 'Beverages', icon: '🥤', color: 'bg-cyan-100' },
  { id: '6', slug: 'snacks', nameAr: 'سناكس وحلويات', nameEn: 'Snacks & Sweets', icon: '🍫', color: 'bg-orange-100' },
  { id: '7', slug: 'cleaning', nameAr: 'منظفات', nameEn: 'Cleaning', icon: '🧹', color: 'bg-purple-100' },
  { id: '8', slug: 'personal-care', nameAr: 'عناية شخصية', nameEn: 'Personal Care', icon: '🧴', color: 'bg-pink-100' },
  { id: '9', slug: 'baby', nameAr: 'مستلزمات الأطفال', nameEn: 'Baby Products', icon: '👶', color: 'bg-yellow-100' },
  { id: '10', slug: 'electronics', nameAr: 'إلكترونيات', nameEn: 'Electronics', icon: '📱', color: 'bg-slate-100' },
  { id: '11', slug: 'frozen', nameAr: 'مجمدات', nameEn: 'Frozen Foods', icon: '🧊', color: 'bg-sky-100' },
  { id: '12', slug: 'household', nameAr: 'منتجات منزلية', nameEn: 'Household', icon: '🏠', color: 'bg-teal-100' },
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
    link: '/categories/fruits-vegetables',
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
  {
    id: 1,
    titleAr: 'خصم 30% على الألبان',
    titleEn: '30% Off Dairy',
    link: '/categories/dairy',
    bg: 'bg-gradient-to-l from-blue-500 to-blue-600',
    emoji: '🥛',
  },
  {
    id: 2,
    titleAr: 'عروض المشروبات',
    titleEn: 'Beverage Deals',
    link: '/categories/beverages',
    bg: 'bg-gradient-to-l from-cyan-500 to-teal-600',
    emoji: '🥤',
  },
  {
    id: 3,
    titleAr: 'مستلزمات الأطفال',
    titleEn: 'Baby Essentials',
    link: '/categories/baby',
    bg: 'bg-gradient-to-l from-pink-400 to-rose-500',
    emoji: '👶',
  },
];

export const PRODUCTS = [
  { _id: 'p1', slug: 'fresh-tomatoes-1kg', name: 'طماطم طازجة', nameEn: 'Fresh Tomatoes', price: 18.99, compareAtPrice: 24.99, category: 'fruits-vegetables', categorySlug: 'fruits-vegetables', brand: 'MarketPlus', sections: ['top', 'supermarket'], emoji: '🍅', unit: '1 كجم', rating: 4.5, stock: 100, inStock: true, isOffer: true, isNew: true, isBestSeller: true, soldCount: 520 },
  { _id: 'p2', slug: 'eggs-large-30', name: 'بيض بلدي كبير', nameEn: 'Large Local Eggs', price: 89.99, compareAtPrice: 99.99, category: 'dairy', categorySlug: 'dairy', sections: ['offers', 'top', 'supermarket'], emoji: '🥚', unit: '30 بيضة', rating: 4.8, inStock: true, isOffer: true },
  { _id: 'p3', slug: 'full-cream-milk-1l', name: 'لبن كامل الدسم', nameEn: 'Full Cream Milk', price: 32.50, compareAtPrice: null, category: 'dairy-milk', categorySlug: 'dairy-milk', sections: ['supermarket', 'top'], emoji: '🥛', unit: '1 لتر', rating: 4.6, inStock: true, isOffer: false },
  { _id: 'p3b', slug: 'low-fat-milk-1l', name: 'لبن قليل الدسم', nameEn: 'Low Fat Milk', price: 22.00, compareAtPrice: 26.00, category: 'dairy-milk', categorySlug: 'dairy-milk', sections: ['supermarket', 'offers'], emoji: '🥛', unit: '1 لتر', rating: 4.5, inStock: true, isOffer: true },
  { _id: 'p3d', slug: 'cheddar-cheese-200g', name: 'جبنة شيدر', nameEn: 'Cheddar Cheese', price: 45.00, compareAtPrice: null, category: 'dairy-cheese', categorySlug: 'dairy-cheese', sections: ['supermarket'], emoji: '🧀', unit: '200 جرام', rating: 4.4, inStock: true, isOffer: false },
  { _id: 'p3c', slug: 'white-rice-1kg', name: 'أرز أبيض', nameEn: 'White Rice', price: 28.99, compareAtPrice: null, category: 'household', categorySlug: 'household', sections: ['supermarket'], emoji: '🍚', unit: '1 كجم', rating: 4.4, inStock: true, isOffer: false },
  { _id: 'p4', slug: 'white-bread-loaf', name: 'عيش فينو أبيض', nameEn: 'White Bread Loaf', price: 12.00, compareAtPrice: 15.00, category: 'bakery', sections: ['offers', 'supermarket'], emoji: '🍞', unit: 'رغيف', rating: 4.3, inStock: true, isOffer: true },
  { _id: 'p5', slug: 'chicken-breast-1kg', name: 'صدور دجاج', nameEn: 'Chicken Breast', price: 145.00, compareAtPrice: 165.00, category: 'meat-poultry', sections: ['offers', 'top'], emoji: '🍗', unit: '1 كجم', rating: 4.7, inStock: true, isOffer: true },
  { _id: 'p6', slug: 'coca-cola-1.5l', name: 'كوكاكولا', nameEn: 'Coca-Cola', price: 22.00, compareAtPrice: 25.00, category: 'beverages', sections: ['offers', 'beverages', 'supermarket'], emoji: '🥤', unit: '1.5 لتر', rating: 4.9, inStock: true, isOffer: true },
  { _id: 'p7', slug: 'mineral-water-1.5l', name: 'مياه معدنية', nameEn: 'Mineral Water', price: 8.50, compareAtPrice: null, category: 'beverages', sections: ['beverages', 'supermarket'], emoji: '💧', unit: '1.5 لتر', rating: 4.5, inStock: true, isOffer: false },
  { _id: 'p8', slug: 'orange-juice-1l', name: 'عصير برتقال', nameEn: 'Orange Juice', price: 35.99, compareAtPrice: 42.00, category: 'beverages', sections: ['offers', 'beverages'], emoji: '🍊', unit: '1 لتر', rating: 4.4, inStock: true, isOffer: true },
  { _id: 'p9', slug: 'potatoes-1kg', name: 'بطاطس', nameEn: 'Potatoes', price: 14.99, compareAtPrice: null, category: 'fruits-vegetables', sections: ['supermarket'], emoji: '🥔', unit: '1 كجم', rating: 4.2, inStock: true, isOffer: false },
  { _id: 'p10', slug: 'bananas-1kg', name: 'موز', nameEn: 'Bananas', price: 22.99, compareAtPrice: 28.00, category: 'fruits-vegetables', sections: ['offers', 'top'], emoji: '🍌', unit: '1 كجم', rating: 4.6, inStock: true, isOffer: true },
  { _id: 'p11', slug: 'cucumber-1kg', name: 'خيار', nameEn: 'Cucumber', price: 12.50, compareAtPrice: null, category: 'fruits-vegetables', sections: ['supermarket'], emoji: '🥒', unit: '1 كجم', rating: 4.1, inStock: true, isOffer: false },
  { _id: 'p12', slug: 'apple-red-1kg', name: 'تفاح أحمر', nameEn: 'Red Apples', price: 39.99, compareAtPrice: 49.99, category: 'fruits-vegetables', sections: ['offers'], emoji: '🍎', unit: '1 كجم', rating: 4.5, inStock: true, isOffer: true },
  { _id: 'p13', slug: 'baby-diapers-size4', name: 'حفاضات أطفال', nameEn: 'Baby Diapers', price: 249.99, compareAtPrice: 299.99, category: 'baby', sections: ['offers', 'baby'], emoji: '👶', unit: '56 حفاضة', rating: 4.8, inStock: true, isOffer: true },
  { _id: 'p14', slug: 'baby-formula-400g', name: 'لبن أطفال', nameEn: 'Baby Formula', price: 189.00, compareAtPrice: null, category: 'baby', sections: ['baby', 'top'], emoji: '🍼', unit: '400 جرام', rating: 4.7, inStock: true, isOffer: false },
  { _id: 'p15', slug: 'baby-wipes-80', name: 'مناديل أطفال', nameEn: 'Baby Wipes', price: 45.00, compareAtPrice: 55.00, category: 'baby', sections: ['offers', 'baby'], emoji: '🧻', unit: '80 منديل', rating: 4.4, inStock: true, isOffer: true },
  { _id: 'p16', slug: 'bluetooth-earbuds', name: 'سماعات بلوتوث', nameEn: 'Bluetooth Earbuds', price: 399.99, compareAtPrice: 549.99, category: 'electronics', sections: ['offers', 'electronics'], emoji: '🎧', unit: 'قطعة', rating: 4.3, inStock: true, isOffer: true },
  { _id: 'p17', slug: 'usb-charger-20w', name: 'شاحن USB 20W', nameEn: 'USB Charger 20W', price: 149.99, compareAtPrice: null, category: 'electronics', sections: ['electronics'], emoji: '🔌', unit: 'قطعة', rating: 4.5, inStock: true, isOffer: false },
  { _id: 'p18', slug: 'power-bank-10000', name: 'باور بانك 10000', nameEn: 'Power Bank 10000mAh', price: 299.00, compareAtPrice: 399.00, category: 'electronics', sections: ['offers', 'electronics', 'top'], emoji: '🔋', unit: 'قطعة', rating: 4.6, inStock: true, isOffer: true },
  { _id: 'p19', slug: 'dish-soap-750ml', name: 'سائل أطباق', nameEn: 'Dish Soap', price: 28.50, compareAtPrice: null, category: 'cleaning', sections: ['supermarket'], emoji: '🧴', unit: '750 مل', rating: 4.2, inStock: true, isOffer: false },
  { _id: 'p20', slug: 'laundry-detergent-3kg', name: 'مسحوق غسيل', nameEn: 'Laundry Detergent', price: 119.99, compareAtPrice: 139.99, category: 'cleaning', sections: ['offers', 'supermarket'], emoji: '🧺', unit: '3 كجم', rating: 4.5, inStock: true, isOffer: true },
  { _id: 'p21', slug: 'chips-salt-170g', name: 'شيبسي ملح', nameEn: 'Salt Chips', price: 15.00, compareAtPrice: null, category: 'snacks', sections: ['supermarket'], emoji: '🍿', unit: '170 جرام', rating: 4.0, inStock: true, isOffer: false },
  { _id: 'p22', slug: 'chocolate-bar-100g', name: 'شوكولاتة', nameEn: 'Chocolate Bar', price: 25.00, compareAtPrice: 32.00, category: 'snacks', sections: ['offers'], emoji: '🍫', unit: '100 جرام', rating: 4.7, inStock: true, isOffer: true },
  { _id: 'p23', slug: 'shampoo-400ml', name: 'شامبو', nameEn: 'Shampoo', price: 65.00, compareAtPrice: null, category: 'personal-care', sections: ['supermarket'], emoji: '🧴', unit: '400 مل', rating: 4.3, inStock: true, isOffer: false },
  { _id: 'p24', slug: 'toothpaste-100ml', name: 'معجون أسنان', nameEn: 'Toothpaste', price: 35.99, compareAtPrice: 42.00, category: 'personal-care', sections: ['offers', 'supermarket'], emoji: '🪥', unit: '100 مل', rating: 4.4, inStock: true, isOffer: true },
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
  { key: 'supermarket', titleAr: 'منتجات السوبر ماركت', titleEn: 'Supermarket Products', link: '/products' },
  { key: 'fruits-vegetables', titleAr: 'الخضار والفواكه', titleEn: 'Fruits & Vegetables', link: '/categories/fruits-vegetables' },
  { key: 'beverages', titleAr: 'المشروبات', titleEn: 'Beverages', link: '/categories/beverages' },
  { key: 'baby', titleAr: 'مستلزمات الأطفال', titleEn: 'Baby Products', link: '/categories/baby' },
  { key: 'electronics', titleAr: 'الإلكترونيات', titleEn: 'Electronics', link: '/categories/electronics' },
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
    items: [{ name: 'حفاضات أطفال', quantity: 1, price: 249.99 }],
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
  const slugs = getCategorySlugsInTree(slug);
  return PRODUCTS.filter((p) => slugs.includes(p.categorySlug || p.category));
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
  if (sectionKey === 'fruits-vegetables') return getProductsByCategory('fruits-vegetables');
  if (sectionKey === 'beverages') return getProductsByCategory('beverages');
  if (sectionKey === 'baby') return getProductsByCategory('baby');
  if (sectionKey === 'electronics') return getProductsByCategory('electronics');
  return PRODUCTS.filter((p) => p.sections?.includes(sectionKey));
}

export function getOfferProducts() {
  return PRODUCTS.filter((p) => p.isOffer);
}

export function searchProducts(query, categorySlug) {
  const q = query?.toLowerCase().trim();
  let results = PRODUCTS;
  if (categorySlug && categorySlug !== 'all') {
    results = results.filter((p) => p.category === categorySlug);
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
