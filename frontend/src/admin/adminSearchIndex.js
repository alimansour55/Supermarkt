import {
  Plus,
  ExternalLink,
  Settings,
  Phone,
  Truck,
  Sparkles,
  FileText,
  LayoutDashboard,
} from 'lucide-react';
import { ADMIN_NAV_GROUPS } from './adminNavGroups';

/**
 * Extra search keywords per destination — Arabic synonyms, English synonyms,
 * and the sub-options a user is likely to type when hunting for a screen.
 * Keyed by route path so it stays in sync with adminNavGroups.
 */
const NAV_KEYWORDS = {
  '/admin/sellers': ['seller', 'sellers', 'vendor', 'merchant', 'marketplace', 'بائع', 'بائعين', 'البائعون', 'تاجر', 'تجار', 'سوق', 'متجر خارجي'],
  '/admin/listing-review': ['listing', 'approve', 'moderation', 'queue', 'مراجعة', 'اعتماد', 'منتجات البائعين', 'طابور'],
  '/admin/marketplace-settings': ['commission', 'عمولة', 'payout', 'hold', 'marketplace', 'إعدادات السوق', 'شروط البيع'],
  '/admin': ['home', 'overview', 'رئيسية', 'الرئيسية', 'نظرة عامة', 'stats', 'احصائيات', 'إحصائيات', 'kpi'],
  '/admin/products': ['catalog', 'كتالوج', 'سلعة', 'سلع', 'اصناف', 'أصناف', 'inventory', 'sku', 'باركود', 'barcode', 'price', 'سعر', 'اسعار', 'أسعار'],
  '/admin/stock-alerts': ['out of stock', 'نفاد', 'نفد', 'مخزون منخفض', 'low stock', 'restock', 'اعادة تعبئة', 'الكمية', 'quantity'],
  '/admin/categories': ['category', 'قسم', 'اقسام', 'تصنيف', 'تصنيفات', 'department', 'tree', 'شجرة'],
  '/admin/brands': ['brand', 'ماركة', 'ماركات', 'علامة تجارية', 'manufacturer', 'شركة مصنعة'],
  '/admin/reviews': ['review', 'rating', 'تقييم', 'تقييمات', 'مراجعة', 'مراجعات', 'نجوم', 'stars', 'moderation', 'اعتماد'],
  '/admin/coupons': ['coupon', 'كوبون', 'كوبونات', 'خصم', 'discount code', 'كود خصم', 'promo code', 'قسيمة'],
  '/admin/promotions': ['promotion', 'offer', 'sale', 'عرض', 'عروض', 'تخفيض', 'تخفيضات', 'حملة', 'deal', 'صفقة', 'bogo', 'bundle', 'باقة'],
  '/admin/banners': ['banner', 'بانر', 'بنر', 'حملة', 'حملات', 'campaign', 'slider', 'سلايدر', 'اعلان', 'إعلان'],
  '/admin/orders': ['order', 'طلب', 'طلبات', 'اوردر', 'أوردر', 'purchase', 'مشتريات', 'invoice', 'شحنة', 'shipment', 'checkout'],
  '/admin/invoices': ['invoice', 'فاتورة', 'فواتير', 'receipt', 'إيصال', 'ايصال', 'pdf', 'رقم فاتورة', 'invoice number', 'رقم عميل', 'customer number'],
  '/admin/live-deliveries': ['live', 'مباشر', 'تتبع', 'tracking', 'gps', 'map', 'خريطة', 'مندوب', 'driver', 'سائق', 'delivery'],
  '/admin/recurring-deliveries': ['recurring', 'subscription', 'اشتراك', 'اشتراكات', 'دوري', 'متكرر', 'schedule', 'جدولة'],
  '/admin/order-chats': ['chat', 'message', 'محادثة', 'رسائل', 'رسالة', 'دردشة', 'support', 'دعم', 'inbox', 'وارد'],
  '/admin/returns': ['return', 'refund', 'مرتجع', 'مرتجعات', 'ارجاع', 'إرجاع', 'استرجاع', 'استرداد', 'rma'],
  '/admin/coverage-area': ['coverage', 'تغطية', 'مظلة', 'umbrella', 'general area', 'منطقة عامة', 'radius', 'نصف قطر', 'circle', 'دائرة', 'enforce coverage', 'تفعيل التغطية'],
  '/admin/delivery': ['delivery zone', 'منطقة', 'مناطق', 'توصيل', 'شحن', 'shipping', 'رسوم توصيل', 'delivery fee', 'نطاق'],
  '/admin/fulfillment-locations': ['warehouse', 'مستودع', 'مخزن', 'فرع', 'فروع', 'branch', 'موقع شحن', 'pickup', 'استلام', 'location'],
  '/admin/users': ['user', 'customer', 'مستخدم', 'مستخدمين', 'عميل', 'عملاء', 'account', 'حساب', 'حسابات', 'member'],
  '/admin/team': ['team', 'staff', 'admin team', 'فريق', 'موظف', 'موظفين', 'صلاحيات', 'permission', 'role', 'دور', 'ادوار', 'أدوار', 'مسؤول'],
  '/admin/loyalty': ['loyalty', 'points', 'نقاط', 'ولاء', 'مكافآت', 'rewards', 'cashback', 'كاش باك', 'استرداد نقدي', 'earn', 'redeem'],
  '/admin/wallet': ['wallet', 'محفظة', 'المحفظة', 'رصيد', 'balance', 'top-up', 'topup', 'شحن', 'instapay', 'إنستاباي', 'vodafone cash', 'فودافون كاش', 'store credit', 'refund', 'استرداد'],
  '/admin/homepage': ['homepage', 'home page', 'الصفحة الرئيسية', 'واجهة', 'cms', 'hero', 'سلايدر', 'sections', 'اقسام الرئيسية', 'layout', 'بناء'],
  '/admin/trending-searches': ['trending', 'الأكثر بحثا', 'رائج', 'شائع', 'popular search', 'اقتراحات بحث', 'suggestions', 'هجين', 'hybrid', 'auto-tune', 'ضبط تلقائي', 'الحد', 'blocklist', 'كلمات محجوبة'],
  '/admin/filter-settings': ['filter', 'فلتر', 'فلاتر', 'تصفية', 'facet', 'خصائص', 'attributes', 'sort', 'ترتيب'],
  '/admin/navigation': ['navigation', 'menu', 'قائمة', 'تنقل', 'header', 'footer', 'رأس', 'تذييل', 'روابط', 'links', 'نافبار', 'navbar'],
  '/admin/content': ['content page', 'صفحة', 'صفحات', 'محتوى', 'about', 'من نحن', 'سياسة', 'policy', 'terms', 'شروط', 'faq', 'اسئلة'],
  '/admin/appearance': ['appearance', 'theme', 'مظهر', 'ثيم', 'الوان', 'ألوان', 'color', 'لون', 'logo', 'شعار', 'font', 'خط', 'design', 'تصميم', 'brand color'],
  '/admin/revenue': ['revenue', 'ايراد', 'إيراد', 'إيرادات', 'مبيعات', 'sales', 'دخل', 'income', 'turnover', 'money', 'فلوس'],
  '/admin/reports': ['report', 'تقرير', 'تقارير', 'analytics', 'تحليلات', 'export', 'تصدير', 'chart', 'رسم بياني', 'data'],
  '/admin/partner-revenue': ['partner', 'شريك', 'شركاء', 'commission', 'عمولة', 'payout', 'تسوية', 'توزيع', 'revenue share', 'split', 'rule', 'قاعدة', 'قواعد', 'تخصيص إيراد', 'attribution', 'statement', 'كشف حساب', 'كشف الحساب', 'ledger', 'دفتر', 'bank batch', 'دفعة بنكية', 'simulate', 'محاكاة'],
  '/admin/search-analytics': ['search analytics', 'تحليلات البحث', 'كلمات البحث', 'search terms', 'zero results', 'بدون نتائج', 'query', 'استعلام'],
  '/admin/settings': ['settings', 'اعداد', 'إعداد', 'اعدادات', 'إعدادات', 'تهيئة', 'config', 'configuration', 'خيارات', 'options', 'preferences'],
  '/admin/payments': ['payment', 'دفع', 'مدفوعات', 'طريقة دفع', 'بطاقة', 'card', 'stripe', 'سترايب', 'paymob', 'باي موب', 'fawry', 'فوري', 'valu', 'فاليو', 'apple pay', 'cod', 'الدفع عند الاستلام', 'تحويل بنكي', 'bank transfer', 'محفظة', 'wallet', 'vodafone cash', 'فودافون كاش', 'instapay', 'انستا باي'],
  '/admin/notifications': ['notification', 'اشعار', 'إشعار', 'اشعارات', 'إشعارات', 'template', 'قالب', 'قوالب', 'sms', 'email', 'بريد', 'رسالة نصية', 'push', 'whatsapp', 'واتساب'],
  '/admin/audit-log': ['audit', 'تدقيق', 'سجل', 'logs', 'history', 'تاريخ', 'activity', 'نشاط', 'من غيّر', 'who changed', 'تتبع التغييرات'],
};

