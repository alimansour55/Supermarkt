import {
  Plus,
  ExternalLink,
  Settings,
} from 'lucide-react';
import { ADMIN_NAV_GROUPS, SETTINGS_GROUPS } from './adminNavGroups';

/**
 * Extra search keywords per destination — Arabic synonyms, English synonyms,
 * and the sub-options a user is likely to type when hunting for a screen.
 * Keyed by route path so it stays in sync with adminNavGroups.
 */
const NAV_KEYWORDS = {
  '/admin/live-chat': ['live chat', 'الدردشة المباشرة', 'agents', 'موظفي الدعم'],
  '/admin/callback-requests': ['callback requests', 'طلبات الاتصال', 'call back', 'اتصل بي'],
  '/admin/customer-service': ['customer service', 'خدمة العملاء', 'contact channels'],
  '/admin/push': ['app push notifications', 'إشعارات التطبيق', 'push', 'broadcast', 'إرسال للكل'],
  '/admin/order-trash': ['recycle bin', 'سلة المحذوفات', 'trash'],
  '/admin/sellers': ['seller', 'sellers', 'vendor', 'merchant', 'marketplace', 'بائع', 'بائعين', 'البائعون', 'تاجر', 'تجار', 'سوق', 'متجر خارجي'],
  '/admin/seller-inbound': ['seller inbound stock', 'مخزون البائعين الوارد', 'inbound', 'وارد', 'استلام', 'receive', 'warehouse', 'مخزن', 'مستودع', 'ASN'],
  '/admin/seller-payouts': ['payout', 'تحويل', 'تحويلات', 'مدفوعات', 'رصيد', 'balance', 'ledger', 'كشف حساب', 'settlement', 'تسوية', 'bank batch'],
  '/admin/seller-shipments': ['shipment', 'شحنة', 'شحنات', 'seller orders', 'طلبات البائعين', 'tracking', 'تتبع', 'manual refund', 'استرداد'],
  '/admin/listing-review': ['listing review', 'مراجعة المنتجات', 'listing', 'approve', 'moderation', 'queue', 'مراجعة', 'اعتماد', 'منتجات البائعين', 'طابور'],
  '/admin/marketplace-settings': ['commission', 'عمولة', 'payout', 'hold', 'marketplace', 'إعدادات السوق', 'شروط البيع'],
  '/admin': ['home', 'overview', 'رئيسية', 'الرئيسية', 'نظرة عامة', 'stats', 'احصائيات', 'إحصائيات', 'kpi'],
  '/admin/products': ['catalog', 'كتالوج', 'سلعة', 'سلع', 'اصناف', 'أصناف', 'inventory', 'sku', 'باركود', 'barcode', 'price', 'سعر', 'اسعار', 'أسعار'],
  '/admin/stock-alerts': ['stock alerts', 'تنبيهات المخزون', 'out of stock', 'نفاد', 'نفد', 'مخزون منخفض', 'low stock', 'restock', 'اعادة تعبئة', 'الكمية', 'quantity'],
  '/admin/categories': ['category', 'قسم', 'اقسام', 'تصنيف', 'تصنيفات', 'department', 'tree', 'شجرة'],
  '/admin/brands': ['brand', 'ماركة', 'ماركات', 'علامة تجارية', 'manufacturer', 'شركة مصنعة'],
  '/admin/reviews': ['review', 'rating', 'تقييم', 'تقييمات', 'مراجعة', 'مراجعات', 'نجوم', 'stars', 'moderation', 'اعتماد'],
  '/admin/coupons': ['coupon', 'كوبون', 'كوبونات', 'خصم', 'discount code', 'كود خصم', 'promo code', 'قسيمة'],
  '/admin/cart-recovery': ['abandoned cart', 'cart recovery', 'سلة متروكة', 'سلال', 'استرجاع', 'تذكير', 'reminder', 'remarketing', 'win back'],
  '/admin/promotions': ['promotion', 'offer', 'sale', 'عرض', 'عروض', 'تخفيض', 'تخفيضات', 'حملة', 'deal', 'صفقة', 'bogo', 'bundle', 'باقة'],
  '/admin/banners': ['banner', 'بانر', 'بنر', 'حملة', 'حملات', 'campaign', 'slider', 'سلايدر', 'اعلان', 'إعلان'],
  '/admin/orders': ['order', 'طلب', 'طلبات', 'اوردر', 'أوردر', 'purchase', 'مشتريات', 'invoice', 'شحنة', 'shipment', 'checkout'],
  '/admin/invoices': ['invoice', 'فاتورة', 'فواتير', 'receipt', 'إيصال', 'ايصال', 'pdf', 'رقم فاتورة', 'invoice number', 'رقم عميل', 'customer number'],
  '/admin/live-deliveries': ['live deliveries', 'التوصيل المباشر', 'live', 'مباشر', 'تتبع', 'tracking', 'gps', 'map', 'خريطة', 'مندوب', 'driver', 'سائق', 'delivery'],
  '/admin/recurring-deliveries': ['recurring delivery', 'التوصيل الدوري', 'recurring', 'subscription', 'اشتراك', 'اشتراكات', 'دوري', 'متكرر', 'schedule', 'جدولة'],
  '/admin/order-chats': ['chat', 'message', 'محادثة', 'رسائل', 'رسالة', 'دردشة', 'support', 'دعم', 'inbox', 'وارد'],
  '/admin/returns': ['return', 'refund', 'مرتجع', 'مرتجعات', 'ارجاع', 'إرجاع', 'استرجاع', 'استرداد', 'rma'],
  '/admin/coverage-area': ['coverage area', 'منطقة التغطية', 'coverage', 'تغطية', 'مظلة', 'umbrella', 'general area', 'منطقة عامة', 'radius', 'نصف قطر', 'circle', 'دائرة', 'enforce coverage', 'تفعيل التغطية'],
  '/admin/delivery': ['delivery zones', 'مناطق التوصيل', 'delivery zone', 'منطقة', 'مناطق', 'توصيل', 'شحن', 'shipping', 'رسوم توصيل', 'delivery fee', 'نطاق'],
  '/admin/fulfillment-locations': ['fulfillment locations', 'مواقع الشحن', 'warehouse', 'مستودع', 'مخزن', 'فرع', 'فروع', 'branch', 'موقع شحن', 'pickup', 'استلام', 'location'],
  '/admin/users': ['users', 'المستخدمون', 'user', 'customer', 'مستخدم', 'مستخدمين', 'عميل', 'عملاء', 'account', 'حساب', 'حسابات', 'member'],
  '/admin/team': ['admin team', 'فريق الإدارة', 'team', 'staff', 'admin team', 'فريق', 'موظف', 'موظفين', 'صلاحيات', 'permission', 'role', 'دور', 'ادوار', 'أدوار', 'مسؤول'],
  '/admin/loyalty': ['loyalty points', 'نقاط الولاء', 'loyalty', 'points', 'نقاط', 'ولاء', 'مكافآت', 'rewards', 'cashback', 'كاش باك', 'استرداد نقدي', 'earn', 'redeem'],
  '/admin/wallet': ['wallets', 'المحافظ', 'wallet', 'محفظة', 'المحفظة', 'رصيد', 'balance', 'top-up', 'topup', 'شحن', 'instapay', 'إنستاباي', 'vodafone cash', 'فودافون كاش', 'store credit', 'refund', 'استرداد'],
  '/admin/homepage': ['homepage cms', 'homepage', 'home page', 'الصفحة الرئيسية', 'واجهة', 'cms', 'hero', 'سلايدر', 'sections', 'اقسام الرئيسية', 'layout', 'بناء'],
  '/admin/trending-searches': ['trending', 'الأكثر بحثا', 'رائج', 'شائع', 'popular search', 'اقتراحات بحث', 'suggestions', 'هجين', 'hybrid', 'auto-tune', 'ضبط تلقائي', 'الحد', 'blocklist', 'كلمات محجوبة'],
  '/admin/filter-settings': ['filter', 'فلتر', 'فلاتر', 'تصفية', 'facet', 'خصائص', 'attributes', 'sort', 'ترتيب'],
  '/admin/navigation': ['header & footer cms', 'header footer', 'navigation', 'menu', 'قائمة', 'تنقل', 'header', 'footer', 'رأس', 'تذييل', 'روابط', 'links', 'نافبار', 'navbar'],
  '/admin/content': ['content page', 'صفحة', 'صفحات', 'محتوى', 'about', 'من نحن', 'سياسة', 'policy', 'terms', 'شروط', 'faq', 'اسئلة'],
  '/admin/appearance': ['appearance', 'theme', 'مظهر', 'ثيم', 'الوان', 'ألوان', 'color', 'لون', 'logo', 'شعار', 'font', 'خط', 'design', 'تصميم', 'brand color'],
  '/admin/revenue': ['revenue', 'ايراد', 'إيراد', 'إيرادات', 'مبيعات', 'sales', 'دخل', 'income', 'turnover', 'money', 'فلوس'],
  '/admin/reports': ['report', 'تقرير', 'تقارير', 'analytics', 'تحليلات', 'export', 'تصدير', 'chart', 'رسم بياني', 'data'],
  '/admin/partner-revenue': ['partner revenue', 'توزيع إيرادات الشركاء', 'partner', 'شريك', 'شركاء', 'commission', 'عمولة', 'payout', 'تسوية', 'توزيع', 'revenue share', 'split', 'rule', 'قاعدة', 'قواعد', 'تخصيص إيراد', 'attribution', 'statement', 'كشف حساب', 'كشف الحساب', 'ledger', 'دفتر', 'bank batch', 'دفعة بنكية', 'simulate', 'محاكاة'],
  '/admin/search-analytics': ['search analytics', 'تحليلات البحث', 'كلمات البحث', 'search terms', 'zero results', 'بدون نتائج', 'query', 'استعلام'],
  '/admin/settings': ['settings', 'اعداد', 'إعداد', 'اعدادات', 'إعدادات', 'تهيئة', 'config', 'configuration', 'خيارات', 'options', 'preferences'],
  '/admin/payments': ['payment', 'دفع', 'مدفوعات', 'طريقة دفع', 'بطاقة', 'card', 'stripe', 'سترايب', 'paymob', 'باي موب', 'fawry', 'فوري', 'valu', 'فاليو', 'apple pay', 'cod', 'الدفع عند الاستلام', 'تحويل بنكي', 'bank transfer', 'محفظة', 'wallet', 'vodafone cash', 'فودافون كاش', 'instapay', 'انستا باي'],
  '/admin/notifications': ['notification templates', 'قوالب الإشعارات', 'notification', 'اشعار', 'إشعار', 'اشعارات', 'إشعارات', 'template', 'قالب', 'قوالب', 'sms', 'email', 'بريد', 'رسالة نصية', 'push', 'whatsapp', 'واتساب'],
  '/admin/audit-log': ['audit log', 'سجل التدقيق', 'audit', 'تدقيق', 'سجل', 'logs', 'history', 'تاريخ', 'activity', 'نشاط', 'من غيّر', 'who changed', 'تتبع التغييرات'],
};

