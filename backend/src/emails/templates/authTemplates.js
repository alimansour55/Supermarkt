import { renderEmailLayout } from '../layout.js';
import { renderButton, clientUrl } from '../helpers.js';

export const welcomeTemplate = (user) => {
  const url = clientUrl();
  const bodyHtml = `
    <p style="margin: 0 0 16px;">مرحباً <strong>${user.name}</strong> 👋</p>
    <p style="margin: 0 0 16px;">
      يسعدنا انضمامك إلى <strong>سوق+ MarketPlus</strong> — وجهتك الأولى للتسوق الإلكتروني في مصر.
      اكتشف آلاف المنتجات، عروض حصرية، وتوصيل سريع لباب بيتك.
    </p>
    <p style="margin: 0 0 8px;">مع سوق+ يمكنك:</p>
    <ul style="margin: 0 0 20px; padding-right: 20px; color: #475569;">
      <li style="margin-bottom: 8px;">تصفح فئات متنوعة — بقالة، إلكترونيات، مستلزمات أطفال والمزيد</li>
      <li style="margin-bottom: 8px;">الاستفادة من عروض وخصومات يومية</li>
      <li style="margin-bottom: 8px;">تتبع طلباتك بسهولة</li>
    </ul>
    ${renderButton(url, '🛒 ابدأ التسوق الآن')}
    <p style="margin: 24px 0 0; font-size: 13px; color: #94a3b8;">
      لا تنسَ تأكيد بريدك الإلكتروني لتفعيل حسابك بالكامل.
    </p>
  `;

  return {
    subject: 'مرحباً بك في سوق+ MarketPlus 🎉',
    html: renderEmailLayout({
      preheader: `مرحباً ${user.name}! ابدأ التسوق على سوق+ MarketPlus`,
      title: 'مرحباً بك',
      heading: 'أهلاً بك في عائلة سوق+!',
      subtitle: 'تسوق ذكي · توصيل سريع · أسعار منافسة',
      bodyHtml,
    }),
    text: `مرحباً ${user.name}! Welcome to MarketPlus. Start shopping: ${url}`,
  };
};

export const verificationTemplate = (user, token) => {
  const verifyUrl = `${clientUrl()}/verify-email/${token}`;
  const bodyHtml = `
    <p style="margin: 0 0 16px;">مرحباً <strong>${user.name}</strong>،</p>
    <p style="margin: 0 0 16px;">
      شكراً لتسجيلك في سوق+. لتفعيل حسابك والاستمتاع بجميع المميزات، يرجى تأكيد بريدك الإلكتروني.
    </p>
    ${renderButton(verifyUrl, '✅ تأكيد البريد الإلكتروني')}
    <p style="margin: 24px 0 0; font-size: 13px; color: #94a3b8;">
      الرابط صالح لمدة <strong>24 ساعة</strong>. إذا لم تقم بإنشاء هذا الحساب، تجاهل هذه الرسالة.
    </p>
    <p style="margin: 12px 0 0; font-size: 12px; color: #cbd5e1; word-break: break-all;">
      أو انسخ الرابط: ${verifyUrl}
    </p>
  `;

  return {
    subject: 'تأكيد البريد الإلكتروني — سوق+ MarketPlus',
    html: renderEmailLayout({
      preheader: 'اضغط لتأكيد بريدك الإلكتروني على سوق+',
      title: 'تأكيد البريد',
      heading: 'تأكيد بريدك الإلكتروني',
      subtitle: 'خطوة واحدة لتفعيل حسابك',
      bodyHtml,
    }),
    text: `Confirm your email: ${verifyUrl}`,
  };
};

export const passwordResetTemplate = (user, token) => {
  const resetUrl = `${clientUrl()}/reset-password/${token}`;
  const bodyHtml = `
    <p style="margin: 0 0 16px;">مرحباً <strong>${user.name}</strong>،</p>
    <p style="margin: 0 0 16px;">
      تلقينا طلباً لإعادة تعيين كلمة المرور لحسابك على سوق+. إذا كنت أنت من طلب ذلك، اضغط الزر أدناه.
    </p>
    ${renderButton(resetUrl, '🔐 إعادة تعيين كلمة المرور')}
    <p style="margin: 24px 0 0; font-size: 13px; color: #94a3b8;">
      الرابط صالح لمدة <strong>ساعة واحدة</strong> فقط. إذا لم تطلب إعادة التعيين، تجاهل هذه الرسالة — حسابك آمن.
    </p>
  `;

  return {
    subject: 'إعادة تعيين كلمة المرور — سوق+ MarketPlus',
    html: renderEmailLayout({
      preheader: 'طلب إعادة تعيين كلمة المرور',
      title: 'إعادة تعيين كلمة المرور',
      heading: 'إعادة تعيين كلمة المرور',
      subtitle: 'طلب آمن لاستعادة الوصول لحسابك',
      bodyHtml,
      footerNote: '⚠️ لا تشارك هذا الرابط مع أي شخص.',
    }),
    text: `Reset password: ${resetUrl}`,
  };
};
