/**
 * Admin helpers for the homepage block types that keep their options in
 * `blockConfig` (backend/src/utils/homepageBlocks.js is the source of truth).
 * Pure — no React, explicit .js imports — so node tests can load it.
 */
import { toStoreInput } from './bannerAdmin.js';

export const BLOCK_SECTION_TYPES = [
  'countdown_banner',
  'recently_viewed',
  'picked_for_you',
  'buy_again',
  'video_banner',
  'reviews_carousel',
  'signup_block',
  'price_ranges',
  'tabbed_products',
  'store_branches',
  'coupon_card',
  'occasion_tiles',
  'delivery_slot_bar',
  'spacer',
];

/** Rows that are different for every shopper — filled in the browser, not the cached page. */
export const PERSONAL_SECTION_TYPES = ['recently_viewed', 'picked_for_you', 'buy_again'];

export const isBlockSectionType = (type) => BLOCK_SECTION_TYPES.includes(type);
export const isPersonalSectionType = (type) => PERSONAL_SECTION_TYPES.includes(type);

export const DEFAULT_BLOCK_CONFIG = {
  limit: 12,
  layout: 'scroll',
  columns: 4,
  endsAt: '',
  countdownStyle: 'brand',
  image: '',
  hideWhenEnded: true,
  endedTextAr: '',
  endedTextEn: '',
  videoUrl: '',
  youtubeId: '',
  posterImage: '',
  autoplayDesktop: true,
  aspect: '16:9',
  minRating: 4,
  verifiedOnly: false,
  signupMode: 'newsletter',
  whatsappNumber: '',
  whatsappMessageAr: '',
  whatsappMessageEn: '',
  privacyNoteAr: '',
  privacyNoteEn: '',
  priceRanges: [],
  tabs: [],
  branches: [],
  pickedFallback: 'best_sellers',
  couponCode: '',
  couponStyle: 'ticket',
  tiles: [],
  spacerSize: 'md',
  showLine: false,
};

export const COUPON_STYLE_OPTIONS = [
  { value: 'ticket', labelAr: 'تذكرة بإطار منقّط', labelEn: 'Dashed ticket' },
  { value: 'bold', labelAr: 'شريط ملوّن بارز', labelEn: 'Bold colour band' },
];

export const SPACER_SIZE_OPTIONS = [
  { value: 'sm', labelAr: 'صغيرة', labelEn: 'Small' },
  { value: 'md', labelAr: 'متوسطة', labelEn: 'Medium' },
  { value: 'lg', labelAr: 'كبيرة', labelEn: 'Large' },
  { value: 'xl', labelAr: 'كبيرة جداً', labelEn: 'Extra large' },
];

export const TILE_ACCENT_OPTIONS = [
  { value: 'primary', labelAr: 'لون المتجر', labelEn: 'Store colour', swatch: 'bg-primary-200' },
  { value: 'emerald', labelAr: 'أخضر', labelEn: 'Green', swatch: 'bg-emerald-200' },
  { value: 'sky', labelAr: 'أزرق', labelEn: 'Blue', swatch: 'bg-sky-200' },
  { value: 'amber', labelAr: 'ذهبي', labelEn: 'Gold', swatch: 'bg-amber-200' },
  { value: 'rose', labelAr: 'وردي', labelEn: 'Pink', swatch: 'bg-rose-200' },
  { value: 'violet', labelAr: 'بنفسجي', labelEn: 'Purple', swatch: 'bg-violet-200' },
  { value: 'slate', labelAr: 'رمادي', labelEn: 'Grey', swatch: 'bg-slate-300' },
];

export const EMPTY_OCCASION_TILE = {
  titleAr: '', titleEn: '', subtitleAr: '', subtitleEn: '', icon: 'gift', image: '', link: '/products', accent: 'primary',
};

/** Starting tiles for "Shop by occasion" — the owner edits names and links. */
export const DEFAULT_OCCASION_TILES = [
  { ...EMPTY_OCCASION_TILE, titleAr: 'رمضان كريم', titleEn: 'Ramadan', icon: 'moon', accent: 'amber', link: '/offers' },
  { ...EMPTY_OCCASION_TILE, titleAr: 'العودة للمدارس', titleEn: 'Back to school', icon: 'school', accent: 'sky', link: '/products' },
  { ...EMPTY_OCCASION_TILE, titleAr: 'عزومة الويك إند', titleEn: 'Weekend gathering', icon: 'party', accent: 'rose', link: '/products' },
  { ...EMPTY_OCCASION_TILE, titleAr: 'فطار صحي', titleEn: 'Healthy breakfast', icon: 'salad', accent: 'emerald', link: '/products' },
];

