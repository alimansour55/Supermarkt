/**
 * Demo catalog — 3 complete category trees for testing:
 * Main (level 1) → Sub / brand (level 2) → Products
 */

export const SEED_CATEGORY_TREES = [
  {
    main: {
      slug: 'diapers',
      nameAr: 'حفاضات',
      nameEn: 'Diapers',
      icon: '👶',
      color: 'bg-yellow-100',
      sortOrder: 1,
    },
    subs: [
      { slug: 'pampers', nameAr: 'بامبرز', nameEn: 'Pampers', icon: '🍼', color: 'bg-amber-50', sortOrder: 1 },
      { slug: 'molfix', nameAr: 'مولفيكس', nameEn: 'Molfix', icon: '👶', color: 'bg-orange-50', sortOrder: 2 },
      { slug: 'fine-baby', nameAr: 'فاين بيبي', nameEn: 'Fine Baby', icon: '🧸', color: 'bg-pink-50', sortOrder: 3 },
    ],
  },
  {
    main: {
      slug: 'cleaning',
      nameAr: 'منظفات',
      nameEn: 'Cleaning',
      icon: '🧹',
      color: 'bg-purple-100',
      sortOrder: 2,
    },
    subs: [
      { slug: 'ariel', nameAr: 'أريال', nameEn: 'Ariel', icon: '🧺', color: 'bg-blue-50', sortOrder: 1 },
      { slug: 'persil', nameAr: 'برسيل', nameEn: 'Persil', icon: '✨', color: 'bg-green-50', sortOrder: 2 },
      { slug: 'dettol', nameAr: 'ديتول', nameEn: 'Dettol', icon: '🧴', color: 'bg-teal-50', sortOrder: 3 },
    ],
  },
  {
    main: {
      slug: 'beverages',
      nameAr: 'مشروبات',
      nameEn: 'Beverages',
      icon: '🥤',
      color: 'bg-cyan-100',
      sortOrder: 3,
    },
    subs: [
      { slug: 'soft-drinks', nameAr: 'مشروبات غازية', nameEn: 'Soft Drinks', icon: '🥤', color: 'bg-red-50', sortOrder: 1 },
      { slug: 'juices', nameAr: 'عصائر', nameEn: 'Juices', icon: '🍊', color: 'bg-orange-50', sortOrder: 2 },
      { slug: 'water', nameAr: 'مياه', nameEn: 'Water', icon: '💧', color: 'bg-sky-50', sortOrder: 3 },
    ],
  },
];

/** Flat list for legacy imports */
export const SEED_CATEGORIES = SEED_CATEGORY_TREES.flatMap((tree) => [
  tree.main,
  ...tree.subs.map((sub) => ({ ...sub, parentSlug: tree.main.slug })),
]);

/**
 * Full 4-level hierarchy demo:
 * Main → Category → Sub → Sub-sub → Product
 * Browse: /category/grocery-demo/dairy-demo/milk-demo/fresh-milk-demo
 */
export const SEED_DEEP_CATEGORY_DEMO = {
  main: {
    slug: 'grocery-demo',
    nameAr: 'بقالة (تجريبي)',
    nameEn: 'Grocery (Demo)',
    icon: '🛒',
    color: 'bg-emerald-100',
    sortOrder: 99,
  },
  level2: {
    slug: 'dairy-demo',
    nameAr: 'ألبان',
    nameEn: 'Dairy',
    icon: '🥛',
    color: 'bg-sky-50',
    sortOrder: 1,
  },
  level3: {
    slug: 'milk-demo',
    nameAr: 'حليب',
    nameEn: 'Milk',
    icon: '🍼',
    color: 'bg-blue-50',
    sortOrder: 1,
  },
  level4: {
    slug: 'fresh-milk-demo',
    nameAr: 'حليب طازج',
    nameEn: 'Fresh Milk',
    icon: '✨',
    color: 'bg-indigo-50',
    sortOrder: 1,
  },
  product: {
    slug: 'demo-fresh-milk-1l',
    nameAr: 'حليب طازج كامل الدسم 1 لتر',
    nameEn: 'Full Cream Fresh Milk 1L',
    price: 35,
    oldPrice: 42,
    emoji: '🥛',
    unit: '1 L',
    stock: 120,
    isFeatured: true,
    isOffer: true,
  },
};

