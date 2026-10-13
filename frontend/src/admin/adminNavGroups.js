import {
  Home,
  ShoppingBag,
  MessagesSquare,
  Package,
  FolderTree,
  Star,
  BadgePercent,
  Megaphone,
  Image,
  Users,
  Building2,
  LayoutTemplate,
  Search,
  LineChart,
  Settings,
} from 'lucide-react';

/**
 * The admin menu.
 *
 * Each sidebar item is one job. When a job has several screens they are
 * listed in `tabs` and shown as tabs at the top of the page; the item links
 * to the first tab the user can open. URLs never change, so bookmarks and
 * links inside the app keep working.
 *
 * Optional per item / tab:
 *   permission       — hidden unless the user has it (array = any of them)
 *   badgeKey         — counter from AdminStatsContext
 *   feature          — hidden while that feature is switched off
 *   requiresRevenue  — hidden when "show revenue" is off
 */
export const ADMIN_NAV_GROUPS = [
  {
    id: 'home',
    labelAr: '',
    labelEn: '',
    items: [
      { id: 'home', path: '/admin', labelAr: 'الرئيسية', labelEn: 'Home', Icon: Home, permission: 'dashboard:read' },
    ],
  },
  {
    id: 'daily',
    labelAr: 'الشغل اليومي',
    labelEn: 'Daily work',
    items: [
      {
        id: 'orders',
        labelAr: 'الطلبات',
        labelEn: 'Orders',
        Icon: ShoppingBag,
        tabs: [
          { path: '/admin/orders', labelAr: 'كل الطلبات', labelEn: 'All orders', permission: 'orders:read', badgeKey: 'pendingOrders' },
          { path: '/admin/live-deliveries', labelAr: 'المندوبون على الخريطة', labelEn: 'Drivers on the map', permission: 'orders:read' },
          { path: '/admin/returns', labelAr: 'المرتجعات', labelEn: 'Returns', permission: 'orders:read', badgeKey: 'pendingReturns' },
          { path: '/admin/recurring-deliveries', labelAr: 'اشتراكات التوصيل', labelEn: 'Delivery subscriptions', permission: 'orders:read' },
          { path: '/admin/invoices', labelAr: 'الفواتير', labelEn: 'Invoices', permission: 'orders:read' },
          { path: '/admin/order-trash', labelAr: 'الطلبات المحذوفة', labelEn: 'Deleted orders', permission: 'orders:delete' },
        ],
      },
      {
        id: 'messages',
        labelAr: 'رسائل العملاء',
        labelEn: 'Customer messages',
        Icon: MessagesSquare,
        tabs: [
          { path: '/admin/order-chats', labelAr: 'رسائل الطلبات', labelEn: 'Order messages', permission: 'orders:read', badgeKey: 'unreadOrderMessages' },
          { path: '/admin/live-chat', labelAr: 'المحادثة المباشرة', labelEn: 'Live chat', permission: 'support:chat', badgeKey: 'pendingLiveChats', feature: 'liveChat' },
          { path: '/admin/callback-requests', labelAr: 'طلبات الاتصال', labelEn: 'Call me back', permission: 'orders:read', badgeKey: 'pendingCallbackRequests' },
        ],
      },
    ],
  },
  {
    id: 'products',
    labelAr: 'المنتجات',
    labelEn: 'Products',
    items: [
      {
        id: 'products',
        labelAr: 'المنتجات والمخزون',
        labelEn: 'Products & stock',
        Icon: Package,
        tabs: [
          { path: '/admin/products', labelAr: 'كل المنتجات', labelEn: 'All products', permission: 'products:read' },
          { path: '/admin/stock-alerts', labelAr: 'نقص المخزون', labelEn: 'Running low', permission: 'products:read', badgeKey: 'outOfStockCount' },
        ],
      },
      {
        id: 'categories',
        labelAr: 'الأقسام والماركات',
        labelEn: 'Categories & brands',
        Icon: FolderTree,
        tabs: [
          { path: '/admin/categories', labelAr: 'الأقسام', labelEn: 'Categories', permission: 'categories:write' },
          { path: '/admin/brands', labelAr: 'الماركات', labelEn: 'Brands', permission: 'brands:write' },
        ],
      },
      {
        id: 'reviews',
        path: '/admin/reviews',
        labelAr: 'تقييمات العملاء',
        labelEn: 'Customer reviews',
        Icon: Star,
        permission: 'reviews:moderate',
        badgeKey: 'pendingReviews',
      },
    ],
  },
  {
    id: 'sell-more',
    labelAr: 'زيادة المبيعات',
    labelEn: 'Sell more',
    items: [
      {
        id: 'offers',
        labelAr: 'العروض والخصومات',
        labelEn: 'Offers & discounts',
        Icon: BadgePercent,
        tabs: [
          { path: '/admin/promotions', labelAr: 'العروض', labelEn: 'Offers', permission: 'promotions:write' },
          { path: '/admin/coupons', labelAr: 'أكواد الخصم', labelEn: 'Discount codes', permission: 'coupons:write' },
        ],
      },
      {
        id: 'marketing',
        labelAr: 'تسويق للعملاء',
        labelEn: 'Customer marketing',
        Icon: Megaphone,
        tabs: [
          { path: '/admin/cart-recovery', labelAr: 'السلال المتروكة', labelEn: 'Abandoned carts', permission: 'promotions:write' },
          { path: '/admin/loyalty', labelAr: 'نقاط المكافآت', labelEn: 'Reward points', permission: 'settings:write', feature: 'loyalty' },
          { path: '/admin/push', labelAr: 'إشعار للتطبيق', labelEn: 'App notification', permission: 'notifications:write' },
        ],
      },
      {
        id: 'banners',
        path: '/admin/banners',
        labelAr: 'البانرات',
        labelEn: 'Banners',
        Icon: Image,
        permission: 'banners:write',
      },
    ],
  },
  {
    id: 'people',
    labelAr: 'العملاء والبائعون',
    labelEn: 'People',
    items: [
      {
        id: 'customers',
        labelAr: 'العملاء',
        labelEn: 'Customers',
        Icon: Users,
        tabs: [
          { path: '/admin/users', labelAr: 'كل العملاء', labelEn: 'All customers', permission: 'users:read' },
          { path: '/admin/wallet', labelAr: 'رصيد المحافظ', labelEn: 'Wallet balances', permission: 'settings:write', feature: 'wallet' },
        ],
      },
      {
        id: 'sellers',
        labelAr: 'البائعون',
        labelEn: 'Sellers',
        Icon: Building2,
        feature: 'marketplace',
        tabs: [
          { path: '/admin/sellers', labelAr: 'كل البائعين', labelEn: 'All sellers', permission: 'sellers:read', badgeKey: 'pendingSellers' },
          { path: '/admin/listing-review', labelAr: 'منتجات تنتظر الموافقة', labelEn: 'Products to approve', permission: 'sellers:read', badgeKey: 'pendingListings' },
          { path: '/admin/seller-promotions', labelAr: 'عروض البائعين', labelEn: 'Seller offers', permission: 'sellers:read' },
          { path: '/admin/seller-shipments', labelAr: 'شحنات البائعين', labelEn: 'Seller parcels', permission: 'orders:read' },
          { path: '/admin/seller-inbound', labelAr: 'بضاعة واردة للمخزن', labelEn: 'Stock coming in', permission: 'products:read' },
        ],
      },
    ],
  },
  {
    id: 'storefront',
    labelAr: 'واجهة المتجر',
    labelEn: 'Storefront',
    items: [
      {
        id: 'design',
        labelAr: 'تصميم المتجر',
        labelEn: 'Store design',
        Icon: LayoutTemplate,
        tabs: [
          { path: '/admin/homepage', labelAr: 'الصفحة الرئيسية', labelEn: 'Home page', permission: 'homepage:write' },
          { path: '/admin/navigation', labelAr: 'القوائم أعلى وأسفل الموقع', labelEn: 'Top & bottom menus', permission: 'settings:write' },
          { path: '/admin/appearance', labelAr: 'الألوان والشكل', labelEn: 'Colors & look', permission: 'settings:write' },
          { path: '/admin/content', labelAr: 'صفحات المعلومات', labelEn: 'Info pages', permission: 'content:write' },
        ],
      },
      {
        id: 'search',
        labelAr: 'البحث في المتجر',
        labelEn: 'Store search',
        Icon: Search,
        tabs: [
          { path: '/admin/search-analytics', labelAr: 'ماذا يبحث العملاء', labelEn: 'What people search', permission: 'reports:read' },
          { path: '/admin/trending-searches', labelAr: 'كلمات مقترحة', labelEn: 'Suggested searches', permission: 'settings:write' },
          { path: '/admin/filter-settings', labelAr: 'فلاتر المنتجات', labelEn: 'Product filters', permission: 'settings:write' },
        ],
      },
    ],
  },
  {
    id: 'money',
    labelAr: 'الأرباح',
    labelEn: 'Money',
    items: [
      {
        id: 'revenue',
        labelAr: 'المبيعات والأرباح',
        labelEn: 'Sales & money',
        Icon: LineChart,
        tabs: [
          { path: '/admin/revenue', labelAr: 'المبيعات', labelEn: 'Sales', permission: 'reports:read', requiresRevenue: true },
          { path: '/admin/reports', labelAr: 'التقارير', labelEn: 'Reports', permission: 'reports:read', requiresRevenue: true },
          { path: '/admin/partner-revenue', labelAr: 'حصص الشركاء', labelEn: 'Partner shares', permission: 'reports:read', requiresRevenue: true, feature: 'partnerRevenue' },
          { path: '/admin/seller-payouts', labelAr: 'مستحقات البائعين', labelEn: 'Seller payouts', permission: 'reports:read', feature: 'marketplace' },
        ],
      },
    ],
  },
  {
    id: 'settings',
    labelAr: '',
    labelEn: '',
    items: [
      {
        id: 'settings',
        path: '/admin/settings',
        labelAr: 'الإعدادات',
        labelEn: 'Settings',
        Icon: Settings,
        permission: ['settings:write', 'delivery:write', 'notifications:write', 'users:write', 'audit:read'],
      },
    ],
  },
];