export const COUNTDOWN_STYLE_OPTIONS = [
  { value: 'brand', labelAr: 'لون المتجر', labelEn: 'Store colour' },
  { value: 'sale', labelAr: 'أحمر للعروض', labelEn: 'Sale red' },
  { value: 'dark', labelAr: 'داكن', labelEn: 'Dark' },
  { value: 'light', labelAr: 'فاتح', labelEn: 'Light' },
];

export const VIDEO_ASPECT_OPTIONS = [
  { value: '16:9', labelAr: 'عريض (16:9)', labelEn: 'Wide (16:9)' },
  { value: '21:9', labelAr: 'سينمائي (21:9)', labelEn: 'Cinema (21:9)' },
  { value: '4:3', labelAr: 'شبه مربع (4:3)', labelEn: 'Classic (4:3)' },
];

export const SIGNUP_MODE_OPTIONS = [
  { value: 'newsletter', labelAr: 'بريد إلكتروني فقط', labelEn: 'Email only' },
  { value: 'whatsapp', labelAr: 'واتساب فقط', labelEn: 'WhatsApp only' },
  { value: 'both', labelAr: 'البريد وواتساب', labelEn: 'Email and WhatsApp' },
];

export const TAB_SORT_OPTIONS = [
  { value: 'best-selling', labelAr: 'الأكثر مبيعاً', labelEn: 'Best selling' },
  { value: 'newest', labelAr: 'الأحدث', labelEn: 'Newest' },
  { value: 'discount', labelAr: 'أكبر خصم', labelEn: 'Biggest discount' },
  { value: 'top', labelAr: 'الأعلى تقييماً', labelEn: 'Top rated' },
  { value: 'price-asc', labelAr: 'الأرخص أولاً', labelEn: 'Cheapest first' },
  { value: 'price-desc', labelAr: 'الأغلى أولاً', labelEn: 'Most expensive first' },
];

export const PICKED_FALLBACK_OPTIONS = [
  { value: 'best_sellers', labelAr: 'اعرض الأكثر مبيعاً', labelEn: 'Show best sellers' },
  { value: 'hide', labelAr: 'أخفِ القسم', labelEn: 'Hide the section' },
];

/** Starting tiles for "Shop by price" — empty labels read "Under 50 EGP" etc. on the store. */
export const DEFAULT_PRICE_RANGES = [
  { min: null, max: 50, labelAr: '', labelEn: '', emoji: 'coins' },
  { min: 50, max: 100, labelAr: '', labelEn: '', emoji: 'cash' },
  { min: 100, max: 250, labelAr: '', labelEn: '', emoji: 'wallet' },
  { min: 250, max: null, labelAr: '', labelEn: '', emoji: 'gem' },
];

export const DEFAULT_TABS = [
  { labelAr: 'الأكثر مبيعاً', labelEn: 'Best sellers', sort: 'best-selling', offers: false, section: '', category: null, link: '' },
  { labelAr: 'وصل حديثاً', labelEn: 'New in', sort: 'newest', offers: false, section: '', category: null, link: '' },
  { labelAr: 'العروض', labelEn: 'Offers', sort: 'discount', offers: true, section: '', category: null, link: '' },
];

export const EMPTY_BRANCH = {
  nameAr: '',
  nameEn: '',
  addressAr: '',
  addressEn: '',
  phone: '',
  mapUrl: '',
  image: '',
  hoursAr: '',
  hoursEn: '',
  opensAt: '',
  closesAt: '',
  days: [],
};

const copyRows = (rows) => (Array.isArray(rows) ? rows.map((row) => ({ ...row })) : []);

/** Stored blockConfig → form fields (the countdown end as a Cairo wall-clock input). */
export function blockConfigToForm(config = {}) {
  const raw = config && typeof config === 'object' ? config : {};
  return {
    ...DEFAULT_BLOCK_CONFIG,
    ...raw,
    endsAt: toStoreInput(raw.endsAt) || '',
    priceRanges: copyRows(raw.priceRanges),
    tabs: copyRows(raw.tabs).map((tab) => ({ ...tab, category: tab.category?._id || tab.category || null })),
    branches: copyRows(raw.branches).map((row) => ({ ...EMPTY_BRANCH, ...row, days: [...(row.days || [])] })),
    tiles: copyRows(raw.tiles).map((row) => ({ ...EMPTY_OCCASION_TILE, ...row })),
  };
}

