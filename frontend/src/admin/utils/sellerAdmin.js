/**
 * Pure helpers for the admin Sellers page — portal links, the invite message staff paste into
 * WhatsApp, the approval checklist and the CSV export. No React, so node tests can cover them.
 */

/** Where sellers sign in. The seller portal is not language-prefixed. */
export function sellerLoginUrl(origin) {
  return `${String(origin || '').replace(/\/+$/, '')}/seller-center/login`;
}

/** Public "Sell with us" application page (a storefront page, so it is language-prefixed). */
export function sellerSignupUrl(origin, lang = 'ar') {
  return `${String(origin || '').replace(/\/+$/, '')}/${lang === 'en' ? 'en' : 'ar'}/sell-with-us`;
}

/** Ready-to-paste message for WhatsApp / SMS. Arabic first, English line after. */
export function sellerInviteMessage({ storeName = '', email = '', loginUrl, setupUrl = '' }) {
  const store = storeName ? ` (${storeName})` : '';
  const lines = [
    `مرحباً، تم إنشاء حسابك في مركز البائعين${store}.`,
    setupUrl ? `١) اختر كلمة المرور من هذا الرابط (صالح ٧٢ ساعة):\n${setupUrl}` : '',
    `${setupUrl ? '٢) ' : ''}ادخل إلى متجرك من هنا واحفظ الرابط:\n${loginUrl}`,
    email ? `البريد: ${email}` : '',
    '',
    `Your Seller Center account is ready${store}.`,
    setupUrl ? `Set your password: ${setupUrl}` : '',
    `Sign in: ${loginUrl}`,
  ];
  return lines.filter((line, i) => line !== '' || i === 4).join('\n');
}

const hasBank = (bank = {}) => Boolean(bank.accountNumber || bank.iban || bank.walletPhone);

/**
 * What still blocks a confident approval. Every item is advisory — staff can still approve —
 * but the panel shows what is missing so nobody approves a store blind.
 */
export function sellerChecklist(seller) {
  if (!seller) return [];
  const docs = seller.documents || [];
  const owner = (seller.team || []).find((u) => u.role === 'seller_owner');
  return [
    {
      key: 'contact',
      done: Boolean(seller.email && seller.phone && seller.contactName),
      ar: 'بيانات التواصل كاملة',
      en: 'Contact details complete',
    },
    {
      key: 'documents',
      done: docs.length > 0 && docs.every((d) => d.status === 'accepted' && docExpiryState(d) !== 'expired'),
      ar: docs.length ? 'كل المستندات مقبولة' : 'رفع المستندات (السجل التجاري، البطاقة الضريبية…)',
      en: docs.length ? 'All documents accepted' : 'Documents uploaded (register, tax card…)',
    },
    {
      key: 'bank',
      done: hasBank(seller.bank),
      ar: 'بيانات استلام الأموال',
      en: 'Payout details added',
    },
    {
      key: 'login',
      done: Boolean(owner?.lastLoginAt),
      ar: 'دخل البائع إلى مركز البائعين',
      en: 'Seller has signed in',
    },
  ];
}

/** Seller status → the transitions staff can make from it (mirrors the backend rules). */
export const SELLER_NEXT_ACTIONS = {
  applied: ['active', 'under_review', 'rejected', 'closed'],
  under_review: ['active', 'rejected', 'closed'],
  active: ['suspended', 'closed'],
  suspended: ['active', 'closed'],
  rejected: ['under_review', 'active', 'closed'],
  closed: ['active', 'under_review'],
};

/** A document's expiry: 'expired', 'soon' (within 30 days), 'ok', or null when it has no date. */
export function docExpiryState(doc, now = new Date()) {
  if (doc?.status === 'expired') return 'expired';
  if (!doc?.expiresAt) return null;
  const left = new Date(doc.expiresAt) - now;
  if (left <= 0) return 'expired';
  return left <= 30 * 86400000 ? 'soon' : 'ok';
}

/** Common reasons, so staff do not retype them — they can still edit the text. */
export const SELLER_REASON_PRESETS = {
  rejected: [
    { ar: 'المستندات غير واضحة أو ناقصة', en: 'Documents are unclear or missing' },
    { ar: 'بيانات النشاط التجاري غير مطابقة', en: 'Business details do not match' },
    { ar: 'الأقسام المطلوبة غير متاحة حالياً', en: 'We are not onboarding these categories right now' },
  ],
  closed: [
    { ar: 'طلب البائع إغلاق المتجر', en: 'The seller asked to close the store' },
    { ar: 'مخالفات متكررة لسياسة المتجر', en: 'Repeated policy breaches' },
    { ar: 'لا نشاط منذ فترة طويلة', en: 'No activity for a long time' },
  ],
  reopen: [
    { ar: 'طلب البائع إعادة فتح المتجر', en: 'The seller asked to reopen' },
  ],
  suspended: [
    { ar: 'تأخر متكرر في شحن الطلبات', en: 'Repeated late shipping' },
    { ar: 'نسبة إلغاء مرتفعة', en: 'High cancellation rate' },
    { ar: 'شكاوى متكررة من العملاء', en: 'Repeated customer complaints' },
    { ar: 'منتجات مخالفة لسياسة المتجر', en: 'Products break store policy' },
  ],
};

