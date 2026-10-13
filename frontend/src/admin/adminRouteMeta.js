const t = (isAr, ar, en) => (isAr ? ar : en);

/**
 * Header title (and a "back to …" trail only for screens that live inside
 * another one). `current` comes from locateNav().
 */
export function getAdminPageMeta(pathname, isAr, current) {
  const clean = pathname.replace(/\/$/, '') || '/admin';
  const label = (entry) => (entry ? t(isAr, entry.labelAr, entry.labelEn) : '');

  if (clean === '/admin/products/new' || /^\/admin\/products\/[^/]+\/edit$/.test(clean)) {
    return {
      title: clean.endsWith('/new') ? t(isAr, 'منتج جديد', 'New product') : t(isAr, 'تعديل منتج', 'Edit product'),
      breadcrumbs: [{ label: t(isAr, 'المنتجات', 'Products'), to: '/admin/products' }],
    };
  }

  if (current?.setting) {
    return {
      title: label(current.setting),
      breadcrumbs: [{ label: t(isAr, 'الإعدادات', 'Settings'), to: '/admin/settings' }],
    };
  }

  if (current?.item?.id === 'settings') {
    return { title: t(isAr, 'الإعدادات', 'Settings'), breadcrumbs: [] };
  }

  if (current?.item) {
    return { title: label(current.item), breadcrumbs: [] };
  }

  return { title: '', breadcrumbs: [] };
}