/** Store-settings sub-sections + notable options inside each (deep links). */
const SETTINGS_ENTRIES = [
  {
    key: 'settings-identity',
    path: '/admin/settings/identity',
    Icon: Settings,
    titleAr: 'هوية المتجر',
    titleEn: 'Store identity',
    descAr: 'الاسم والشعار والعملة',
    descEn: 'Name, logo, and currency',
    keywords: ['store name', 'اسم المتجر', 'شعار', 'logo', 'favicon', 'ايقونة', 'عملة', 'currency', 'egp', 'جنيه', 'ريال', 'دولار', 'tagline', 'وصف المتجر', 'هوية', 'branding', 'seo', 'meta', 'ميتا', 'وصف', 'description', 'keywords', 'كلمات مفتاحية', 'sitemap', 'خريطة الموقع', 'og', 'محركات البحث', 'جوجل', 'google'],
  },
  {
    key: 'settings-contact',
    path: '/admin/settings/contact',
    Icon: Phone,
    titleAr: 'التواصل والروابط',
    titleEn: 'Contact & links',
    descAr: 'الدعم ووسائل التواصل وتطبيقات الجوال',
    descEn: 'Support, social media, and app links',
    keywords: ['phone', 'هاتف', 'رقم', 'whatsapp', 'واتساب', 'email', 'بريد', 'ايميل', 'facebook', 'فيسبوك', 'instagram', 'انستجرام', 'tiktok', 'تيك توك', 'address', 'عنوان', 'app store', 'google play', 'تطبيق', 'social', 'سوشيال', 'دعم', 'support'],
  },
  {
    key: 'settings-delivery',
    path: '/admin/settings/delivery',
    Icon: Truck,
    titleAr: 'إعدادات التوصيل',
    titleEn: 'Delivery settings',
    descAr: 'التوصيل المجاني، الخريطة، والمهلة',
    descEn: 'Free delivery, map pin, and lead times',
    keywords: ['free delivery', 'توصيل مجاني', 'شحن مجاني', 'حد التوصيل المجاني', 'threshold', 'map pin', 'دبوس الخريطة', 'gps', 'lead time', 'مهلة', 'وقت التحضير', 'prep time', 'الحد الادنى للطلب', 'minimum order', 'رسوم'],
  },
  {
    key: 'settings-experience',
    path: '/admin/settings/experience',
    Icon: Sparkles,
    titleAr: 'تجربة العميل',
    titleEn: 'Customer experience',
    descAr: 'المخزون والتقييمات والمساعد الذكي',
    descEn: 'Stock alerts, reviews, and AI chat',
    keywords: ['ai chat', 'المساعد الذكي', 'شات بوت', 'chatbot', 'low stock alert', 'تنبيه المخزون المنخفض', 'حد المخزون', 'review request', 'طلب التقييم', 'add to cart toast', 'اشعار السلة', 'sms review', 'email review'],
  },
  {
    key: 'settings-invoice',
    path: '/admin/settings/invoice',
    Icon: FileText,
    titleAr: 'إعدادات الفاتورة',
    titleEn: 'Invoice settings',
    descAr: 'نصوص وخيارات فاتورة PDF',
    descEn: 'PDF invoice text and display options',
    keywords: ['invoice', 'فاتورة', 'pdf', 'رقم ضريبي', 'tax number', 'vat', 'ضريبة', 'الرقم الضريبي', 'footer note', 'ملاحظة الفاتورة', 'terms', 'شروط', 'سجل تجاري', 'commercial register'],
  },
  {
    key: 'settings-admin',
    path: '/admin/settings/admin',
    Icon: LayoutDashboard,
    titleAr: 'إعدادات لوحة التحكم',
    titleEn: 'Admin panel settings',
    descAr: 'ما يظهر للمسؤولين في اللوحة',
    descEn: 'What admins see in the dashboard',
    keywords: ['show revenue', 'اظهار الايرادات', 'اخفاء الايرادات', 'hide revenue', 'dashboard widgets', 'ودجت', 'عناصر اللوحة', 'permissions display', 'لوحة المسؤول'],
  },
];