export const SEED_COUPONS = [
  {
    code: 'FIRST20',
    discountType: 'percent',
    discountValue: 20,
    minSubtotal: 100,
    expiryDate: new Date('2027-12-31'),
    usageLimit: 1000,
    labelAr: 'خصم 20%',
    labelEn: '20% off',
  },
  {
    code: 'SAVE50',
    discountType: 'fixed',
    discountValue: 50,
    minSubtotal: 300,
    expiryDate: new Date('2027-12-31'),
    usageLimit: 500,
    labelAr: 'خصم 50 ج.م',
    labelEn: '50 EGP off',
  },
  {
    code: 'FREESHIP',
    discountType: 'free_delivery',
    discountValue: 0,
    minSubtotal: 0,
    expiryDate: new Date('2027-12-31'),
    usageLimit: null,
    labelAr: 'توصيل مجاني',
    labelEn: 'Free delivery',
  },
];

export const SEED_BANNERS = [
  {
    titleAr: 'عروض متتفوتش',
    titleEn: 'Unmissable Deals',
    subtitleAr: 'خصومات تصل إلى 50% على آلاف المنتجات',
    subtitleEn: 'Up to 50% off on thousands of products',
    image: 'https://placehold.co/1200x400/059669/ffffff?text=MarketPlus+Offers',
    link: '/offers',
    placement: 'hero',
    sortOrder: 1,
  },
  {
    titleAr: 'حفاضات الأطفال',
    titleEn: 'Baby Diapers',
    subtitleAr: 'بامبرز · مولفيكس · فاين بيبي',
    subtitleEn: 'Pampers · Molfix · Fine Baby',
    image: 'https://placehold.co/1200x400/fbbf24/ffffff?text=Diapers',
    link: '/category/diapers',
    placement: 'hero',
    sortOrder: 2,
  },
  {
    titleAr: 'منظفات المنزل',
    titleEn: 'Home Cleaning',
    subtitleAr: 'أريال · برسيل · ديتول',
    subtitleEn: 'Ariel · Persil · Dettol',
    image: 'https://placehold.co/1200x400/8b5cf6/ffffff?text=Cleaning',
    link: '/category/cleaning',
    placement: 'hero',
    sortOrder: 3,
  },
  {
    titleAr: 'مشروبات منعشة',
    titleEn: 'Refreshing Drinks',
    subtitleAr: 'غازية · عصائر · مياه',
    subtitleEn: 'Soft drinks · Juices · Water',
    image: 'https://placehold.co/1200x400/06b6d4/ffffff?text=Beverages',
    link: '/category/beverages',
    placement: 'promo',
    sortOrder: 1,
  },
  {
    titleAr: 'عروض بامبرز',
    titleEn: 'Pampers Offers',
    subtitleAr: 'خصم على حفاضات بامبرز',
    subtitleEn: 'Discounts on Pampers diapers',
    image: 'https://placehold.co/600x200/f59e0b/ffffff?text=Pampers',
    link: '/category/diapers/pampers',
    placement: 'promo',
    sortOrder: 2,
  },
  {
    titleAr: 'مشروبات غازية',
    titleEn: 'Soft Drinks',
    subtitleAr: 'كوكاكولا · بيبسي · فanta',
    subtitleEn: 'Coca-Cola · Pepsi · Fanta',
    image: 'https://placehold.co/600x200/ef4444/ffffff?text=Soft+Drinks',
    link: '/category/beverages/soft-drinks',
    placement: 'promo',
    sortOrder: 3,
  },
];