/**
 * Everything reachable from the Settings page. Grouped the way a store owner
 * thinks about it, not the way the code is split.
 * `match` lists extra URL prefixes that belong to the entry (sub-pages).
 */
export const SETTINGS_GROUPS = [
  {
    id: 'store',
    labelAr: 'المتجر',
    labelEn: 'Your store',
    items: [
      { path: '/admin/settings/identity', labelAr: 'اسم المتجر والشعار', labelEn: 'Name & logo', descAr: 'الاسم، الشعار، العملة، وظهورك في جوجل', descEn: 'Name, logo, currency and how you show up on Google', permission: 'settings:write' },
      { path: '/admin/settings/contact', labelAr: 'أرقام التواصل والروابط', labelEn: 'Contact & social links', descAr: 'الهاتف، واتساب، السوشيال، روابط التطبيق', descEn: 'Phone, WhatsApp, social media, app links', permission: 'settings:write' },
      { path: '/admin/settings/experience', labelAr: 'خيارات التسوق', labelEn: 'Shopping options', descAr: 'تنبيهات المخزون، طلب التقييم، المساعد الذكي', descEn: 'Stock warnings, review requests, AI assistant', permission: 'settings:write' },
      { path: '/admin/settings/invoice', labelAr: 'شكل الفاتورة', labelEn: 'Invoice layout', descAr: 'البيانات والنصوص المطبوعة على الفاتورة', descEn: 'What gets printed on the invoice', permission: 'settings:write' },
    ],
  },
  {
    id: 'delivery',
    labelAr: 'التوصيل',
    labelEn: 'Delivery',
    items: [
      { path: '/admin/settings/delivery', labelAr: 'قواعد التوصيل', labelEn: 'Delivery rules', descAr: 'التوصيل المجاني، الحد الأدنى، مواعيد التجهيز', descEn: 'Free delivery, minimum order, preparation time', permission: 'settings:write' },
      { path: '/admin/delivery', labelAr: 'المناطق والأسعار', labelEn: 'Areas & fees', descAr: 'المناطق التي توصل لها وسعر كل منطقة', descEn: 'Where you deliver and what each area costs', permission: 'delivery:write' },
      { path: '/admin/coverage-area', labelAr: 'حدود التغطية', labelEn: 'Coverage limit', descAr: 'أقصى مسافة يقبل منها طلب', descEn: 'The furthest you accept orders from', permission: 'delivery:write' },
      { path: '/admin/fulfillment-locations', labelAr: 'الفروع والمخازن', labelEn: 'Branches & warehouses', descAr: 'من أين تخرج الطلبات', descEn: 'Where orders are packed and sent from', permission: 'delivery:write' },
    ],
  },
  {
    id: 'payments',
    labelAr: 'الدفع والتواصل',
    labelEn: 'Payments & messages',
    items: [
      { path: '/admin/payments', labelAr: 'طرق الدفع', labelEn: 'Payment methods', descAr: 'كاش، بطاقات، فوري، محافظ', descEn: 'Cash, cards, Fawry, mobile wallets', permission: 'settings:write' },
      { path: '/admin/customer-service', labelAr: 'وسائل خدمة العملاء', labelEn: 'Help channels', descAr: 'كيف يتواصل معك العميل', descEn: 'How customers reach you', permission: 'settings:write' },
      { path: '/admin/notifications', labelAr: 'نصوص الرسائل للعملاء', labelEn: 'Customer message texts', descAr: 'رسائل SMS والبريد والإشعارات التلقائية', descEn: 'Automatic SMS, email and app messages', permission: 'notifications:write' },
    ],
  },
  {
    id: 'team',
    labelAr: 'الفريق',
    labelEn: 'Team',
    items: [
      { path: '/admin/team', labelAr: 'الموظفون والصلاحيات', labelEn: 'Staff & permissions', descAr: 'من يدخل اللوحة وماذا يستطيع أن يفعل', descEn: 'Who can sign in and what they can do', permission: 'users:write' },
      { path: '/admin/audit-log', labelAr: 'سجل التغييرات', labelEn: 'Change history', descAr: 'من غيّر ماذا ومتى', descEn: 'Who changed what, and when', permission: 'audit:read' },
      { path: '/admin/settings/admin', labelAr: 'خيارات لوحة التحكم', labelEn: 'Admin panel options', descAr: 'إظهار أو إخفاء أرقام المبيعات', descEn: 'Show or hide sales figures', permission: 'settings:write' },
    ],
  },
  {
    id: 'features',
    labelAr: 'خدمات إضافية',
    labelEn: 'Extra features',
    hintAr: 'شغّل أو أوقف الخدمات التي لا تحتاجها — ما يتوقف يختفي من القائمة.',
    hintEn: 'Turn off what you don’t use — it disappears from the menu.',
    items: [
      { path: '/admin/marketplace-settings', feature: 'marketplace', labelAr: 'البيع عن طريق بائعين', labelEn: 'Outside sellers', descAr: 'السماح لتجار آخرين بالبيع في متجرك', descEn: 'Let other merchants sell in your store', permission: 'settings:write' },
      { path: '/admin/loyalty', feature: 'loyalty', labelAr: 'نقاط المكافآت', labelEn: 'Reward points', descAr: 'العميل يجمع نقاطاً مع كل طلب', descEn: 'Customers earn points on every order', permission: 'settings:write' },
      { path: '/admin/wallet', feature: 'wallet', labelAr: 'محفظة العميل', labelEn: 'Customer wallet', descAr: 'رصيد يشحنه العميل ويدفع منه', descEn: 'Credit customers top up and pay with', permission: 'settings:write' },
      { path: '/admin/live-chat', feature: 'liveChat', labelAr: 'المحادثة المباشرة', labelEn: 'Live chat', descAr: 'موظف يرد على العملاء لحظياً', descEn: 'Staff answer customers in real time', permission: 'support:chat' },
      { path: '/admin/partner-revenue', feature: 'partnerRevenue', labelAr: 'حصص الشركاء', labelEn: 'Partner shares', descAr: 'تقسيم الأرباح على الشركاء', descEn: 'Split profit between partners', permission: 'reports:read' },
    ],
  },
];

