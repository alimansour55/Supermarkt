/** Built-in content page slugs (footer / info pages). */
export const CONTENT_PAGE_SLUGS = [
  'contact',
  'faq',
  'about',
  'terms',
  'returns',
  'privacy',
  'careers',
];

export const DEFAULT_CONTENT_PAGES = {
  contact: {
    slug: 'contact',
    titleAr: 'اتصل بنا',
    titleEn: 'Contact Us',
    seoTitleAr: '',
    seoTitleEn: '',
    seoDescriptionAr: 'تواصل مع فريق الدعم والاستفسارات.',
    seoDescriptionEn: 'Contact our customer support.',
    sections: [
      {
        bodyAr: 'نحن هنا لمساعدتك في أي استفسار عن الطلبات، التوصيل، أو المنتجات. استخدم بيانات التواصل أدناه للوصول إلى فريق الدعم.',
        bodyEn: 'We are here to help with orders, delivery, or product questions. Use the contact details below to reach our support team.',
      },
    ],
  },
  faq: {
    slug: 'faq',
    titleAr: 'الأسئلة الشائعة',
    titleEn: 'FAQ',
    seoTitleAr: '',
    seoTitleEn: '',
    seoDescriptionAr: 'إجابات على الأسئلة الشائعة حول الطلبات والتوصيل والدفع.',
    seoDescriptionEn: 'Answers to common questions about orders, delivery, and payment.',
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
    slug: 'about',
    titleAr: 'من نحن',
    titleEn: 'About Us',
    seoTitleAr: '',
    seoTitleEn: '',
    seoDescriptionAr: 'تعرف على رسالتنا في توصيل البقالة بسرعة وموثوقية.',
    seoDescriptionEn: 'Learn about our grocery delivery mission.',
    sections: [
      {
        bodyAr: 'متجر إلكتروني مصري يوصل البقالة والمنتجات اليومية إلى باب منزلك بسرعة وموثوقية.',
        bodyEn: 'An Egyptian online supermarket delivering groceries and everyday essentials quickly and reliably.',
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
    slug: 'privacy',
    titleAr: 'سياسة الخصوصية',
    titleEn: 'Privacy Policy',
    seoTitleAr: '',
    seoTitleEn: '',
    seoDescriptionAr: 'كيف نحمي بياناتك الشخصية.',
    seoDescriptionEn: 'How we protect your personal data.',
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
    slug: 'terms',
    titleAr: 'الشروط والأحكام',
    titleEn: 'Terms & Conditions',
    seoTitleAr: '',
    seoTitleEn: '',
    seoDescriptionAr: 'شروط استخدام الموقع والتطبيق.',
    seoDescriptionEn: 'Terms of use for the website and app.',
    sections: [
      {
        bodyAr: 'باستخدامك لهذا الموقع فإنك توافق على هذه الشروط. الأسعار والعروض قابلة للتغيير دون إشعار مسبق.',
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
    slug: 'returns',
    titleAr: 'الاسترجاع والاستبدال',
    titleEn: 'Returns & Exchange',
    seoTitleAr: '',
    seoTitleEn: '',
    seoDescriptionAr: 'سياسة الاسترجاع والاستبدال.',
    seoDescriptionEn: 'Our returns and exchange policy.',
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
    slug: 'careers',
    titleAr: 'الوظائف',
    titleEn: 'Careers',
    seoTitleAr: '',
    seoTitleEn: '',
    seoDescriptionAr: 'انضم إلى فريقنا.',
    seoDescriptionEn: 'Join our team.',
    sections: [
      {
        bodyAr: 'نبحث عن مواهب في التوصيل، خدمة العملاء، والتقنية. أرسل سيرتك إلى careers@marketplus.com',
        bodyEn: 'We hire for delivery, customer service, and tech roles. Send your CV to careers@marketplus.com',
      },
    ],
  },
};
