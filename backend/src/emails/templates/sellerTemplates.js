import { renderEmailLayout } from '../layout.js';
import { renderButton, renderKeyValueTable, clientUrl, formatEmailDate, formatEmailPrice } from '../helpers.js';

/** Seller Center emails — Arabic first, with a short English line for bilingual teams. */

/** Everything interpolated below can come from users (names, user agents) — escape it. */
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const sellerPasswordResetTemplate = (user, token) => {
  const url = `${clientUrl()}/seller-center/reset-password/${token}`;
  return {
    subject: 'إعادة تعيين كلمة مرور مركز البائعين',
    html: renderEmailLayout({
      preheader: 'رابط إعادة تعيين كلمة المرور',
      title: 'إعادة تعيين كلمة المرور',
      heading: 'إعادة تعيين كلمة المرور',
      subtitle: 'مركز البائعين — Seller Center',
      bodyHtml: `
        <p style="margin: 0 0 16px;">مرحباً <strong>${esc(user.name)}</strong>،</p>
        <p style="margin: 0 0 16px;">تلقينا طلباً لإعادة تعيين كلمة مرور حسابك في مركز البائعين. الرابط صالح لمدة ساعة واحدة.</p>
        ${renderButton(url, 'تعيين كلمة مرور جديدة')}
        <p style="margin: 0; font-size: 13px; color: #94a3b8;">If you didn't ask for this, ignore this email — your password stays the same.</p>
      `,
      footerNote: 'لا تشارك هذا الرابط مع أي شخص.',
    }),
    text: `Reset your Seller Center password (valid 1 hour): ${url}`,
  };
};

export const sellerLoginCodeTemplate = (user, code) => ({
  subject: `رمز الدخول لمركز البائعين: ${code}`,
  html: renderEmailLayout({
    preheader: `رمز الدخول ${code}`,
    title: 'رمز الدخول',
    heading: 'رمز التحقق بخطوتين',
    subtitle: 'مركز البائعين — Seller Center',
    bodyHtml: `
      <p style="margin: 0 0 16px;">مرحباً <strong>${esc(user.name)}</strong>، استخدم هذا الرمز لإكمال تسجيل الدخول. صالح لمدة 10 دقائق.</p>
      <p style="margin: 24px 0; text-align: center; font-size: 34px; font-weight: 800; letter-spacing: 10px; font-family: monospace;">${code}</p>
      <p style="margin: 0; font-size: 13px; color: #94a3b8;">If this wasn't you, change your password now.</p>
    `,
    footerNote: 'لن نطلب منك هذا الرمز عبر الهاتف أبداً.',
  }),
  text: `Your Seller Center sign-in code: ${code} (valid 10 minutes)`,
});

export const sellerNewSignInTemplate = (user, { at, ip, userAgent }) => ({
  subject: 'تسجيل دخول جديد إلى مركز البائعين',
  html: renderEmailLayout({
    preheader: 'تم تسجيل الدخول إلى حسابك',
    title: 'تسجيل دخول جديد',
    heading: 'تسجيل دخول جديد',
    subtitle: 'مركز البائعين — Seller Center',
    bodyHtml: `
      <p style="margin: 0 0 16px;">مرحباً <strong>${esc(user.name)}</strong>، تم تسجيل الدخول إلى حسابك:</p>
      ${renderKeyValueTable([
        ['الوقت', formatEmailDate(at)],
        ['عنوان IP', esc(ip || '—')],
        ['الجهاز', esc((userAgent || '—').slice(0, 120))],
      ])}
      <p style="margin: 16px 0 0;">إذا لم تكن أنت، غيّر كلمة المرور فوراً واضغط «تسجيل الخروج من كل الأجهزة» في صفحة الأمان.</p>
      ${renderButton(`${clientUrl()}/seller-center/store/security`, 'صفحة الأمان')}
    `,
    footerNote: "If this wasn't you, change your password and sign out of all devices.",
  }),
  text: `New Seller Center sign-in at ${new Date(at).toISOString()} from ${ip || 'unknown IP'}.`,
});

export const sellerNewOrderTemplate = ({ seller, shipment, shipBy }) => ({
  subject: `طلب جديد ${shipment.shipmentNumber} — ${formatEmailPrice(shipment.subtotal)}`,
  html: renderEmailLayout({
    preheader: 'لديك طلب جديد بانتظار التأكيد',
    title: 'طلب جديد',
    heading: 'لديك طلب جديد 🎉',
    subtitle: esc(seller.nameAr || seller.nameEn),
    bodyHtml: `
      ${renderKeyValueTable([
        ['رقم الشحنة', esc(shipment.shipmentNumber)],
        ['القطع', String((shipment.items || []).reduce((n, i) => n + (i.quantity || 0), 0))],
        ['قيمة المنتجات', formatEmailPrice(shipment.subtotal)],
        ...(shipBy ? [['اشحن قبل', formatEmailDate(shipBy)]] : []),
      ])}
      <ul style="margin: 16px 0; padding-inline-start: 20px;">
        ${(shipment.items || []).map((i) => `<li>${i.quantity} × ${esc(i.nameAr || i.nameEn)}</li>`).join('')}
      </ul>
      ${renderButton(`${clientUrl()}/seller-center/orders/${shipment._id}`, 'تأكيد الطلب')}
    `,
    footerNote: 'أكّد الطلبات واشحنها في الموعد للحفاظ على صحة حسابك.',
  }),
  text: `New order ${shipment.shipmentNumber}. Confirm it in Seller Center.`,
});

export const sellerLowStockTemplate = ({ seller, product, available }) => ({
  subject: `مخزون منخفض: ${product.nameAr || product.nameEn} (${available})`,
  html: renderEmailLayout({
    preheader: 'منتج قارب على النفاد',
    title: 'مخزون منخفض',
    heading: 'منتج قارب على النفاد',
    subtitle: esc(seller.nameAr || seller.nameEn),
    bodyHtml: `
      <p style="margin: 0 0 16px;">المتبقي من <strong>${esc(product.nameAr || product.nameEn)}</strong>: <strong>${available}</strong> قطعة.</p>
      ${renderButton(`${clientUrl()}/seller-center/inventory?stock=low`, 'تحديث المخزون')}
    `,
    footerNote: 'المنتجات التي ينفد مخزونها تختفي من نتائج البحث.',
  }),
  text: `Low stock: ${product.nameEn || product.nameAr} has ${available} left.`,
});
