/** CMS-style content for footer / info pages (bilingual). */
export const STATIC_PAGES = {
  contact: {
    titleAr: 'اتصل بنا',
    titleEn: 'Contact Us',
    sections: [
      {
        bodyAr: 'نحن هنا لمساعدتك. تواصل معنا عبر الهاتف أو البريد الإلكتروني وسنرد في أقرب وقت.',
        bodyEn: 'We are here to help. Reach us by phone or email and we will respond as soon as possible.',
      },
      {
        headingAr: 'خدمة العملاء',
        headingEn: 'Customer Service',
        bodyAr: 'الهاتف: 16XXX (مجاني)\nالبريد: support@marketplus.com\nساعات العمل: على مدار الساعة',
        bodyEn: 'Phone: 16XXX (toll-free)\nEmail: support@marketplus.com\nHours: 24/7',
      },
    ],
  },
  faq: {
    titleAr: 'الأسئلة الشائعة',
    titleEn: 'FAQ',
    sections: [
      {
        headingAr: 'كيف أتتبع طلبي؟',
        headingEn: 'How do I track my order?',
        bodyAr: 'سجّل الدخول وانتقل إلى «طلباتي» أو استخدم صفحة تتبع الطلب برقم الطلب.',
        bodyEn: 'Sign in and go to My Orders, or use Track Order with your order number.',
      },
      {
        headingAr: 'ما طرق الدفع المتاحة؟',
        headingEn: 'What payment methods are available?',
        bodyAr: 'نقبل الدفع عند الاستلام (COD) والدفع الإلكتروني عبر Stripe.',
        bodyEn: 'We accept cash on delivery (COD) and card payments via Stripe.',
      },
      {
        headingAr: 'كم يستغرق التوصيل؟',
        headingEn: 'How long does delivery take?',
        bodyAr: 'التوصيل السريع خلال ساعتين في المناطق المدعومة، أو حسب الموعد المحدد عند الطلب.',
        bodyEn: 'Express delivery within 2 hours in supported areas, or your scheduled slot.',
      },
    ],
  },
  about: {
    titleAr: 'من نحن',
    titleEn: 'About Us',
    sections: [
      {
        bodyAr: 'سوق+ (MarketPlus) متجر إلكتروني مصري يوصل البقالة والمنتجات اليومية إلى باب منزلك بسرعة وموثوقية.',
        bodyEn: 'MarketPlus is an Egyptian online supermarket delivering groceries and everyday essentials quickly and reliably.',
      },
      {
        headingAr: 'مهمتنا',
        headingEn: 'Our mission',
        bodyAr: 'توفير تجربة تسوق سهلة، أسعار تنافسية، وتوصيل في الوقت الذي يناسبك.',
        bodyEn: 'To offer easy shopping, competitive prices, and delivery when it suits you.',
      },
    ],
  },
  privacy: {
    titleAr: 'سياسة الخصوصية',
    titleEn: 'Privacy Policy',
    sections: [
      {
        bodyAr: 'نحترم خصوصيتك. نجمع بيانات الحساب (الاسم، رقم الهاتف) وعنوان التوصيل لتنفيذ الطلبات فقط.',
        bodyEn: 'We respect your privacy. We collect account data (name, phone) and delivery addresses solely to fulfill orders.',
      },
      {
        headingAr: 'البيانات والأمان',
        headingEn: 'Data & security',
        bodyAr: 'لا نبيع بياناتك لأطراف ثالثة. تسجيل الدخول محمي برمز SMS (MFA).',
        bodyEn: 'We do not sell your data to third parties. Sign-in is protected with SMS verification (MFA).',
      },
    ],
  },
  terms: {
    titleAr: 'الشروط والأحكام',
    titleEn: 'Terms & Conditions',
    sections: [
      {
        bodyAr: 'باستخدامك لموقع سوق+ فإنك توافق على هذه الشروط. الأسعار والعروض قابلة للتغيير دون إشعار مسبق.',
        bodyEn: 'By using MarketPlus you agree to these terms. Prices and offers may change without prior notice.',
      },
      {
        headingAr: 'الطلبات والدفع',
        headingEn: 'Orders & payment',
        bodyAr: 'الطلب ملزم بعد التأكيد. في حالة الدفع الإلكتروني يتم خصم المبلغ عند إتمام الدفع بنجاح.',
        bodyEn: 'Orders are binding once confirmed. Card payments are charged when checkout completes successfully.',
      },
    ],
  },
  returns: {
    titleAr: 'الاسترجاع والاستبدال',
    titleEn: 'Returns & Exchange',
    sections: [
      {
        bodyAr: 'إذا وصل منتج تالف أو غير مطابق للطلب، تواصل معنا خلال 24 ساعة من الاستلام.',
        bodyEn: 'If an item arrives damaged or incorrect, contact us within 24 hours of delivery.',
      },
      {
        headingAr: 'الاستثناءات',
        headingEn: 'Exceptions',
        bodyAr: 'المنتجات الطازجة والمفتوحة قد لا تكون قابلة للاسترجاع لأسباب صحية.',
        bodyEn: 'Fresh and opened goods may not be eligible for return for health reasons.',
      },
    ],
  },
  careers: {
    titleAr: 'الوظائف',
    titleEn: 'Careers',
    sections: [
      {
        bodyAr: 'نبحث عن مواهب في التوصيل، خدمة العملاء، والتقنية. أرسل سيرتك إلى careers@marketplus.com',
        bodyEn: 'We hire for delivery, customer service, and tech roles. Send your CV to careers@marketplus.com',
      },
    ],
  },
};

export function getStaticPage(slug) {
  return STATIC_PAGES[slug] || null;
}
