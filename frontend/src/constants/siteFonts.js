export const DEFAULT_SITE_FONT = 'cairo';

export const FONT_GROUPS = [
  { id: 'all', labelAr: 'الكل', labelEn: 'All' },
  { id: 'modern', labelAr: 'عصري', labelEn: 'Modern' },
  { id: 'rounded', labelAr: 'مستدير', labelEn: 'Rounded' },
  { id: 'classic', labelAr: 'كلاسيكي', labelEn: 'Classic' },
];

/** Arabic-friendly Google Fonts — drives --font-sans site-wide. */
export const SITE_FONTS = {
  cairo: {
    id: 'cairo',
    group: 'modern',
    family: 'Cairo',
    googleParam: 'Cairo:wght@400;500;600;700;800',
    labelAr: 'القاهرة',
    labelEn: 'Cairo',
    sampleAr: 'تسوق بذكاء — توصيل سريع',
    sampleEn: 'Smart shopping — fast delivery',
  },
  tajawal: {
    id: 'tajawal',
    group: 'modern',
    family: 'Tajawal',
    googleParam: 'Tajawal:wght@400;500;700;800',
    labelAr: 'تجوال',
    labelEn: 'Tajawal',
    sampleAr: 'منتجات طازجة كل يوم',
    sampleEn: 'Fresh products every day',
  },
  almarai: {
    id: 'almarai',
    group: 'modern',
    family: 'Almarai',
    googleParam: 'Almarai:wght@300;400;700;800',
    labelAr: 'المراعي',
    labelEn: 'Almarai',
    sampleAr: 'عروض حصرية على كل الأقسام',
    sampleEn: 'Exclusive deals on every aisle',
  },
  'noto-sans-arabic': {
    id: 'noto-sans-arabic',
    group: 'modern',
    family: 'Noto Sans Arabic',
    googleParam: 'Noto+Sans+Arabic:wght@400;500;600;700',
    labelAr: 'نوتو سانس',
    labelEn: 'Noto Sans Arabic',
    sampleAr: 'وضوح ممتاز للنصوص الطويلة',
    sampleEn: 'Excellent clarity for long text',
  },
  'ibm-plex-sans-arabic': {
    id: 'ibm-plex-sans-arabic',
    group: 'modern',
    family: 'IBM Plex Sans Arabic',
    googleParam: 'IBM+Plex+Sans+Arabic:wght@400;500;600;700',
    labelAr: 'آي بي إم بلكس',
    labelEn: 'IBM Plex Sans Arabic',
    sampleAr: 'مظهر احترافي للمتجر الإلكتروني',
    sampleEn: 'Professional look for your store',
  },
  'readex-pro': {
    id: 'readex-pro',
    group: 'modern',
    family: 'Readex Pro',
    googleParam: 'Readex+Pro:wght@400;500;600;700',
    labelAr: 'ريدكس برو',
    labelEn: 'Readex Pro',
    sampleAr: 'مناسب للعربية والإنجليزية',
    sampleEn: 'Great for Arabic and English',
  },
  changa: {
    id: 'changa',
    group: 'rounded',
    family: 'Changa',
    googleParam: 'Changa:wght@400;500;600;700;800',
    labelAr: 'شانجا',
    labelEn: 'Changa',
    sampleAr: 'خط عريض وودود للعناوين',
    sampleEn: 'Bold friendly headings',
  },
  'el-messiri': {
    id: 'el-messiri',
    group: 'rounded',
    family: 'El Messiri',
    googleParam: 'El+Messiri:wght@400;500;600;700',
    labelAr: 'المسيري',
    labelEn: 'El Messiri',
    sampleAr: 'أناقة بسيطة للواجهة',
    sampleEn: 'Simple elegance for the UI',
  },
  rubik: {
    id: 'rubik',
    group: 'rounded',
    family: 'Rubik',
    googleParam: 'Rubik:wght@400;500;600;700',
    labelAr: 'روبيك',
    labelEn: 'Rubik',
    sampleAr: 'مظهر عصري ومريح للقراءة',
    sampleEn: 'Modern and easy to read',
  },
  harmattan: {
    id: 'harmattan',
    group: 'modern',
    family: 'Harmattan',
    googleParam: 'Harmattan:wght@400;500;600;700',
    labelAr: 'هرماتان',
    labelEn: 'Harmattan',
    sampleAr: 'خط خفيف ومتوازن',
    sampleEn: 'Light balanced typeface',
  },
  'reem-kufi': {
    id: 'reem-kufi',
    group: 'rounded',
    family: 'Reem Kufi',
    googleParam: 'Reem+Kufi:wght@400;500;600;700',
    labelAr: 'ريم كوفي',
    labelEn: 'Reem Kufi',
    sampleAr: 'طابع كوفي معاصر',
    sampleEn: 'Contemporary Kufi style',
  },
  alexandria: {
    id: 'alexandria',
    group: 'modern',
    family: 'Alexandria',
    googleParam: 'Alexandria:wght@400;500;600;700',
    labelAr: 'الإسكندرية',
    labelEn: 'Alexandria',
    sampleAr: 'خط حديث للمتاجر الرقمية',
    sampleEn: 'Modern font for digital stores',
  },
  amiri: {
    id: 'amiri',
    group: 'classic',
    family: 'Amiri',
    googleParam: 'Amiri:wght@400;700',
    labelAr: 'أميري',
    labelEn: 'Amiri',
    sampleAr: 'لمسة كلاسيكية أنيقة',
    sampleEn: 'Elegant classic touch',
  },
  lateef: {
    id: 'lateef',
    group: 'classic',
    family: 'Lateef',
    googleParam: 'Lateef:wght@400;700',
    labelAr: 'لطيف',
    labelEn: 'Lateef',
    sampleAr: 'أسلوب تقليدي مميز',
    sampleEn: 'Distinct traditional style',
  },
  'markazi-text': {
    id: 'markazi-text',
    group: 'classic',
    family: 'Markazi Text',
    googleParam: 'Markazi+Text:wght@400;500;600;700',
    labelAr: 'مركزي',
    labelEn: 'Markazi Text',
    sampleAr: 'مناسب للعناوين والنصوص',
    sampleEn: 'Suited for headings and body',
  },
};

export const SITE_FONT_LIST = Object.values(SITE_FONTS);

export function resolveSiteFont(fontKey) {
  const key = String(fontKey || '').trim();
  return SITE_FONTS[key] ? key : DEFAULT_SITE_FONT;
}

export function getFont(fontKey) {
  const key = resolveSiteFont(fontKey);
  return SITE_FONTS[key] || SITE_FONTS[DEFAULT_SITE_FONT];
}

export function filterFonts({ query = '', group = 'all' } = {}) {
  const q = String(query || '').trim().toLowerCase();
  return SITE_FONT_LIST.filter((font) => {
    if (group !== 'all' && font.group !== group) return false;
    if (!q) return true;
    return (
      font.id.includes(q)
      || font.family.toLowerCase().includes(q)
      || font.labelAr.includes(q)
      || font.labelEn.toLowerCase().includes(q)
    );
  });
}
