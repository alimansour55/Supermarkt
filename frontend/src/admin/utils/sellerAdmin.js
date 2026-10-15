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
      done: docs.length > 0 && docs.every((d) => d.status === 'accepted'),
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
  applied: ['active', 'under_review', 'rejected'],
  under_review: ['active', 'rejected'],
  active: ['suspended'],
  suspended: ['active'],
  rejected: ['under_review', 'active'],
};

/** Common reasons, so staff do not retype them — they can still edit the text. */
export const SELLER_REASON_PRESETS = {
  rejected: [
    { ar: 'المستندات غير واضحة أو ناقصة', en: 'Documents are unclear or missing' },
    { ar: 'بيانات النشاط التجاري غير مطابقة', en: 'Business details do not match' },
    { ar: 'الأقسام المطلوبة غير متاحة حالياً', en: 'We are not onboarding these categories right now' },
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