const numberOrNull = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

/** Form → API. The server cleans and validates everything again. */
export function blockConfigFromForm(form = DEFAULT_BLOCK_CONFIG) {
  const raw = { ...DEFAULT_BLOCK_CONFIG, ...(form || {}) };
  return {
    ...raw,
    limit: Number(raw.limit) || 12,
    columns: Number(raw.columns) || 4,
    minRating: Number(raw.minRating) || 4,
    endsAt: raw.endsAt || '',
    priceRanges: (raw.priceRanges || []).map((row) => ({ ...row, min: numberOrNull(row.min), max: numberOrNull(row.max) })),
    tabs: copyRows(raw.tabs),
    branches: copyRows(raw.branches),
    tiles: copyRows(raw.tiles),
  };
}

/** What a new section of `type` starts with. */
export function blockDefaultsFor(type) {
  const base = { ...DEFAULT_BLOCK_CONFIG, priceRanges: [], tabs: [], branches: [], tiles: [] };
  if (type === 'occasion_tiles') {
    base.tiles = copyRows(DEFAULT_OCCASION_TILES);
    base.layout = 'grid';
  }
  if (type === 'price_ranges') base.priceRanges = copyRows(DEFAULT_PRICE_RANGES);
  if (type === 'tabbed_products') base.tabs = copyRows(DEFAULT_TABS);
  if (type === 'store_branches') base.branches = [{ ...EMPTY_BRANCH, nameAr: 'الفرع الرئيسي', nameEn: 'Main branch', opensAt: '09:00', closesAt: '23:00', days: [] }];
  if (type === 'reviews_carousel') base.limit = 8;
  if (type === 'recently_viewed' || type === 'buy_again') base.limit = 10;
  return base;
}