/** Quick actions — not screens, verbs the user might search for. */
const ACTION_ENTRIES = [
  {
    key: 'action-new-product',
    path: '/admin/products/new',
    Icon: Plus,
    titleAr: 'إضافة منتج جديد',
    titleEn: 'Add new product',
    groupAr: 'إجراء سريع',
    groupEn: 'Quick action',
    permission: 'products:read',
    keywords: ['create product', 'اضف منتج', 'منتج جديد', 'new item', 'اضافة صنف', 'add sku'],
  },
  {
    key: 'action-open-store',
    path: '/',
    Icon: ExternalLink,
    external: true,
    titleAr: 'فتح المتجر',
    titleEn: 'Open storefront',
    groupAr: 'إجراء سريع',
    groupEn: 'Quick action',
    permission: null,
    keywords: ['view store', 'زيارة المتجر', 'الواجهة', 'storefront', 'preview store', 'المتجر الالكتروني'],
  },
];

/**
 * Build the flat, permission-agnostic search catalogue.
 * Filtering by permission happens at query time so the index is memo-stable.
 */
export function buildAdminSearchEntries() {
  const entries = [];

  for (const group of ADMIN_NAV_GROUPS) {
    for (const item of group.items) {
      entries.push({
        key: `nav:${item.path}`,
        path: item.path,
        Icon: item.Icon,
        titleAr: item.labelAr,
        titleEn: item.labelEn,
        groupAr: group.labelAr,
        groupEn: group.labelEn,
        permission: item.permission ?? null,
        requiresRevenue: item.requiresRevenue ?? false,
        keywords: NAV_KEYWORDS[item.path] ?? [],
      });
    }
  }

  const settingsGroupAr = 'الإعدادات';
  const settingsGroupEn = 'Settings';
  for (const s of SETTINGS_ENTRIES) {
    entries.push({
      key: s.key,
      path: s.path,
      Icon: s.Icon,
      titleAr: s.titleAr,
      titleEn: s.titleEn,
      descAr: s.descAr,
      descEn: s.descEn,
      groupAr: settingsGroupAr,
      groupEn: settingsGroupEn,
      permission: 'settings:write',
      keywords: s.keywords,
    });
  }

  for (const a of ACTION_ENTRIES) {
    entries.push({ ...a, keywords: a.keywords ?? [] });
  }

  return entries;
}

