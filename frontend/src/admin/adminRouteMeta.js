const LABELS = {
  dashboard: { ar: 'لوحة التحكم', en: 'Dashboard' },
  products: { ar: 'المنتجات', en: 'Products' },
  stockAlerts: { ar: 'تنبيهات المخزون', en: 'Stock alerts' },
  newProduct: { ar: 'إضافة منتج', en: 'Add product' },
  edit: { ar: 'تعديل', en: 'Edit' },
  categories: { ar: 'الأقسام', en: 'Categories' },
  brands: { ar: 'العلامات التجارية', en: 'Brands' },
  orders: { ar: 'الطلبات', en: 'Orders' },
  invoices: { ar: 'الفواتير', en: 'Invoices' },
  liveDeliveries: { ar: 'التوصيل المباشر', en: 'Live deliveries' },
  recurringDeliveries: { ar: 'التوصيل الدوري', en: 'Recurring delivery' },
  orderChats: { ar: 'محادثة الطلبات', en: 'Order chats' },
  returns: { ar: 'المرتجعات', en: 'Returns' },
  orderTrash: { ar: 'سلة المحذوفات', en: 'Recycle bin' },
  users: { ar: 'المستخدمون', en: 'Users' },
  team: { ar: 'فريق الإدارة', en: 'Admin team' },
  coupons: { ar: 'الكوبونات', en: 'Coupons' },
  promotions: { ar: 'العروض والتخفيضات', en: 'Offers & promotions' },
  banners: { ar: 'البانرات والحملات', en: 'Banners & campaigns' },
  homepage: { ar: 'Homepage CMS', en: 'Homepage CMS' },
  content: { ar: 'صفحات المحتوى', en: 'Content pages' },
  navigation: { ar: 'Header & Footer CMS', en: 'Header & Footer CMS' },
  seo: { ar: 'SEO', en: 'SEO' },
  appearance: { ar: 'المظهر والألوان', en: 'Appearance' },
  loyalty: { ar: 'نقاط الولاء', en: 'Loyalty points' },
  wallet: { ar: 'المحافظ', en: 'Wallets' },
  payments: { ar: 'طرق الدفع', en: 'Payment methods' },
  notifications: { ar: 'قوالب الإشعارات', en: 'Notification templates' },
  coverageArea: { ar: 'منطقة التغطية', en: 'Coverage area' },
  delivery: { ar: 'مناطق التوصيل', en: 'Delivery zones' },
  fulfillmentLocations: { ar: 'مواقع الشحن', en: 'Fulfillment locations' },
  reviews: { ar: 'التقييمات', en: 'Reviews' },
  settings: { ar: 'إعدادات المتجر', en: 'Store settings' },
  settingsIdentity: { ar: 'هوية المتجر', en: 'Store identity' },
  settingsContact: { ar: 'التواصل والروابط', en: 'Contact & links' },
  settingsDelivery: { ar: 'التوصيل', en: 'Delivery' },
  settingsExperience: { ar: 'تجربة العميل', en: 'Customer experience' },
  settingsInvoice: { ar: 'الفاتورة', en: 'Invoice' },
  settingsAdmin: { ar: 'لوحة التحكم', en: 'Admin panel' },
  reports: { ar: 'التقارير', en: 'Reports' },
  revenue: { ar: 'الإيرادات', en: 'Revenue' },
  searchAnalytics: { ar: 'تحليلات البحث', en: 'Search analytics' },
  trendingSearches: { ar: 'الأكثر بحثاً', en: 'Trending searches' },
  filterSettings: { ar: 'إعدادات الفلاتر', en: 'Filter settings' },
  auditLog: { ar: 'سجل التدقيق', en: 'Audit log' },
};

function label(key, isAr) {
  return LABELS[key][isAr ? 'ar' : 'en'];
}

function crumb(key, isAr, to) {
  return { label: label(key, isAr), to };
}

export function getAdminPageMeta(pathname, isAr) {
  const normalized = pathname.replace(/\/$/, '') || '/admin';
  const dashboard = crumb('dashboard', isAr, '/admin');

  if (normalized === '/admin') {
    return { title: label('dashboard', isAr), breadcrumbs: [dashboard] };
  }

  if (normalized === '/admin/products') {
    const products = crumb('products', isAr, '/admin/products');
    return { title: label('products', isAr), breadcrumbs: [dashboard, products] };
  }

  if (normalized === '/admin/stock-alerts') {
    const stockAlerts = crumb('stockAlerts', isAr, '/admin/stock-alerts');
    return { title: label('stockAlerts', isAr), breadcrumbs: [dashboard, stockAlerts] };
  }

  if (normalized === '/admin/products/new') {
    return {
      title: label('newProduct', isAr),
      breadcrumbs: [dashboard, crumb('products', isAr, '/admin/products'), { label: label('newProduct', isAr) }],
    };
  }

  if (/^\/admin\/products\/[^/]+\/edit$/.test(normalized)) {
    return {
      title: label('edit', isAr),
      breadcrumbs: [dashboard, crumb('products', isAr, '/admin/products'), { label: label('edit', isAr) }],
    };
  }

  const sections = {
    '/admin/categories': 'categories',
    '/admin/brands': 'brands',
    '/admin/orders': 'orders',
    '/admin/invoices': 'invoices',
    '/admin/live-deliveries': 'liveDeliveries',
    '/admin/recurring-deliveries': 'recurringDeliveries',
    '/admin/order-chats': 'orderChats',
    '/admin/returns': 'returns',
    '/admin/order-trash': 'orderTrash',
    '/admin/users': 'users',
    '/admin/team': 'team',
    '/admin/coupons': 'coupons',
    '/admin/promotions': 'promotions',
    '/admin/banners': 'banners',
    '/admin/homepage': 'homepage',
    '/admin/navigation': 'navigation',
    '/admin/content': 'content',
    '/admin/appearance': 'appearance',
    '/admin/coverage-area': 'coverageArea',
    '/admin/delivery': 'delivery',
    '/admin/fulfillment-locations': 'fulfillmentLocations',
    '/admin/reviews': 'reviews',
    '/admin/loyalty': 'loyalty',
    '/admin/wallet': 'wallet',
    '/admin/payments': 'payments',
    '/admin/notifications': 'notifications',
    '/admin/settings': 'settings',
    '/admin/settings/identity': 'settingsIdentity',
    '/admin/settings/contact': 'settingsContact',
    '/admin/settings/delivery': 'settingsDelivery',
    '/admin/settings/experience': 'settingsExperience',
    '/admin/settings/invoice': 'settingsInvoice',
    '/admin/settings/admin': 'settingsAdmin',
    '/admin/revenue': 'revenue',
    '/admin/reports': 'reports',
    '/admin/search-analytics': 'searchAnalytics',
    '/admin/trending-searches': 'trendingSearches',
    '/admin/filter-settings': 'filterSettings',
    '/admin/audit-log': 'auditLog',
  };

  const sectionKey = sections[normalized];
  if (sectionKey) {
    const section = crumb(sectionKey, isAr, normalized);
    const settingsParent = crumb('settings', isAr, '/admin/settings');
    if (normalized.startsWith('/admin/settings/')) {
      return {
        title: label(sectionKey, isAr),
        breadcrumbs: [dashboard, settingsParent, { label: label(sectionKey, isAr) }],
      };
    }
    return { title: label(sectionKey, isAr), breadcrumbs: [dashboard, section] };
  }

  return { title: label('dashboard', isAr), breadcrumbs: [dashboard] };
}
