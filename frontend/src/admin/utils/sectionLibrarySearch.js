/** Section library search + per-page rules (pure — shared by the picker and its tests). */

/** Everyday words owners type, beyond the section's own name and sentence. */
export const SECTION_SEARCH_WORDS = {
  hero_slider: 'سلايدر بانر رئيسي صور كبيرة واجهة hero slider carousel banner',
  announcement_strip: 'شريط اعلان رسالة تنبيه توصيل مجاني bar notice announcement ticker',
  promo_grid: 'بانرات صور اعلانات حملات banners ads grid campaign',
  split_promo: 'بطاقات اعلان ملونة cards promo split',
  video_banner: 'فيديو يوتيوب video youtube mp4',
  daily_offers: 'عروض تخفيضات خصم عداد عرض سريع deals offers discount sale flash timer',
  countdown_banner: 'عداد تنازلي وقت ينتهي countdown timer ends',
  offers_banner: 'عروض خصومات صفحة العروض offers sale',
  product_grid: 'منتجات الاكثر مبيعا جديد مخفض اختيار يدوي products best sellers new grid row',
  tabbed_products: 'تبويبات منتجات tabs products',
  category_spotlight: 'قسم منتجات قسم واحد category department',
  categories_scroll: 'اقسام تصنيفات دوائر categories departments circles',
  browse_hub: 'تصفح كل المنتجات اقسام فرعية اختصارات browse shortcuts all products',
  brand_row: 'ماركات علامات تجارية شعارات brands logos',
  price_ranges: 'سعر اسعار رخيص اقل من price budget cheap',
  trending_searches: 'بحث كلمات شائعة ترند search trending popular',
  recently_viewed: 'شاهدت مؤخرا اخر مشاهدة recently viewed history',
  picked_for_you: 'مقترح لك مخصص توصيات recommended for you personal',
  buy_again: 'اطلب مرة اخرى اعادة شراء طلبات سابقة reorder buy again',
  trust_badges: 'ثقة ضمان امان مميزات trust badges guarantee',
  feature_cards: 'مميزات لماذا نحن features why us perks',
  stats_bar: 'ارقام احصائيات عملاء numbers stats counters',
  reviews_carousel: 'تقييمات اراء العملاء نجوم reviews ratings testimonials',
  store_branches: 'فروع خريطة عنوان مواعيد branches map hours address',
  free_delivery_banner: 'توصيل مجاني شحن free delivery shipping progress',
  delivery_area_bar: 'منطقة توصيل عنوان موقع area location address zone',
  cta_card: 'زر بطاقة دعوة رابط button card link cta',
  dual_cta: 'زرين زران button buttons cta',
  loyalty_promo: 'نقاط مكافات ولاء استرداد points loyalty rewards cashback',
  signup_promo: 'تسجيل حساب جديد عضوية signup register account',
  signup_block: 'نشرة بريد ايميل واتساب اشتراك newsletter email whatsapp subscribe',
  recurring_promo: 'توصيل دوري متكرر اسبوعي اشتراك recurring subscription weekly',
  app_download: 'تطبيق تحميل موبايل app download mobile android ios',
  favorites_promo: 'مفضلة قائمة الامنيات favorites wishlist',
  track_order_promo: 'تتبع الطلب شحنة track order',
  faq_teaser: 'اسئلة شائعة مساعدة faq help questions',
  rich_text_block: 'نص فقرة من نحن محتوى text paragraph about content',
  seo_text: 'سيو جوجل محركات البحث نص seo google',
  coupon_card: 'كوبون كود خصم برومو كود coupon code promo discount voucher',
  occasion_tiles: 'مناسبات رمضان عيد مدارس عزومة موسم occasion season ramadan eid school',
  delivery_slot_bar: 'موعد توصيل وقت ساعة اقرب delivery time slot eta next',
  share_earn_promo: 'شارك اربح دعوة اصدقاء احالة share earn referral invite friends affiliate',
  spacer: 'مسافة فراغ فاصل خط spacer gap divider space line',
};

/**
 * Sections that make sense once per page — the library warns before adding a
 * second one (it does not block: two slideshows can be on purpose).
 */
export const ONE_PER_PAGE = new Set([
  'hero_slider', 'free_delivery_banner', 'delivery_area_bar', 'seo_text', 'recently_viewed',
  'picked_for_you', 'buy_again', 'app_download', 'store_branches', 'delivery_slot_bar',
]);

/** Fold Arabic spelling variants and case so «أقسام», «اقسام» and «الأقسام» all match. */
export function normalizeSearchText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '') // harakat + tatweel
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripArticle(word) {
  return word.startsWith('ال') && word.length > 3 ? word.slice(2) : word;
}

/** True when every word of the query appears in the section's name, sentence, group or everyday words. */
export function sectionMatchesSearch(type, category, query) {
  const words = normalizeSearchText(query).split(' ').filter(Boolean).map(stripArticle);
  if (!words.length) return true;
  const hay = normalizeSearchText([
    type.value.replace(/_/g, ' '),
    type.labelAr, type.labelEn, type.descriptionAr, type.descriptionEn,
    category?.labelAr, category?.labelEn,
    SECTION_SEARCH_WORDS[type.value],
  ].join(' '));
  return words.every((w) => hay.includes(w));
}

/** How many sections of each type the page already has. */
export function countSectionsByType(sections = []) {
  const counts = {};
  for (const s of sections) {
    if (s?.type) counts[s.type] = (counts[s.type] || 0) + 1;
  }
  return counts;
}