const csvCell = (value) => {
  const s = String(value ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const BOM = String.fromCharCode(0xfeff);

/** Sellers → CSV text (UTF-8 BOM so Excel shows Arabic correctly). */
export function sellersToCsv(sellers, { isAr = false } = {}) {
  const header = isAr
    ? ['اسم المتجر (عربي)', 'اسم المتجر (إنجليزي)', 'الحالة', 'المسؤول', 'البريد', 'الهاتف', 'المدينة', 'منتجات معروضة', 'للمراجعة', 'العمولة %', 'التقييم', 'تاريخ الطلب']
    : ['Store (Arabic)', 'Store (English)', 'Status', 'Contact', 'Email', 'Phone', 'City', 'Live products', 'To review', 'Commission %', 'Rating', 'Applied'];
  const rows = sellers.map((s) => [
    s.nameAr,
    s.nameEn,
    s.status,
    s.contactName,
    s.email,
    s.phone,
    s.address?.city,
    s.products?.live ?? 0,
    s.products?.pending ?? 0,
    s.commissionRate ?? '',
    s.ratingCount ? `${s.rating} (${s.ratingCount})` : '',
    s.createdAt ? String(s.createdAt).slice(0, 10) : '',
  ]);
  return `${BOM}${[header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n')}`;
}

// ── Seller logins (admin Logins tab) ──

const TEMP_LETTERS = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ';
const TEMP_DIGITS = '23456789';

/**
 * A temporary password staff can read over the phone: no look-alike characters (0/O, 1/l/I),
 * always letters + digits so it passes the seller password rule. `rand` is injectable for tests.
 */
export function generateTempPassword(rand = Math.random) {
  const pick = (set) => set[Math.floor(rand() * set.length) % set.length];
  const letters = Array.from({ length: 6 }, () => pick(TEMP_LETTERS)).join('');
  const digits = Array.from({ length: 4 }, () => pick(TEMP_DIGITS)).join('');
  return `${letters}${digits}`;
}

/** Same rule as the backend: 8+ characters with a letter and a digit. */
export const isStrongSellerPassword = (p) => String(p || '').length >= 8 && /[A-Za-z\u0600-\u06FF]/.test(p) && /\d/.test(p);

/** Status chips for one login, most important first. */
export function loginBadges(user = {}, now = new Date()) {
  const out = [];
  if (user.isActive === false) out.push('off');
  if (user.lockedUntil && new Date(user.lockedUntil) > now) out.push('locked');
  if (user.mustChangePassword) out.push('temp_password');
  if (!user.lastLoginAt) out.push('never');
  if (user.twoFactorEnabled) out.push('two_factor');
  return out;
}

export const LOGIN_BADGES = {
  off: { ar: 'موقوف', en: 'Turned off', tone: 'bg-red-50 text-red-700' },
  locked: { ar: 'مقفول مؤقتاً', en: 'Locked', tone: 'bg-red-50 text-red-700' },
  temp_password: { ar: 'كلمة مرور مؤقتة', en: 'Temporary password', tone: 'bg-amber-50 text-amber-800' },
  never: { ar: 'لم يدخل بعد', en: 'Never signed in', tone: 'bg-amber-50 text-amber-800' },
  two_factor: { ar: 'تحقق بخطوتين', en: '2-step on', tone: 'bg-emerald-50 text-emerald-700' },
};

/** "Chrome · Windows" from a user agent. */
export function deviceLabel(ua = '') {
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return os ? `${browser} · ${os}` : browser;
}

/** WhatsApp text for a temporary password — never emailed, staff share it themselves. */
export function tempPasswordMessage({ storeName = '', email = '', password, loginUrl }) {
  const store = storeName ? ` (${storeName})` : '';
  return [
    `كلمة مرور مؤقتة لحسابك في مركز البائعين${store}:`,
    password,
    `البريد: ${email}`,
    `ادخل من هنا: ${loginUrl}`,
    'سيُطلب منك اختيار كلمة مرور جديدة بعد الدخول.',
    '',
    `Temporary Seller Center password${store}: ${password}`,
    `Sign in: ${loginUrl} — you will choose a new password right after.`,
  ].join('\n');
}

// ── Sellers list filters & saved views ──

/** "More filters" choices → the API query parameter each one sets. */
export const SELLER_LIST_FLAGS = {
  unread: { param: ['unread', '1'], ar: 'ردود لم تُقرأ', en: 'Unread replies' },
  terms: { param: ['terms', 'pending'], ar: 'لم يوافق على الشروط الجديدة', en: 'New terms not accepted' },
  docs: { param: ['docs', 'expiring'], ar: 'مستندات منتهية أو قريبة الانتهاء', en: 'Documents expiring / expired' },
  balance: { param: ['balance', 'owed'], ar: 'له مستحقات الآن', en: 'Money owed now' },
};

/** List page params → API params (the `flag` filter becomes its own parameter). */
export function sellerListParams(params = {}) {
  const { flag, ...rest } = params;
  const f = SELLER_LIST_FLAGS[flag];
  return f ? { ...rest, [f.param[0]]: f.param[1] } : rest;
}

const VIEWS_KEY = 'admin.sellers.savedViews';

/** Saved filter combinations — a per-browser convenience, so storage failures are ignored. */
export function readSavedViews(storage = globalThis.localStorage) {
  try {
    const list = JSON.parse(storage?.getItem(VIEWS_KEY) || '[]');
    return Array.isArray(list) ? list.filter((v) => v && typeof v.name === 'string' && v.filters && typeof v.filters === 'object') : [];
  } catch {
    return [];
  }
}

export function writeSavedViews(views, storage = globalThis.localStorage) {
  try { storage?.setItem(VIEWS_KEY, JSON.stringify(views.slice(0, 12))); } catch { /* private mode */ }
}

/** Add or replace a view by name (case-insensitive); newest first. */
export function upsertSavedView(views, name, filters) {
  const clean = String(name || '').trim().slice(0, 40);
  if (!clean) return views;
  const kept = Object.fromEntries(Object.entries(filters || {}).filter(([, v]) => v !== '' && v != null));
  return [{ name: clean, filters: kept }, ...views.filter((v) => v.name.toLowerCase() !== clean.toLowerCase())];
}