/* ---------- text normalisation + fuzzy scoring ---------- */

const AR_DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;
const AR_DIACRITIC_CHAR = new RegExp(AR_DIACRITICS.source);

export function normalizeSearchText(value) {
  if (!value) return '';
  return String(value)
    .toLowerCase()
    .replace(AR_DIACRITICS, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[_\-/\\.,:؛;()[\]{}'"]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Character-preserving normalisation with an index map back to the source.
 * Used for highlighting so <mark> ranges land on the right original characters.
 * @returns {{ norm: string, map: number[] }} map[i] = source index of norm[i]
 */
export function normalizeWithMap(value) {
  const src = String(value || '');
  let norm = '';
  const map = [];
  let pendingSpace = false;
  for (let i = 0; i < src.length; i += 1) {
    let ch = src[i].toLowerCase();
    if (AR_DIACRITIC_CHAR.test(ch)) continue;
    if ('أإآ'.includes(ch)) ch = 'ا';
    else if (ch === 'ى') ch = 'ي';
    else if (ch === 'ؤ') ch = 'و';
    else if (ch === 'ئ') ch = 'ي';
    else if (ch === 'ة') ch = 'ه';
    else if (/[_\-/\\.,:؛;()[\]{}'"]/.test(ch) || /\s/.test(ch)) {
      pendingSpace = norm.length > 0;
      continue;
    }
    if (pendingSpace) { norm += ' '; map.push(i - 1); pendingSpace = false; }
    norm += ch;
    map.push(i);
  }
  return { norm, map };
}

/** Subsequence match (chars in order, gaps allowed). Returns a small bonus score or 0. */
function subsequenceScore(haystack, needle) {
  if (!needle) return 0;
  let hi = 0;
  let matched = 0;
  let tightRuns = 0;
  let prevIdx = -2;
  for (let ni = 0; ni < needle.length; ni += 1) {
    const ch = needle[ni];
    let found = -1;
    for (let k = hi; k < haystack.length; k += 1) {
      if (haystack[k] === ch) { found = k; break; }
    }
    if (found === -1) return 0;
    if (found === prevIdx + 1) tightRuns += 1;
    prevIdx = found;
    hi = found + 1;
    matched += 1;
  }
  if (matched < needle.length) return 0;
  return 20 + tightRuns;
}

/**
 * Score one entry against a normalized multi-token query.
 * Every token must hit somewhere; higher = better. Returns 0 for no match.
 */
export function scoreEntry(entry, tokens, isAr) {
  if (!tokens.length) return 0;

  const primary = normalizeSearchText(isAr ? entry.titleAr : entry.titleEn);
  const secondary = normalizeSearchText(isAr ? entry.titleEn : entry.titleAr);
  const group = normalizeSearchText(`${entry.groupAr || ''} ${entry.groupEn || ''}`);
  const desc = normalizeSearchText(`${entry.descAr || ''} ${entry.descEn || ''}`);
  const keywords = entry.keywords.map(normalizeSearchText);
  const keywordBlob = keywords.join(' ');

  let total = 0;

  for (const token of tokens) {
    let best = 0;

    if (primary === token) best = Math.max(best, 120);
    if (primary.startsWith(token)) best = Math.max(best, 90);
    else if (primary.includes(` ${token}`)) best = Math.max(best, 78);
    else if (primary.includes(token)) best = Math.max(best, 64);

    if (secondary.includes(token)) best = Math.max(best, 48);
    if (keywords.some((k) => k === token)) best = Math.max(best, 70);
    if (keywords.some((k) => k.startsWith(token))) best = Math.max(best, 56);
    if (keywordBlob.includes(token)) best = Math.max(best, 42);
    if (group.includes(token)) best = Math.max(best, 30);
    if (desc.includes(token)) best = Math.max(best, 34);

    if (best === 0 && token.length >= 3) {
      best = Math.max(
        subsequenceScore(primary, token),
        subsequenceScore(keywordBlob, token) ? 14 : 0,
      );
    }

    if (best === 0) return 0; // this token matched nothing → drop entry
    total += best;
  }

  // whole-query contiguous match on the title is a strong signal
  const joined = tokens.join(' ');
  if (primary.includes(joined)) total += 40;

  return total;
}

/**
 * @param {object[]} entries  from buildAdminSearchEntries()
 * @param {string} query
 * @param {{ isAr: boolean, canAccess: (entry) => boolean, recentKeys?: string[] }} opts
 */
export function searchAdmin(entries, query, { isAr, canAccess, recentKeys = [] }) {
  const normalized = normalizeSearchText(query);
  const tokens = normalized ? normalized.split(' ').filter(Boolean) : [];
  const recentRank = new Map(recentKeys.map((k, i) => [k, recentKeys.length - i]));

  if (!tokens.length) {
    // no query → surface recents, then a sensible default shortlist
    const recents = recentKeys
      .map((k) => entries.find((e) => e.key === k))
      .filter((e) => e && canAccess(e))
      .map((e) => ({ entry: e, score: 0, recent: true }));
    return recents.slice(0, 7);
  }

  const results = [];
  for (const entry of entries) {
    if (!canAccess(entry)) continue;
    let score = scoreEntry(entry, tokens, isAr);
    if (!score) continue;
    if (recentRank.has(entry.key)) score += 6 + recentRank.get(entry.key);
    results.push({ entry, score, recent: recentRank.has(entry.key) });
  }

  results.sort((a, b) => (
    b.score - a.score
    || normalizeSearchText(isAr ? a.entry.titleAr : a.entry.titleEn)
      .localeCompare(normalizeSearchText(isAr ? b.entry.titleAr : b.entry.titleEn))
  ));

  return results.slice(0, 12);
}