const ensureArray = (value) => (Array.isArray(value) ? value : [value]);

/** Every leaf screen an item covers (its tabs, or itself). */
export function itemScreens(item) {
  return item.tabs?.length ? item.tabs : [item];
}

export function isPathActive(pathname, path) {
  const clean = pathname.replace(/\/$/, '') || '/admin';
  if (path === '/admin') return clean === '/admin';
  return clean === path || clean.startsWith(`${path}/`);
}

/**
 * @param {{ can: (permission) => boolean, showRevenue: boolean, features: Record<string, boolean> }} ctx
 */
export function isEntryVisible(entry, { can, showRevenue, features = {} }) {
  if (entry.permission && !ensureArray(entry.permission).some((p) => can(p))) return false;
  if (entry.requiresRevenue && !showRevenue) return false;
  if (entry.feature && features[entry.feature] === false) return false;
  return true;
}

/** The menu as this user should see it — empty items/groups removed, tabs filtered. */
export function getVisibleNav(ctx) {
  return ADMIN_NAV_GROUPS
    .filter((group) => isEntryVisible(group, ctx))
    .map((group) => ({
      ...group,
      items: group.items
        .map((item) => {
          if (!item.tabs) return isEntryVisible(item, ctx) ? item : null;
          const tabs = item.tabs.filter((tab) => isEntryVisible(tab, ctx));
          if (!tabs.length || !isEntryVisible(item, ctx)) return null;
          return { ...item, tabs, path: tabs[0].path };
        })
        .filter(Boolean),
    }))
    .filter((group) => group.items.length > 0);
}