/** Extra search words for screens reached from the Settings page. */
const SETTINGS_KEYWORDS = {
  '/admin/settings/identity': ['store name', 'اسم المتجر', 'شعار', 'logo', 'favicon', 'ايقونة', 'عملة', 'currency', 'egp', 'جنيه', 'ريال', 'دولار', 'tagline', 'وصف المتجر', 'هوية', 'branding', 'seo', 'meta', 'ميتا', 'وصف', 'description', 'keywords', 'كلمات مفتاحية', 'sitemap', 'خريطة الموقع', 'og', 'محركات البحث', 'جوجل', 'google'],
  '/admin/settings/contact': ['phone', 'هاتف', 'رقم', 'whatsapp', 'واتساب', 'email', 'بريد', 'ايميل', 'facebook', 'فيسبوك', 'instagram', 'انستجرام', 'tiktok', 'تيك توك', 'address', 'عنوان', 'app store', 'google play', 'تطبيق', 'social', 'سوشيال', 'دعم', 'support'],
  '/admin/settings/delivery': ['free delivery', 'توصيل مجاني', 'شحن مجاني', 'حد التوصيل المجاني', 'threshold', 'map pin', 'دبوس الخريطة', 'gps', 'lead time', 'مهلة', 'وقت التحضير', 'prep time', 'الحد الادنى للطلب', 'minimum order', 'رسوم'],
  '/admin/settings/experience': ['ai chat', 'المساعد الذكي', 'شات بوت', 'chatbot', 'low stock alert', 'تنبيه المخزون المنخفض', 'حد المخزون', 'review request', 'طلب التقييم', 'add to cart toast', 'اشعار السلة', 'sms review', 'email review'],
  '/admin/settings/invoice': ['invoice', 'فاتورة', 'pdf', 'رقم ضريبي', 'tax number', 'vat', 'ضريبة', 'الرقم الضريبي', 'footer note', 'ملاحظة الفاتورة', 'terms', 'شروط', 'سجل تجاري', 'commercial register'],
  '/admin/settings/admin': ['show revenue', 'اظهار الايرادات', 'اخفاء الايرادات', 'hide revenue', 'dashboard widgets', 'ودجت', 'عناصر اللوحة', 'permissions display', 'لوحة المسؤول'],
};

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
  const seen = new Set();

  for (const group of ADMIN_NAV_GROUPS) {
    for (const item of group.items) {
      const screens = item.tabs?.length ? item.tabs : [item];
      for (const screen of screens) {
        seen.add(screen.path);
        const isTab = Boolean(item.tabs?.length);
        entries.push({
          key: `nav:${screen.path}`,
          path: screen.path,
          Icon: item.Icon,
          titleAr: screen.labelAr,
          titleEn: screen.labelEn,
          // Tabs show which menu item they live under; single items show their group.
          groupAr: isTab ? item.labelAr : (group.labelAr || item.labelAr),
          groupEn: isTab ? item.labelEn : (group.labelEn || item.labelEn),
          permission: screen.permission ?? item.permission ?? null,
          requiresRevenue: screen.requiresRevenue ?? false,
          feature: screen.feature ?? group.feature,
          keywords: NAV_KEYWORDS[screen.path] ?? [],
        });
      }
    }
  }

  for (const group of SETTINGS_GROUPS) {
    for (const item of group.items) {
      if (seen.has(item.path)) continue;
      entries.push({
        key: `settings:${item.path}`,
        path: item.path,
        Icon: Settings,
        titleAr: item.labelAr,
        titleEn: item.labelEn,
        descAr: item.descAr,
        descEn: item.descEn,
        groupAr: `الإعدادات · ${group.labelAr}`,
        groupEn: `Settings · ${group.labelEn}`,
        permission: item.permission,
        isSetting: true,
        keywords: [...(SETTINGS_KEYWORDS[item.path] ?? []), ...(NAV_KEYWORDS[item.path] ?? [])],
      });
    }
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