export const SEED_PRODUCTS = [
  // ——— حفاضات > بامبرز ———
  { slug: 'pampers-pants-size-4', nameAr: 'بامبرز بنطلون مقاس 4', nameEn: 'Pampers Pants Size 4', price: 289.99, oldPrice: 329.99, mainCategorySlug: 'diapers', subCategorySlug: 'pampers', brand: 'Pampers', emoji: '👶', unit: '52 حفاضة', rating: 4.9, stock: 45, isOffer: true, isFeatured: true },
  { slug: 'pampers-baby-dry-size-3', nameAr: 'بامبرز بيبي دراي مقاس 3', nameEn: 'Pampers Baby Dry Size 3', price: 259.99, oldPrice: null, mainCategorySlug: 'diapers', subCategorySlug: 'pampers', brand: 'Pampers', emoji: '🍼', unit: '58 حفاضة', rating: 4.8, stock: 38, isOffer: false, isFeatured: true },
  { slug: 'pampers-wipes-64', nameAr: 'مناديل بامبرز', nameEn: 'Pampers Wipes 64', price: 55, oldPrice: 65, mainCategorySlug: 'diapers', subCategorySlug: 'pampers', brand: 'Pampers', emoji: '🧻', unit: '64 منديل', rating: 4.7, stock: 80, isOffer: true },

  // ——— حفاضات > مولفيكس ———
  { slug: 'molfix-size-5', nameAr: 'مولفيكس مقاس 5', nameEn: 'Molfix Size 5', price: 219.99, oldPrice: 249.99, mainCategorySlug: 'diapers', subCategorySlug: 'molfix', brand: 'Molfix', emoji: '👶', unit: '48 حفاضة', rating: 4.6, stock: 52, isOffer: true },
  { slug: 'molfix-size-4', nameAr: 'مولفيكس مقاس 4', nameEn: 'Molfix Size 4', price: 199.99, oldPrice: null, mainCategorySlug: 'diapers', subCategorySlug: 'molfix', brand: 'Molfix', emoji: '👶', unit: '52 حفاضة', rating: 4.5, stock: 60, isOffer: false },
  { slug: 'molfix-pants-jumbo', nameAr: 'مولفيكس بنطلون جامبو', nameEn: 'Molfix Pants Jumbo', price: 239.99, oldPrice: 269.99, mainCategorySlug: 'diapers', subCategorySlug: 'molfix', brand: 'Molfix', emoji: '🧸', unit: '44 حفاضة', rating: 4.7, stock: 35, isOffer: true },

  // ——— حفاضات > فاين بيبي ———
  { slug: 'fine-baby-size-4', nameAr: 'فاين بيبي مقاس 4', nameEn: 'Fine Baby Size 4', price: 179.99, oldPrice: 199.99, mainCategorySlug: 'diapers', subCategorySlug: 'fine-baby', brand: 'Fine Baby', emoji: '👶', unit: '50 حفاضة', rating: 4.4, stock: 40, isOffer: true },
  { slug: 'fine-baby-pants', nameAr: 'فاين بيبي بنطلون', nameEn: 'Fine Baby Pants', price: 189.99, oldPrice: null, mainCategorySlug: 'diapers', subCategorySlug: 'fine-baby', brand: 'Fine Baby', emoji: '🍼', unit: '46 حفاضة', rating: 4.3, stock: 42, isOffer: false },

  // ——— منظفات > أريال ———
  { slug: 'ariel-gel-3kg', nameAr: 'أريال جل غسيل 3 كجم', nameEn: 'Ariel Gel 3kg', price: 189.99, oldPrice: 219.99, mainCategorySlug: 'cleaning', subCategorySlug: 'ariel', brand: 'Ariel', emoji: '🧺', unit: '3 كجم', rating: 4.6, stock: 55, isOffer: true, isFeatured: true },
  { slug: 'ariel-pods-15', nameAr: 'أريال كapsules 15', nameEn: 'Ariel Pods 15 tabs', price: 249.99, oldPrice: null, mainCategorySlug: 'cleaning', subCategorySlug: 'ariel', brand: 'Ariel', emoji: '✨', unit: '15 كapsule', rating: 4.8, stock: 30, isOffer: false },
  { slug: 'ariel-powder-4kg', nameAr: 'أريال مسحوق 4 كجم', nameEn: 'Ariel Powder 4kg', price: 159.99, oldPrice: 179.99, mainCategorySlug: 'cleaning', subCategorySlug: 'ariel', brand: 'Ariel', emoji: '🧴', unit: '4 كجم', rating: 4.5, stock: 48, isOffer: true },

  // ——— منظفات > برسيل ———
  { slug: 'persil-powder-4kg', nameAr: 'برسيل مسحوق 4 كجم', nameEn: 'Persil Powder 4kg', price: 169.99, oldPrice: 189.99, mainCategorySlug: 'cleaning', subCategorySlug: 'persil', brand: 'Persil', emoji: '🧺', unit: '4 كجم', rating: 4.5, stock: 44, isOffer: true },
  { slug: 'persil-liquid-2.5l', nameAr: 'برسيل سائل 2.5 لتر', nameEn: 'Persil Liquid 2.5L', price: 139.99, oldPrice: null, mainCategorySlug: 'cleaning', subCategorySlug: 'persil', brand: 'Persil', emoji: '🧴', unit: '2.5 لتر', rating: 4.4, stock: 36, isOffer: false },
  { slug: 'persil-color-3kg', nameAr: 'برسيل ألوان 3 كجم', nameEn: 'Persil Color 3kg', price: 149.99, oldPrice: 165, mainCategorySlug: 'cleaning', subCategorySlug: 'persil', brand: 'Persil', emoji: '✨', unit: '3 كجم', rating: 4.6, stock: 40, isOffer: true },

  // ——— منظفات > ديتول ———
  { slug: 'dettol-antiseptic-750ml', nameAr: 'ديتول مطهر 750 مل', nameEn: 'Dettol Antiseptic 750ml', price: 89.99, oldPrice: 99.99, mainCategorySlug: 'cleaning', subCategorySlug: 'dettol', brand: 'Dettol', emoji: '🧴', unit: '750 مل', rating: 4.7, stock: 70, isOffer: true, isFeatured: true },
  { slug: 'dettol-soap-4pack', nameAr: 'ديتول صابون 4 قطع', nameEn: 'Dettol Soap 4 pack', price: 45, oldPrice: null, mainCategorySlug: 'cleaning', subCategorySlug: 'dettol', brand: 'Dettol', emoji: '🧼', unit: '4 قطع', rating: 4.5, stock: 90, isOffer: false },
  { slug: 'dettol-floor-cleaner', nameAr: 'ديتول منظف أرضيات', nameEn: 'Dettol Floor Cleaner', price: 65, oldPrice: 75, mainCategorySlug: 'cleaning', subCategorySlug: 'dettol', brand: 'Dettol', emoji: '🧹', unit: '1.8 لتر', rating: 4.4, stock: 55, isOffer: true },

  // ——— مشروبات > غازية ———
  { slug: 'coca-cola-1.5l', nameAr: 'كوكاكولا 1.5 لتر', nameEn: 'Coca-Cola 1.5L', price: 22, oldPrice: 25, mainCategorySlug: 'beverages', subCategorySlug: 'soft-drinks', brand: 'Coca-Cola', emoji: '🥤', unit: '1.5 لتر', rating: 4.9, stock: 150, isOffer: true, isFeatured: true },
  { slug: 'pepsi-1.5l', nameAr: 'بيبسي 1.5 لتر', nameEn: 'Pepsi 1.5L', price: 21, oldPrice: 24, mainCategorySlug: 'beverages', subCategorySlug: 'soft-drinks', brand: 'Pepsi', emoji: '🥤', unit: '1.5 لتر', rating: 4.8, stock: 140, isOffer: true },
  { slug: 'fanta-orange-1.5l', nameAr: 'فانتا برتقال 1.5 لتر', nameEn: 'Fanta Orange 1.5L', price: 20, oldPrice: null, mainCategorySlug: 'beverages', subCategorySlug: 'soft-drinks', brand: 'Fanta', emoji: '🍊', unit: '1.5 لتر', rating: 4.7, stock: 120, isOffer: false },

  // ——— مشروبات > عصائر ———
  { slug: 'juhayna-orange-1l', nameAr: 'عصير جهينة برتقال 1 لتر', nameEn: 'Juhayna Orange Juice 1L', price: 35.99, oldPrice: 42, mainCategorySlug: 'beverages', subCategorySlug: 'juices', brand: 'Juhayna', emoji: '🍊', unit: '1 لتر', rating: 4.6, stock: 65, isOffer: true, isFeatured: true },
  { slug: 'sun-quick-700ml', nameAr: 'سان كwik 700 مل', nameEn: 'Sun Quick 700ml', price: 28, oldPrice: null, mainCategorySlug: 'beverages', subCategorySlug: 'juices', brand: 'Sun Quick', emoji: '🧃', unit: '700 مل', rating: 4.4, stock: 80, isOffer: false },
  { slug: 'juhayna-mango-1l', nameAr: 'عصير جهينة مانجو 1 لتر', nameEn: 'Juhayna Mango 1L', price: 36.99, oldPrice: 40, mainCategorySlug: 'beverages', subCategorySlug: 'juices', brand: 'Juhayna', emoji: '🥭', unit: '1 لتر', rating: 4.5, stock: 55, isOffer: true },

  // ——— مشروبات > مياه ———
  { slug: 'nestle-pure-life-1.5l', nameAr: 'نستله بيور لايف 1.5 لتر', nameEn: 'Nestle Pure Life 1.5L', price: 8.5, oldPrice: null, mainCategorySlug: 'beverages', subCategorySlug: 'water', brand: 'Nestle', emoji: '💧', unit: '1.5 لتر', rating: 4.5, stock: 300, isOffer: false },
  { slug: 'aquafina-600ml', nameAr: 'أكوافينا 600 مل', nameEn: 'Aquafina 600ml', price: 5, oldPrice: 6, mainCategorySlug: 'beverages', subCategorySlug: 'water', brand: 'Aquafina', emoji: '💧', unit: '600 مل', rating: 4.3, stock: 400, isOffer: true },
  { slug: 'nestle-pure-life-6pack', nameAr: 'نستله مياه 6 زجاجات', nameEn: 'Nestle Water 6 pack', price: 42, oldPrice: 48, mainCategorySlug: 'beverages', subCategorySlug: 'water', brand: 'Nestle', emoji: '💧', unit: '6 × 1.5L', rating: 4.6, stock: 90, isOffer: true },
];
