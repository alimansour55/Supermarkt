export const DEFAULT_NAV_LINK = {
  labelAr: '',
  labelEn: '',
  href: '/',
  sortOrder: 0,
  isExternal: false,
  highlight: false,
  isActive: true,
};

export const DEFAULT_NAVIGATION = {
  announcementAr: '',
  announcementEn: '',
  showCategoryLinks: true,
  headerLinks: [
    { labelAr: 'الرئيسية', labelEn: 'Home', href: '/', sortOrder: 0, highlight: false, isActive: true, isExternal: false },
    { labelAr: 'العروض', labelEn: 'Offers', href: '/offers', sortOrder: 1, highlight: true, isActive: true, isExternal: false },
  ],
  footerColumns: [
    {
      titleAr: 'خدمة العملاء',
      titleEn: 'Customer Service',
      sortOrder: 0,
      links: [
        { labelAr: 'اتصل بنا', labelEn: 'Contact Us', href: '/contact', sortOrder: 0, isActive: true, isExternal: false },
        { labelAr: 'الأسئلة الشائعة', labelEn: 'FAQ', href: '/faq', sortOrder: 1, isActive: true, isExternal: false },
        { labelAr: 'الاسترجاع والاستبدال', labelEn: 'Returns & Exchange', href: '/returns', sortOrder: 2, isActive: true, isExternal: false },
        { labelAr: 'تتبع الطلب', labelEn: 'Track Order', href: '/track-order', sortOrder: 3, isActive: true, isExternal: false },
      ],
    },
    {
      titleAr: 'المساعدة',
      titleEn: 'Help',
      sortOrder: 1,
      links: [
        { labelAr: 'من نحن', labelEn: 'About Us', href: '/about', sortOrder: 0, isActive: true, isExternal: false },
        { labelAr: 'سياسة الخصوصية', labelEn: 'Privacy Policy', href: '/privacy', sortOrder: 1, isActive: true, isExternal: false },
        { labelAr: 'الشروط والأحكام', labelEn: 'Terms & Conditions', href: '/terms', sortOrder: 2, isActive: true, isExternal: false },
        { labelAr: 'الوظائف', labelEn: 'Careers', href: '/careers', sortOrder: 3, isActive: true, isExternal: false },
      ],
    },
  ],
};

export const DEFAULT_SEO = {
  defaultTitleAr: 'سوق+ | MarketPlus',
  defaultTitleEn: 'MarketPlus | Online Grocery',
  defaultDescriptionAr: 'تسوق البقالة والمنتجات المنزلية أونلاين مع توصيل سريع',
  defaultDescriptionEn: 'Shop groceries and household essentials online with fast delivery',
  ogImageUrl: '',
  robotsIndex: true,
  googleAnalyticsId: '',
  facebookPixelId: '',
};

export const DEFAULT_PAYMENT_METHODS = [
  {
    id: 'stripe',
    enabled: true,
    labelAr: 'دفع أونلاين (Stripe)',
    labelEn: 'Online Payment (Stripe)',
    descriptionAr: 'فيزا / Mastercard / Meeza',
    descriptionEn: 'Visa / Mastercard / Meeza',
    sortOrder: 0,
    accountNumbers: [],
  },
  {
    id: 'cod',
    enabled: true,
    labelAr: 'الدفع عند الاستلام',
    labelEn: 'Cash on Delivery',
    descriptionAr: 'ادفع نقداً عند الاستلام',
    descriptionEn: 'Pay in cash on delivery',
    sortOrder: 1,
    accountNumbers: [],
  },
  {
    id: 'instapay',
    enabled: false,
    labelAr: 'Instapay',
    labelEn: 'Instapay',
    descriptionAr: 'حوّل المبلغ ثم ارفع صورة التأكيد',
    descriptionEn: 'Transfer the amount then upload your confirmation screenshot',
    sortOrder: 2,
    accountNumbers: [],
  },
  {
    id: 'vodafone_cash',
    enabled: false,
    labelAr: 'فودافون كاش',
    labelEn: 'Vodafone Cash',
    descriptionAr: 'حوّل المبلغ ثم ارفع صورة التأكيد',
    descriptionEn: 'Transfer the amount then upload your confirmation screenshot',
    sortOrder: 3,
    accountNumbers: [],
  },
];

/** Keep in sync with the `locationGate` sub-schema in models/StoreSettings.js. */
export const DEFAULT_LOCATION_GATE = {
  enabled: false,
  mandatory: true,
  enforceCoverage: true,
  titleAr: 'اختر منطقتك',
  titleEn: 'Choose your area',
  subtitleAr: 'حدّد منطقة التوصيل لعرض المنتجات والأسعار ومواعيد التوصيل الصحيحة',
  subtitleEn: 'Set your delivery area to see the right products, prices and delivery slots',
  mapCenterLat: 29.8453,
  mapCenterLng: 31.3339,
  mapZoom: 12,
  /** Coverage areas (the umbrella) — one or more circles; no delivery zone may accept orders from outside all of them. Empty until configured. */
  coverageAreas: [],
};

export const DEFAULT_LOW_STOCK_ALERT = {
  lowStockAlertEnabled: true,
  lowStockAlertThreshold: 10,
  adminStockAlertThreshold: 10,
  lowStockMessageAr: 'باقي {{qty}} فقط',
  lowStockMessageEn: 'Only {{qty}} left',
};

/** Keep in sync with the `wallet` sub-schema in models/StoreSettings.js. */
export const DEFAULT_WALLET = {
  enabled: true,
  allowTopUp: true,
  allowCheckoutSpend: true,
  minTopUp: 50,
  maxTopUp: 5000,
  maxBalance: 20000,
  maxCheckoutPercent: 100,
};