/** Settings page sections as this user should see them (features shown even when off). */
export function getVisibleSettings(ctx) {
  const settingsCtx = { ...ctx, features: {} };
  return SETTINGS_GROUPS
    .map((group) => ({ ...group, items: group.items.filter((item) => isEntryVisible(item, settingsCtx)) }))
    .filter((group) => group.items.length > 0);
}

/**
 * Where a URL sits in the menu. Settings sub-screens win over sidebar items
 * only when the sidebar doesn't already show that screen (e.g. loyalty is
 * both a feature switch and a marketing tab — when the tab is visible, the
 * sidebar entry owns it).
 */
export function locateNav(pathname, visibleNav) {
  for (const group of visibleNav) {
    for (const item of group.items) {
      if (item.id === 'settings') continue;
      const screens = itemScreens(item);
      const tab = [...screens]
        .sort((a, b) => b.path.length - a.path.length)
        .find((screen) => isPathActive(pathname, screen.path));
      if (tab) return { group, item, tab: item.tabs ? tab : null, setting: null };
    }
  }
  for (const group of SETTINGS_GROUPS) {
    const setting = group.items.find((entry) => isPathActive(pathname, entry.path));
    if (setting) return { group: null, item: { id: 'settings' }, tab: null, setting };
  }
  if (isPathActive(pathname, '/admin/settings')) {
    return { group: null, item: { id: 'settings' }, tab: null, setting: null };
  }
  return null;
}

/** Flat list of every sidebar destination (used by search). */
export const ADMIN_NAV = ADMIN_NAV_GROUPS.flatMap((group) => group.items.flatMap((item) => (
  item.tabs
    ? item.tabs.map((tab) => ({ ...tab, parentLabelAr: item.labelAr, parentLabelEn: item.labelEn, Icon: item.Icon, group }))
    : [{ ...item, group }]
)));
