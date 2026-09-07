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

export const DEFAULT_LOW_STOCK_ALERT = {
  lowStockAlertEnabled: true,
  lowStockAlertThreshold: 10,
  adminStockAlertThreshold: 10,
  lowStockMessageAr: 'باقي {{qty}} فقط',
  lowStockMessageEn: 'Only {{qty}} left',
};

export const DEFAULT_TRENDING_SEARCHES = [
  { query: 'milk', labelAr: 'لبن', labelEn: 'milk', sortOrder: 0, isActive: true },
  { query: 'bread', labelAr: 'عيش', labelEn: 'bread', sortOrder: 1, isActive: true },
  { query: 'rice', labelAr: 'أرز', labelEn: 'rice', sortOrder: 2, isActive: true },
  { query: 'chicken', labelAr: 'دجاج', labelEn: 'chicken', sortOrder: 3, isActive: true },
  { query: 'eggs', labelAr: 'بيض', labelEn: 'eggs', sortOrder: 4, isActive: true },
];

export const DEFAULT_SEARCH_SETTINGS = {
  trendingMode: 'manual',
  trendingSearches: DEFAULT_TRENDING_SEARCHES,
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

export const DEFAULT_THEME_COLOR = 'green';
export const DEFAULT_SITE_FONT = 'cairo';