export const DEFAULT_TRENDING_SEARCHES = [
  { query: 'milk', labelAr: 'لبن', labelEn: 'milk', sortOrder: 0, isActive: true },
  { query: 'bread', labelAr: 'عيش', labelEn: 'bread', sortOrder: 1, isActive: true },
  { query: 'rice', labelAr: 'أرز', labelEn: 'rice', sortOrder: 2, isActive: true },
  { query: 'chicken', labelAr: 'دجاج', labelEn: 'chicken', sortOrder: 3, isActive: true },
  { query: 'eggs', labelAr: 'بيض', labelEn: 'eggs', sortOrder: 4, isActive: true },
];

/** Keep in sync with the `trendingConfig` sub-schema in models/StoreSettings.js. */
export const DEFAULT_TRENDING_CONFIG = {
  displayLimit: 8,
  autoLookbackDays: 7,
  autoMinCount: 3,
  requireConversion: false,
  dedupeByProduct: true,
  autoBlocklist: [],
};

export const DEFAULT_SEARCH_SETTINGS = {
  trendingMode: 'manual',
  trendingSearches: DEFAULT_TRENDING_SEARCHES,
  trendingConfig: DEFAULT_TRENDING_CONFIG,
};

export const DEFAULT_ADMIN_PANEL = {
  showRevenue: true,
};

export const DEFAULT_PARTNER_REVENUE = {
  enabled: false,
  mode: 'attribution',
  revenueBasis: 'total',
  reservePercent: 0,
  unassignedPolicy: 'percentage',
  attributionStreams: {
    productSales: true,
    zoneOrders: true,
    zoneDeliveryFees: true,
    locationOrders: true,
    customerOrders: true,
    promotionSales: true,
  },
  weights: {
    products: 10,
    productSales: 25,
    categories: 5,
    brands: 5,
    fulfillmentLocations: 15,
    deliveryZones: 15,
    promotions: 10,
    zoneOrders: 12,
    deliveryFees: 8,
  },
  factorEnabled: {
    products: true,
    productSales: true,
    categories: true,
    brands: true,
    fulfillmentLocations: true,
    deliveryZones: true,
    promotions: true,
    zoneOrders: true,
    deliveryFees: true,
  },
  partners: [],
};

/** Keep in sync with the `driverSettings` sub-schema in models/StoreSettings.js. */
export const DEFAULT_DRIVER_SETTINGS = {
  autoAssignEnabled: false,
  autoAssignMaxActive: 0,
  availabilityEnabled: true,
  pickingChecklistEnabled: true,
  cashCalculatorEnabled: true,
};

/** Keep in sync with the `liveChat` sub-schema in models/StoreSettings.js. maxConcurrentChats: 0 = unlimited. */
export const DEFAULT_LIVE_CHAT = {
  enabled: true,
  scheduleEnabled: false,
  schedule: [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, enabled: true, from: '09:00', to: '23:00' })),
  maxConcurrentChats: 2,
  csatTargetPercent: 90,
  monthlyChatTarget: 0,
  idlePromptMinutes: 1,
  autoCloseMinutes: 15,
  ratingEnabled: true,
  offlineMessageAr: 'فريق الدعم غير متاح الآن، هنرد عليك في أقرب وقت خلال ساعات العمل.',
  offlineMessageEn: "Our support team isn't available right now — we'll reply as soon as we're back.",
};

export const DEFAULT_CUSTOMER_SERVICE = {
  enabled: true,
  channels: [
    {
      id: 'phone',
      type: 'phone',
      enabled: true,
      labelAr: 'اتصال هاتفي',
      labelEn: 'Phone call',
      descriptionAr: 'اتصل بنا مباشرة',
      descriptionEn: 'Call us directly',
      value: '16XXX',
      icon: 'phone',
      sortOrder: 0,
    },
    {
      id: 'callback',
      type: 'callback',
      enabled: true,
      labelAr: 'اطلب أن نتصل بك',
      labelEn: 'Request a call back',
      descriptionAr: 'اترك رقمك وهنتصل بيك',
      descriptionEn: "Leave your number and we'll call you",
      value: '',
      icon: 'phone-outgoing',
      sortOrder: 1,
    },
    {
      id: 'chat',
      type: 'chat',
      enabled: true,
      labelAr: 'الدردشة المباشرة',
      labelEn: 'Live chat',
      descriptionAr: 'تحدث مع المساعد الذكي',
      descriptionEn: 'Chat with our assistant',
      value: '',
      icon: 'message-circle',
      sortOrder: 2,
    },
    {
      id: 'email',
      type: 'email',
      enabled: true,
      labelAr: 'البريد الإلكتروني',
      labelEn: 'Email',
      descriptionAr: 'راسلنا وسنرد خلال 24 ساعة',
      descriptionEn: "Email us — we'll reply within 24 hours",
      value: 'support@marketplus.com',
      icon: 'mail',
      sortOrder: 3,
    },
  ],
  callback: {
    noteAr: 'هنتصل بيك خلال ساعة في أوقات العمل',
    noteEn: "We'll call you back within an hour during business hours",
    workingHoursAr: 'يومياً من 9 صباحاً حتى 12 منتصف الليل',
    workingHoursEn: 'Daily, 9 AM – 12 AM',
  },
};

export const DEFAULT_THEME_COLOR = 'hyperone';
export const DEFAULT_SITE_FONT = 'cairo';