/** Content status line for the builder outline / health bar: { tone, text }. */
export function blockContentSummary(section, isAr, now = new Date()) {
  const cfg = section.blockConfig || {};
  switch (section.type) {
    case 'countdown_banner': {
      if (!cfg.endsAt) return { tone: 'error', text: isAr ? 'حدّد موعد انتهاء العدّاد' : 'Set when the countdown ends' };
      const end = new Date(cfg.endsAt);
      if (Number.isNaN(end.getTime())) return { tone: 'error', text: isAr ? 'موعد الانتهاء غير صالح' : 'The end time is not valid' };
      if (end <= now) {
        return cfg.hideWhenEnded !== false
          ? { tone: 'warn', text: isAr ? 'انتهى العدّاد — القسم مخفي الآن' : 'Countdown ended — hidden now' }
          : { tone: 'warn', text: isAr ? 'انتهى العدّاد' : 'Countdown has ended' };
      }
      const hours = Math.round((end - now) / 3_600_000);
      const left = hours >= 48
        ? (isAr ? `${Math.round(hours / 24)} يوم` : `${Math.round(hours / 24)} days`)
        : (isAr ? `${hours} ساعة` : `${hours} h`);
      return { tone: 'ok', text: isAr ? `ينتهي بعد ${left}` : `Ends in ${left}` };
    }
    case 'video_banner':
      if (cfg.youtubeId) return { tone: 'ok', text: isAr ? 'فيديو يوتيوب' : 'YouTube video' };
      if (cfg.videoUrl) return { tone: 'ok', text: isAr ? 'ملف فيديو MP4' : 'MP4 video file' };
      return { tone: 'error', text: isAr ? 'أضف رابط فيديو أو يوتيوب' : 'Add a video file or YouTube link' };
    case 'reviews_carousel': {
      const count = section.reviews?.length || 0;
      return count
        ? { tone: 'ok', text: isAr ? `${count} تقييم من العملاء` : `${count} customer reviews` }
        : { tone: 'warn', text: isAr ? 'لا توجد تقييمات معتمدة تطابق الاختيار بعد — القسم مخفي' : 'No approved reviews match yet — hidden' };
    }
    case 'signup_block': {
      const mode = cfg.signupMode || 'newsletter';
      if (mode !== 'newsletter' && !cfg.whatsappNumber) {
        return { tone: 'error', text: isAr ? 'أضف رقم واتساب' : 'Add a WhatsApp number' };
      }
      const count = section.subscriberCount;
      const label = SIGNUP_MODE_OPTIONS.find((o) => o.value === mode);
      const base = isAr ? label?.labelAr : label?.labelEn;
      return { tone: 'ok', text: Number.isFinite(count) && mode !== 'whatsapp' ? `${base} · ${count} ${isAr ? 'مشترك' : 'signed up'}` : base };
    }
    case 'price_ranges': {
      const count = cfg.priceRanges?.length || 0;
      return count
        ? { tone: 'ok', text: isAr ? `${count} فئات سعرية` : `${count} price tiles` }
        : { tone: 'error', text: isAr ? 'أضف فئة سعرية واحدة على الأقل' : 'Add at least one price tile' };
    }
    case 'tabbed_products': {
      const tabs = section.productTabs || cfg.tabs || [];
      if (!tabs.length) return { tone: 'error', text: isAr ? 'أضف تبويباً واحداً على الأقل' : 'Add at least one tab' };
      const empty = (section.productTabs || []).filter((tab) => !tab.products?.length).length;
      if (empty) return { tone: 'warn', text: isAr ? `${empty} تبويب بدون منتجات` : `${empty} tab(s) have no products` };
      return { tone: 'ok', text: isAr ? `${tabs.length} تبويبات` : `${tabs.length} tabs` };
    }
    case 'store_branches': {
      const count = cfg.branches?.length || 0;
      return count
        ? { tone: 'ok', text: isAr ? `${count} فرع` : `${count} branch${count === 1 ? '' : 'es'}` }
        : { tone: 'error', text: isAr ? 'أضف فرعاً واحداً على الأقل' : 'Add at least one branch' };
    }
    case 'recently_viewed':
      return { tone: 'muted', text: isAr ? 'لكل عميل ما شاهده — يختفي إن لم يشاهد شيئاً' : 'Each shopper’s own views — hidden when empty' };
    case 'picked_for_you':
      return {
        tone: 'muted',
        text: cfg.pickedFallback === 'hide'
          ? (isAr ? 'مقترحات لكل عميل — تختفي للزوار الجدد' : 'Suggestions per shopper — hidden for new visitors')
          : (isAr ? 'مقترحات لكل عميل — الأكثر مبيعاً للزوار الجدد' : 'Suggestions per shopper — best sellers for new visitors'),
      };
    case 'buy_again':
      return { tone: 'muted', text: isAr ? 'للعملاء المسجّلين الذين طلبوا من قبل' : 'Signed-in shoppers who ordered before' };
    case 'coupon_card': {
      if (!cfg.couponCode) return { tone: 'error', text: isAr ? 'اختر الكوبون الذي سيظهر' : 'Pick the coupon to show' };
      const problems = {
        not_found: isAr ? 'هذا الكود غير موجود — القسم مخفي' : 'That code does not exist — hidden',
        private: isAr ? 'كود خاص بعميل واحد لا يُعرض للجميع — القسم مخفي' : 'A one-customer code can’t be shown to everyone — hidden',
        inactive: isAr ? 'الكوبون متوقف — القسم مخفي' : 'The coupon is switched off — hidden',
        used_up_or_expired: isAr ? 'الكوبون انتهى أو نفدت مرات استخدامه — القسم مخفي' : 'The coupon expired or is used up — hidden',
      };
      if (section.couponProblem && problems[section.couponProblem]) return { tone: 'warn', text: problems[section.couponProblem] };
      return { tone: 'ok', text: isAr ? `يعرض الكود ${cfg.couponCode}` : `Shows code ${cfg.couponCode}` };
    }
    case 'occasion_tiles': {
      const count = cfg.tiles?.length || 0;
      return count
        ? { tone: 'ok', text: isAr ? `${count} مناسبات` : `${count} occasions` }
        : { tone: 'error', text: isAr ? 'أضف مناسبة واحدة على الأقل' : 'Add at least one occasion' };
    }
    case 'delivery_slot_bar':
      return { tone: 'muted', text: isAr ? 'كل زبون يرى موعد منطقته' : 'Each shopper sees the time for their area' };
    case 'spacer':
      return { tone: 'muted', text: isAr ? 'مسافة فارغة بين الأقسام' : 'Empty space between sections' };
    default:
      return null;
  }
}
