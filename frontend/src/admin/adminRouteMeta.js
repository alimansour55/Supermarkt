const LABELS = {
  dashboard: { ar: 'لوحة التحكم', en: 'Dashboard' },
  products: { ar: 'المنتجات', en: 'Products' },
  newProduct: { ar: 'إضافة منتج', en: 'Add product' },
  edit: { ar: 'تعديل', en: 'Edit' },
  categories: { ar: 'الأقسام', en: 'Categories' },
  orders: { ar: 'الطلبات', en: 'Orders' },
  users: { ar: 'المستخدمين', en: 'Users' },
  coupons: { ar: 'الكوبونات', en: 'Coupons' },
  banners: { ar: 'البانرات', en: 'Banners' },
  reports: { ar: 'التقارير', en: 'Reports' },
  auditLog: { ar: 'سجل التدقيق', en: 'Audit log' },
};

function label(key, isAr) {
  return LABELS[key][isAr ? 'ar' : 'en'];
}

function crumb(key, isAr, to) {
  return { label: label(key, isAr), to };
}

/**
 * @returns {{ title: string, breadcrumbs: { label: string, to?: string }[] }}
 */
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
    '/admin/orders': 'orders',
    '/admin/users': 'users',
    '/admin/coupons': 'coupons',
    '/admin/banners': 'banners',
    '/admin/reports': 'reports',
    '/admin/audit-log': 'auditLog',
  };

  const sectionKey = sections[normalized];
  if (sectionKey) {
    const section = crumb(sectionKey, isAr, normalized);
    return { title: label(sectionKey, isAr), breadcrumbs: [dashboard, section] };
  }

  return { title: label('dashboard', isAr), breadcrumbs: [dashboard] };
}
