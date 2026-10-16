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

/**
 * Staff-sent access email: a "set your password" link (invite or reset by staff) plus the
 * Seller Center sign-in address so the seller can bookmark it. Without a token it is a plain
 * welcome pointing at the sign-in page (staff already gave them a password).
 */
export const sellerAccessTemplate = (user, { seller, token, expiresHours } = {}) => {
  const loginUrl = `${clientUrl()}/seller-center/login`;
  const setupUrl = token ? `${clientUrl()}/seller-center/reset-password/${token}` : '';
  const store = esc(seller?.nameAr || seller?.nameEn || '');
  return {
    subject: token ? 'فعّل حسابك في مركز البائعين' : 'حسابك في مركز البائعين جاهز',
    html: renderEmailLayout({
      preheader: token ? 'اختر كلمة مرور للدخول إلى مركز البائعين' : 'ادخل إلى مركز البائعين',
      title: 'مركز البائعين',
      heading: token ? 'مرحباً بك في مركز البائعين' : 'حسابك جاهز',
      subtitle: store || 'مركز البائعين — Seller Center',
      bodyHtml: `
        <p style="margin: 0 0 16px;">مرحباً <strong>${esc(user.name)}</strong>،</p>
        ${token
          ? `<p style="margin: 0 0 16px;">أنشأنا لك حساباً لإدارة متجرك${store ? ` <strong>${store}</strong>` : ''}. اضغط الزر لاختيار كلمة المرور — الرابط صالح لمدة ${Number(expiresHours) || 72} ساعة.</p>
             ${renderButton(setupUrl, 'اختيار كلمة المرور')}`
          : `<p style="margin: 0 0 16px;">حسابك لإدارة متجرك${store ? ` <strong>${store}</strong>` : ''} جاهز. استخدم كلمة المرور التي أرسلها لك فريقنا.</p>
             ${renderButton(loginUrl, 'الدخول إلى مركز البائعين')}`}
        ${renderKeyValueTable([
          ['رابط الدخول', `<a href="${loginUrl}" dir="ltr">${loginUrl}</a>`],
          ['البريد', `<span dir="ltr">${esc(user.email)}</span>`],
        ])}
        <p style="margin: 16px 0 0; font-size: 13px; color: #94a3b8;">Seller Center sign-in: ${loginUrl}${token ? ` — set your password: ${setupUrl}` : ''}</p>
      `,
      footerNote: 'احفظ رابط الدخول في المفضلة. لا تشارك رابط كلمة المرور مع أحد.',
    }),
    text: token
      ? `Set your Seller Center password (valid ${Number(expiresHours) || 72} hours): ${setupUrl}\nSign in later at: ${loginUrl}`
      : `Your Seller Center account is ready. Sign in at: ${loginUrl}`,
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

/** Store staff changed something on a seller login — the seller always hears about it. */
const STAFF_CHANGE_TEXT = {
  password: ['وضع فريق المتجر كلمة مرور مؤقتة لحسابك. ستُطلب منك كلمة مرور جديدة عند الدخول.', 'Store staff set a temporary password on your login.'],
  email: ['غيّر فريق المتجر البريد الذي تدخل به إلى مركز البائعين.', 'Store staff changed the email you sign in with.'],
  two_factor_off: ['أوقف فريق المتجر التحقق بخطوتين لحسابك. يمكنك تفعيله مجدداً من صفحة الأمان.', 'Store staff turned off 2-step verification on your login.'],
  signed_out: ['سجّل فريق المتجر خروج حسابك من كل الأجهزة.', 'Store staff signed your login out of every device.'],
  owner: ['أصبحت المالك لهذا المتجر في مركز البائعين.', 'You are now the owner of this store in Seller Center.'],
};

export const sellerStaffChangeTemplate = (user, { change, seller } = {}) => {
  const [ar, en] = STAFF_CHANGE_TEXT[change] || STAFF_CHANGE_TEXT.password;
  return {
    subject: 'تغيير على حسابك في مركز البائعين',
    html: renderEmailLayout({
      preheader: ar,
      title: 'تغيير على حسابك',
      heading: 'تغيير على حسابك',
      subtitle: esc(seller?.nameAr || seller?.nameEn || 'مركز البائعين — Seller Center'),
      bodyHtml: `
        <p style="margin: 0 0 16px;">مرحباً <strong>${esc(user.name)}</strong>،</p>
        <p style="margin: 0 0 16px;">${ar}</p>
        <p style="margin: 0 0 16px;">إذا لم تطلب هذا، تواصل مع فريق المتجر فوراً.</p>
        ${renderButton(`${clientUrl()}/seller-center/store/security`, 'صفحة الأمان')}
      `,
      footerNote: en,
    }),
    text: `${en} If you did not ask for this, contact the store team.`,
  };
};

/** A message or formal warning from store staff (the full text is also in Seller Center). */
export const sellerStoreMessageTemplate = (user, { seller, body, kind = 'message', strike = false } = {}) => {
  const warning = kind === 'warning';
  const title = warning ? (strike ? 'إنذار رسمي على متجرك' : 'تنبيه بخصوص متجرك') : 'رسالة من فريق المتجر';
  return {
    subject: `${title}${seller?.nameAr ? ` — ${seller.nameAr}` : ''}`,
    html: renderEmailLayout({
      preheader: String(body || '').slice(0, 90),
      title,
      heading: title,
      subtitle: esc(seller?.nameAr || seller?.nameEn || 'مركز البائعين — Seller Center'),
      bodyHtml: `
        <p style="margin: 0 0 16px;">مرحباً <strong>${esc(user.name)}</strong>،</p>
        <div style="margin: 0 0 16px; padding: 12px 16px; border-radius: 12px; background: ${warning ? '#fef3c7' : '#f1f5f9'}; white-space: pre-wrap;">${esc(body)}</div>
        ${strike ? '<p style="margin: 0 0 16px;">يُحتسب هذا الإنذار ضمن نقاط صحة حسابك. تكرار الإنذارات قد يؤدي إلى إيقاف المتجر.</p>' : ''}
        ${renderButton(`${clientUrl()}/seller-center/messages`, 'عرض والرد')}
      `,
      footerNote: warning ? 'A formal notice from the store team — see Seller Center → Messages.' : 'A message from the store team — reply in Seller Center → Messages.',
    }),
    text: `${warning ? 'Notice' : 'Message'} from the store team:\n\n${body}\n\nReply in Seller Center: ${clientUrl()}/seller-center/messages`,
  };
};
