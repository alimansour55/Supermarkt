/** Built-in customer pages editable from admin (slug → URL path). */
export const CONTENT_PAGE_PRESETS = [
  { slug: 'contact', path: '/contact', labelAr: 'اتصل بنا', labelEn: 'Contact Us' },
  { slug: 'faq', path: '/faq', labelAr: 'الأسئلة الشائعة', labelEn: 'FAQ' },
  { slug: 'returns', path: '/returns', labelAr: 'الاسترجاع والاستبدال', labelEn: 'Returns & Exchange' },
  { slug: 'about', path: '/about', labelAr: 'من نحن', labelEn: 'About Us' },
  { slug: 'privacy', path: '/privacy', labelAr: 'سياسة الخصوصية', labelEn: 'Privacy Policy' },
  { slug: 'terms', path: '/terms', labelAr: 'الشروط والأحكام', labelEn: 'Terms & Conditions' },
  { slug: 'careers', path: '/careers', labelAr: 'الوظائف', labelEn: 'Careers' },
];

export const SPECIAL_PAGE_PRESETS = [
  { path: '/', labelAr: 'الرئيسية', labelEn: 'Home' },
  { path: '/offers', labelAr: 'العروض', labelEn: 'Offers' },
  { path: '/products', labelAr: 'المنتجات', labelEn: 'Products' },
  { path: '/track-order', labelAr: 'تتبع الطلب', labelEn: 'Track Order' },
  { path: '/cart', labelAr: 'السلة', labelEn: 'Cart' },
  { path: '/favorites', labelAr: 'المفضلة', labelEn: 'Favorites' },
];

/** Customer account pages (login required on storefront). */
export const ACCOUNT_PAGE_PRESETS = [
  { path: '/profile', labelAr: 'الملف الشخصي', labelEn: 'Profile' },
  { path: '/orders', labelAr: 'طلباتي', labelEn: 'My Orders' },
  { path: '/recurring-deliveries', labelAr: 'التوصيل الدوري', labelEn: 'Recurring delivery' },
  { path: '/my-points', labelAr: 'نقاطي', labelEn: 'My Points' },
  { path: '/my-addresses', labelAr: 'العناوين', labelEn: 'Addresses' },
  { path: '/account/settings', labelAr: 'الإعدادات', labelEn: 'Account settings' },
];

export const PAGE_LABELS = {
  contact: { ar: 'اتصل بنا', en: 'Contact' },
  faq: { ar: 'الأسئلة الشائعة', en: 'FAQ' },
  about: { ar: 'من نحن', en: 'About' },
  terms: { ar: 'الشروط', en: 'Terms' },
  returns: { ar: 'الاسترجاع', en: 'Returns' },
  privacy: { ar: 'الخصوصية', en: 'Privacy' },
  careers: { ar: 'الوظائف', en: 'Careers' },
};

export function normalizeNavHref(href) {
  const trimmed = String(href || '').trim();
  if (!trimmed) return '/';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const path = trimmed.replace(/^\/+/, '');
  return `/${path}`;
}

export function hrefToContentSlug(href) {
  const normalized = normalizeNavHref(href);
  const preset = CONTENT_PAGE_PRESETS.find((p) => p.path === normalized);
  return preset?.slug || null;
}

export function presetForHref(href) {
  const normalized = normalizeNavHref(href);
  return CONTENT_PAGE_PRESETS.find((p) => p.path === normalized)
    || ACCOUNT_PAGE_PRESETS.find((p) => p.path === normalized)
    || SPECIAL_PAGE_PRESETS.find((p) => p.path === normalized)
    || null;
}

export function normalizePageForm(data) {
  return {
    slug: data.slug,
    titleAr: data.titleAr || '',
    titleEn: data.titleEn || '',
    seoTitleAr: data.seoTitleAr || '',
    seoTitleEn: data.seoTitleEn || '',
    seoDescriptionAr: data.seoDescriptionAr || '',
    seoDescriptionEn: data.seoDescriptionEn || '',
    isActive: data.isActive !== false,
    sections: (data.sections || []).map((s) => ({
      headingAr: s.headingAr || '',
      headingEn: s.headingEn || '',
      bodyAr: s.bodyAr || '',
      bodyEn: s.bodyEn || '',
      sortOrder: s.sortOrder ?? 0,
    })),
  };
}

export const emptyContentSection = () => ({
  headingAr: '',
  headingEn: '',
  bodyAr: '',
  bodyEn: '',
});
