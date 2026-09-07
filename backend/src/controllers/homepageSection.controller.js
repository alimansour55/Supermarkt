import HomepageSection from '../models/HomepageSection.js';
import Product from '../models/Product.js';
import Banner from '../models/Banner.js';
import Promotion from '../models/Promotion.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { formatProduct } from '../utils/formatters.js';
import { applyOffersOnlyFilter } from '../utils/offersFilter.js';
import { mergeCategoryIntoProductFilter } from '../utils/categoryTree.js';
import {
  attachSectionCategoryMeta,
  resolveSectionCategoryRef,
} from '../utils/homepageSectionCategory.js';
import {
  uploadFileToCloudinary,
  CLOUDINARY_FOLDERS,
} from '../utils/cloudinaryUpload.js';
import { formatPromotion, countPromotionProducts, syncTimedPromotionLifecycles } from '../services/promotion.service.js';
import {
  clearHomepagePromotionLink,
  findActiveLimitedPromotions,
  computeDealCountdownEnd,
  listHomepageCampaignCandidates as fetchHomepageCampaignCandidates,
  resolveDealSectionProducts,
  resolveLimitedDealsCountdownEnd,
  syncHomepageDealSection,
} from '../services/homepageDealPromotion.service.js';

const PUBLIC_HOMEPAGE_CACHE_TTL_MS = 45_000;
let publicHomepageCache = { data: null, at: 0 };

export function clearPublicHomepageCache() {
  publicHomepageCache = { data: null, at: 0 };
}

const SECTION_TYPES = [
  'hero_slider',
  'daily_offers',
  'top_categories',
  'browse_hub',
  'product_carousel',
  'category_spotlight',
  'trending_searches',
  'brand_row',
  'image_strip',
  'promo_grid',
  'sidebar_banners',
  'categories_scroll',
  'subcategories_preview',
  'free_delivery_banner',
  'delivery_area_bar',
  'cta_card',
  'loyalty_promo',
  'recurring_promo',
  'announcement_strip',
  'app_download',
  'seo_text',
  'split_promo',
  'flash_strip',
  'all_products_entry',
  'product_grid',
  'top_rated',
  'flash_sale',
  'trust_badges',
  'stats_bar',
  'feature_cards',
  'dual_cta',
  'signup_promo',
  'favorites_promo',
  'track_order_promo',
  'offers_banner',
  'faq_teaser',
  'rich_text_block',
];

const DEFAULT_SECTIONS = [
  { type: 'hero_slider', titleAr: 'العروض الرئيسية', titleEn: 'Hero campaigns', sortOrder: 10, heroMode: 'curated', heroSlides: [], heroAutoplaySeconds: 6 },
  { type: 'free_delivery_banner', titleAr: 'التوصيل المجاني', titleEn: 'Free delivery', sortOrder: 15, showOnMobile: true },
  { type: 'browse_hub', titleAr: 'تسوق حسب القسم', titleEn: 'Browse store', sortOrder: 20 },
  {
    type: 'daily_offers',
    titleAr: 'عروض اليوم',
    titleEn: "Today's Deals",
    sortOrder: 30,
    icon: '🔥',
    link: '/today-deals',
    productQuery: { limit: 8, sort: 'discount' },
    dealConfig: {
      style: 'standard',
      campaignMode: 'standalone',
      showCountdown: true,
      countdownMode: 'promotion',
      layout: 'scroll',
    },
  },
  {
    type: 'product_carousel',
    titleAr: 'الأكثر مبيعاً',
    titleEn: 'Best Sellers',
    sortOrder: 40,
    icon: '⭐',
    link: '/products?section=best-sellers&sort=best-selling',
    productQuery: { sort: 'best-selling', limit: 8, section: 'best-sellers' },
  },
  {
    type: 'product_carousel',
    titleAr: 'وصل حديثاً',
    titleEn: 'New Arrivals',
    sortOrder: 50,
    icon: '🆕',
    link: '/products?section=new-arrivals&sort=newest',
    productQuery: { sort: 'newest', limit: 8, section: 'new-arrivals' },
  },
  { type: 'brand_row', titleAr: 'تسوق حسب الماركة', titleEn: 'Shop by Brand', sortOrder: 60, icon: '🏷️', link: '/products' },
  {
    type: 'seo_text',
    titleAr: 'سوق+ للتسوق أونلاين',
    titleEn: 'MarketPlus Online Shopping',
    sortOrder: 90,
    seoContent: {
      bodyAr: 'تسوق البقالة والمنتجات اليومية والعروض من مكان واحد مع توصيل سريع وتجربة سهلة.',
      bodyEn: 'Shop groceries, everyday essentials, and offers from one place with fast delivery and an easy shopping experience.',
    },
  },
];

const parseOptionalBoolean = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return value === 'true' || value === '1';
};

const parseOptionalNumber = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const SECTION_FIELDS = [
  'type',
  'titleAr',
  'titleEn',
  'subtitleAr',
  'subtitleEn',
  'sortOrder',
  'isActive',
  'showOnMobile',
  'layout',
  'ctaLabelAr',
  'ctaLabelEn',
  'link',
  'icon',
  'category',
  'products',
  'promotionId',
  'campaignPlacement',
  'productQuery',
  'items',
  'heroMode',
  'heroSlides',
  'heroRotation',
  'heroAutoplaySeconds',
  'gridColumns',
  'announcementConfig',
  'splitPromoConfig',
  'browseConfig',
  'categoryNavConfig',
  'brandRowConfig',
  'productShowcaseConfig',
  'dealConfig',
  'seoContent',
];

const MS_HOUR = 60 * 60 * 1000;
const MS_DAY = 24 * MS_HOUR;
const MS_WEEK = 7 * MS_DAY;
const MS_MONTH = 30 * MS_DAY;

const SCHEDULE_UNIT_MS = {
  hour: MS_HOUR,
  day: MS_DAY,
  week: MS_WEEK,
  month: MS_MONTH,
};

const SCHEDULE_UNIT_MAX = {
  hour: 168,
  day: 31,
  week: 52,
  month: 12,
};

const normalizeHeroSlide = (slide) => ({
  weekIndex: slide.weekIndex ? parseOptionalNumber(slide.weekIndex, null) : null,
  periodIndex: slide.periodIndex ? parseOptionalNumber(slide.periodIndex, null) : null,
  source: slide.source === 'banner' ? 'banner' : 'manual',
  bannerId: slide.bannerId || null,
  titleAr: slide.titleAr || '',
  titleEn: slide.titleEn || '',
  subtitleAr: slide.subtitleAr || '',
  subtitleEn: slide.subtitleEn || '',
  image: slide.image || '',
  desktopImage: slide.desktopImage || slide.image || '',
  mobileImage: slide.mobileImage || '',
  link: slide.link || '/products',
  ctaAr: slide.ctaAr || 'تسوق الآن',
  ctaEn: slide.ctaEn || 'Shop Now',
  isActive: parseOptionalBoolean(slide.isActive, true),
});

const normalizeHeroRotation = (rotation) => {
  if (!rotation || typeof rotation !== 'object') {
    return {
      startDate: null, unit: 'week', cycleLength: 4, cycleWeeks: 4, periods: [], slots: [],
    };
  }

  const unit = ['hour', 'day', 'week', 'month'].includes(rotation.unit) ? rotation.unit : 'week';
  const maxCycle = SCHEDULE_UNIT_MAX[unit] || 52;
  const legacySlots = Array.isArray(rotation.slots)
    ? rotation.slots.map((slot, index) => normalizeHeroSlide({
      ...slot,
      weekIndex: slot.weekIndex || index + 1,
      periodIndex: slot.periodIndex || slot.weekIndex || index + 1,
    }))
    : [];

  let periods = Array.isArray(rotation.periods) ? rotation.periods : [];
  if (!periods.length && legacySlots.length) {
    periods = legacySlots.map((slot, index) => ({
      periodIndex: slot.periodIndex || slot.weekIndex || index + 1,
      slides: [slot],
    }));
  }

  periods = periods
    .map((period, index) => ({
      periodIndex: parseOptionalNumber(period.periodIndex, index + 1),
      slides: Array.isArray(period.slides)
        ? period.slides.map(normalizeHeroSlide)
        : [],
    }))
    .sort((a, b) => a.periodIndex - b.periodIndex);

  const cycleLength = Math.min(
    maxCycle,
    Math.max(1, parseOptionalNumber(
      rotation.cycleLength ?? rotation.cycleWeeks,
      periods.length || 4,
    )),
  );

  let startDate = null;
  if (rotation.startDate) {
    const parsed = new Date(rotation.startDate);
    if (!Number.isNaN(parsed.getTime())) startDate = parsed;
  }

  const runsForever = rotation.runsForever !== false;
  let endDate = null;
  if (!runsForever && rotation.endDate) {
    const parsedEnd = new Date(rotation.endDate);
    if (!Number.isNaN(parsedEnd.getTime())) endDate = parsedEnd;
  }

  if (startDate && endDate && startDate > endDate) {
    endDate = null;
  }

  return {
    isEnabled: rotation.isEnabled !== false,
    startDate,
    endDate,
    runsForever: runsForever && !endDate,
    unit,
    cycleLength,
    cycleWeeks: unit === 'week' ? cycleLength : (rotation.cycleWeeks || cycleLength),
    periods,
    slots: legacySlots,
    sameFallback: rotation.sameFallback !== false,
    fallbackAfterSlides: Array.isArray(rotation.fallbackAfterSlides)
      ? rotation.fallbackAfterSlides.map(normalizeHeroSlide)
      : [],
  };
};

const normalizeAnnouncementConfig = (config) => {
  if (!config || typeof config !== 'object') {
    return {
      isEnabled: true,
      startDate: null,
      endDate: null,
      runsForever: true,
      mode: 'single',
      rotateSeconds: 6,
      dismissible: false,
      sticky: false,
    };
  }

  let startDate = null;
  if (config.startDate) {
    const parsed = new Date(config.startDate);
    if (!Number.isNaN(parsed.getTime())) startDate = parsed;
  }

  const runsForever = config.runsForever !== false;
  let endDate = null;
  if (!runsForever && config.endDate) {
    const parsedEnd = new Date(config.endDate);
    if (!Number.isNaN(parsedEnd.getTime())) endDate = parsedEnd;
  }

  return {
    isEnabled: config.isEnabled !== false,
    startDate,
    endDate,
    runsForever: runsForever && !endDate,
    mode: config.mode === 'rotate' ? 'rotate' : 'single',
    rotateSeconds: Math.min(20, Math.max(3, parseOptionalNumber(config.rotateSeconds, 6))),
    dismissible: !!config.dismissible,
    sticky: !!config.sticky,
  };
};

function getAnnouncementPhase(config, now = new Date()) {
  if (config.isEnabled === false) return 'disabled';
  const start = config.startDate ? new Date(config.startDate) : null;
  const runsForever = config.runsForever !== false;
  const end = !runsForever && config.endDate ? new Date(config.endDate) : null;
  if (start && !Number.isNaN(start.getTime()) && now < start) return 'before';
  if (end && !Number.isNaN(end.getTime()) && now > end) return 'after';
  return 'active';
}

const normalizeHomepageItem = (item) => {
  const accents = ['primary', 'emerald', 'amber', 'rose', 'sky', 'violet'];
  return {
    titleAr: item.titleAr || '',
    titleEn: item.titleEn || '',
    subtitleAr: item.subtitleAr || '',
    subtitleEn: item.subtitleEn || '',
    image: item.image || '',
    link: item.link || '/products',
    emoji: item.emoji || '',
    query: item.query || '',
    ctaAr: item.ctaAr || '',
    ctaEn: item.ctaEn || '',
    accent: accents.includes(item.accent) ? item.accent : '',
  };
};

const normalizeSplitPromoConfig = (config) => {
  if (!config || typeof config !== 'object') {
    return {
      columns: 2,
      layout: 'balanced',
      cardStyle: 'overlay',
      tileHeight: 'medium',
      gap: 'normal',
      showTitle: false,
    };
  }
  const columns = Math.min(4, Math.max(2, parseOptionalNumber(config.columns, 2)));
  const layout = ['balanced', 'featured-first', 'featured-last'].includes(config.layout)
    ? config.layout
    : 'balanced';
  const cardStyle = ['overlay', 'gradient', 'minimal', 'bordered'].includes(config.cardStyle)
    ? config.cardStyle
    : 'overlay';
  const tileHeight = ['compact', 'medium', 'tall'].includes(config.tileHeight)
    ? config.tileHeight
    : 'medium';
  const gap = ['tight', 'normal', 'wide'].includes(config.gap) ? config.gap : 'normal';
  return {
    columns,
    layout,
    cardStyle,
    tileHeight,
    gap,
    showTitle: !!config.showTitle,
  };
};

const normalizeBrowseConfig = (config) => {
  if (!config || typeof config !== 'object') {
    return {
      variant: 'split',
      subcategoryCount: 7,
      showProducts: true,
      showSubcategories: true,
      productsLink: '/products',
      subcategoriesLink: '/subcategories',
    };
  }
  const variant = ['split', 'products', 'subcategories', 'banner'].includes(config.variant)
    ? config.variant
    : 'split';
  return {
    variant,
    subcategoryCount: Math.min(12, Math.max(4, parseOptionalNumber(config.subcategoryCount, 7))),
    showProducts: config.showProducts !== false,
    showSubcategories: config.showSubcategories !== false,
    productsLink: config.productsLink || '/products',
    subcategoriesLink: config.subcategoriesLink || '/subcategories',
  };
};

const normalizeCategoryNavConfig = (config) => {
  if (!config || typeof config !== 'object') {
    return {
      layout: 'scroll',
      columns: 4,
      showTitle: true,
      showViewAll: true,
      viewAllLink: '/categories',
    };
  }
  return {
    layout: config.layout === 'grid' ? 'grid' : 'scroll',
    columns: Math.min(6, Math.max(3, parseOptionalNumber(config.columns, 4))),
    showTitle: config.showTitle !== false,
    showViewAll: config.showViewAll !== false,
    viewAllLink: config.viewAllLink || '/categories',
  };
};

const normalizeBrandRowConfig = (config) => {
  if (!config || typeof config !== 'object') {
    return { layout: 'scroll', columns: 6, tileStyle: 'mixed' };
  }
  const tileStyle = ['logo', 'emoji', 'mixed'].includes(config.tileStyle) ? config.tileStyle : 'mixed';
  return {
    layout: config.layout === 'grid' ? 'grid' : 'scroll',
    columns: Math.min(8, Math.max(4, parseOptionalNumber(config.columns, 6))),
    tileStyle,
  };
};

const normalizeProductShowcaseConfig = (config, section = {}) => {
  const layout = config?.layout || section.layout || (section.type === 'product_grid' ? 'grid' : 'scroll');
  return {
    layout: layout === 'grid' ? 'grid' : 'scroll',
    columns: Math.min(4, Math.max(2, parseOptionalNumber(config?.columns, 4))),
    showViewAll: parseOptionalBoolean(config?.showViewAll, true),
  };
};

const normalizeDealConfig = (config, section = {}) => {
  const styles = ['standard', 'flash', 'minimal'];
  const modes = ['end_of_day', 'duration', 'custom', 'promotion'];
  const campaignModes = ['linked', 'standalone'];
  const style = styles.includes(config?.style)
    ? config.style
    : (section.type === 'flash_sale' ? 'flash' : 'standard');
  const layout = config?.layout || section.layout || 'scroll';
  const minimal = style === 'minimal';
  const campaignMode = campaignModes.includes(config?.campaignMode) ? config.campaignMode : 'standalone';
  let countdownMode = modes.includes(config?.countdownMode) ? config.countdownMode : 'end_of_day';
  if (campaignMode === 'linked') countdownMode = 'promotion';
  return {
    style,
    campaignMode,
    discountPercent: Math.min(99, Math.max(1, parseOptionalNumber(config?.discountPercent, 15))),
    showCountdown: minimal ? false : parseOptionalBoolean(config?.showCountdown, true),
    countdownMode: minimal ? 'end_of_day' : countdownMode,
    countdownEnd: String(config?.countdownEnd || ''),
    countdownDurationHours: Math.min(72, Math.max(1, parseOptionalNumber(config?.countdownDurationHours, 6))),
    layout: layout === 'grid' ? 'grid' : 'scroll',
    columns: Math.min(4, Math.max(2, parseOptionalNumber(config?.columns, 4))),
    showSubtitle: parseOptionalBoolean(config?.showSubtitle, true),
    showViewAll: parseOptionalBoolean(config?.showViewAll, true),
  };
};

const normalizePayload = (body) => {
  const payload = {};
  SECTION_FIELDS.forEach((field) => {
    if (body[field] !== undefined) payload[field] = body[field];
  });

  if (!SECTION_TYPES.includes(payload.type)) {
    throw new AppError('Invalid homepage section type', 400);
  }

  payload.sortOrder = parseOptionalNumber(payload.sortOrder, 0);
  payload.isActive = parseOptionalBoolean(payload.isActive, true);
  payload.showOnMobile = parseOptionalBoolean(payload.showOnMobile, true);
  payload.category = payload.category || null;
  payload.promotionId = payload.promotionId || null;
  payload.products = Array.isArray(payload.products) ? payload.products.filter(Boolean) : [];
  payload.items = Array.isArray(payload.items)
    ? payload.items.map(normalizeHomepageItem)
    : [];
  if (payload.heroSlides !== undefined) {
    payload.heroSlides = Array.isArray(payload.heroSlides)
      ? payload.heroSlides.map(normalizeHeroSlide)
      : [];
  }
  if (payload.heroMode !== undefined) {
    const modes = ['auto', 'weekly_rotation', 'curated'];
    payload.heroMode = modes.includes(payload.heroMode) ? payload.heroMode : 'curated';
  }
  if (payload.heroRotation !== undefined) {
    payload.heroRotation = normalizeHeroRotation(payload.heroRotation);
  }
  if (payload.heroAutoplaySeconds !== undefined) {
    const seconds = parseOptionalNumber(payload.heroAutoplaySeconds, 6);
    payload.heroAutoplaySeconds = Math.min(60, Math.max(0, seconds));
  }
  if (payload.gridColumns !== undefined) {
    payload.gridColumns = Math.min(4, Math.max(2, parseOptionalNumber(payload.gridColumns, 3)));
  }
  if (payload.announcementConfig !== undefined) {
    payload.announcementConfig = normalizeAnnouncementConfig(payload.announcementConfig);
  }
  if (payload.splitPromoConfig !== undefined) {
    payload.splitPromoConfig = normalizeSplitPromoConfig(payload.splitPromoConfig);
  }
  if (payload.browseConfig !== undefined) {
    payload.browseConfig = normalizeBrowseConfig(payload.browseConfig);
  }
  if (payload.categoryNavConfig !== undefined) {
    payload.categoryNavConfig = normalizeCategoryNavConfig(payload.categoryNavConfig);
  }
  if (payload.brandRowConfig !== undefined) {
    payload.brandRowConfig = normalizeBrandRowConfig(payload.brandRowConfig);
  }
  if (payload.productShowcaseConfig !== undefined) {
    payload.productShowcaseConfig = normalizeProductShowcaseConfig(payload.productShowcaseConfig, payload);
    payload.layout = payload.productShowcaseConfig.layout;
  }
  if (payload.dealConfig !== undefined) {
    payload.dealConfig = normalizeDealConfig(payload.dealConfig, payload);
    payload.layout = payload.dealConfig.layout;
  }
  payload.productQuery = {
    ...(payload.productQuery || {}),
    limit: parseOptionalNumber(payload.productQuery?.limit, 8),
    offers: parseOptionalBoolean(payload.productQuery?.offers, false),
  };
  payload.seoContent = payload.seoContent || {};

  return payload;
};

async function ensureDefaultSections() {
  const count = await HomepageSection.countDocuments();
  if (count > 0) return;
  await HomepageSection.insertMany(DEFAULT_SECTIONS);
}

async function productsForSection(section) {
  const isDealSection = section.type === 'daily_offers' || section.type === 'flash_sale';

  if (isDealSection) {
    return resolveDealSectionProducts(section);
  }

  if (section.products?.length) {
    const products = await Product.find({ _id: { $in: section.products }, isActive: true })
      .populate('category', 'slug nameAr nameEn isActive');
    const order = new Map(section.products.map((id, index) => [String(id), index]));
    return products
      .sort((a, b) => (order.get(String(a._id)) ?? 0) - (order.get(String(b._id)) ?? 0))
      .map(formatProduct);
  }

  const query = section.productQuery || {};
  const hasAutoFilters = Boolean(
    query.offers
    || query.section
    || query.brand
    || resolveSectionCategoryRef(section)
    || section.type === 'daily_offers'
    || section.type === 'category_spotlight',
  );
  const supportsAutoQuery = [
    'daily_offers',
    'product_carousel',
    'product_grid',
    'trending_searches',
    'category_spotlight',
    'top_rated',
    'flash_sale',
  ].includes(section.type);

  if (!supportsAutoQuery && !hasAutoFilters) return [];
  const sectionCategoryRef = resolveSectionCategoryRef(section);
  if (section.type === 'category_spotlight' && !sectionCategoryRef && !section.products?.length) {
    return [];
  }
  const filter = { isActive: true };
  if (sectionCategoryRef) {
    await mergeCategoryIntoProductFilter(filter, sectionCategoryRef);
  }
  if (query.section === 'top' || query.section === 'new-arrivals') filter.isFeatured = true;
  if (query.brand) filter.brand = query.brand;
  if (query.offers || section.type === 'daily_offers' || section.type === 'flash_sale') {
    applyOffersOnlyFilter(filter);
  }
  Object.keys(filter).forEach((key) => filter[key] === undefined && delete filter[key]);

  const sortMap = {
    newest: { createdAt: -1 },
    'best-selling': { soldCount: -1, rating: -1 },
    discount: { discount: -1, price: 1 },
    top: { rating: -1 },
    'price-low': { price: 1 },
    'price-high': { price: -1 },
    'price-asc': { price: 1 },
    'price-desc': { price: -1 },
  };

  const products = await Product.find(filter)
    .populate('category', 'slug nameAr nameEn isActive')
    .sort(sortMap[query.sort] || sortMap.newest)
    .limit(parseOptionalNumber(query.limit, 8));

  return products.map(formatProduct);
}

function formatBannerAsSlide(banner, overrides = {}) {
  return {
    _id: banner._id,
    id: String(banner._id),
    titleAr: overrides.titleAr || banner.titleAr,
    titleEn: overrides.titleEn || banner.titleEn,
    subtitleAr: overrides.subtitleAr ?? banner.subtitleAr ?? '',
    subtitleEn: overrides.subtitleEn ?? banner.subtitleEn ?? '',
    image: overrides.image || banner.image,
    desktopImage: overrides.desktopImage || banner.desktopImage || banner.image,
    mobileImage: overrides.mobileImage || banner.mobileImage || '',
    link: overrides.link || banner.link || '/products',
    ctaAr: overrides.ctaAr || banner.ctaAr || 'تسوق الآن',
    ctaEn: overrides.ctaEn || banner.ctaEn || 'Shop Now',
  };
}

function bannerIsLiveNow(banner, now = new Date()) {
  if (!banner?.isActive) return false;
  if (banner.startsAt && new Date(banner.startsAt) > now) return false;
  if (banner.endsAt && new Date(banner.endsAt) < now) return false;
  return true;
}

function getSchedulePhase(rotation, now = new Date()) {
  if (rotation.isEnabled === false) return 'disabled';

  const start = rotation.startDate ? new Date(rotation.startDate) : null;
  const runsForever = rotation.runsForever !== false;
  const end = !runsForever && rotation.endDate ? new Date(rotation.endDate) : null;

  if (start && !Number.isNaN(start.getTime()) && now < start) return 'before';
  if (end && !Number.isNaN(end.getTime()) && now > end) return 'after';
  return 'active';
}

function getSchedulePeriodIndex(startDate, unit, cycleLength, now = new Date()) {
  if (!startDate || !cycleLength) return 1;
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) return 1;
  const ms = SCHEDULE_UNIT_MS[unit] || MS_WEEK;
  const elapsed = Math.floor((now.getTime() - start.getTime()) / ms);
  if (elapsed < 0) return 0;
  return (elapsed % cycleLength) + 1;
}

async function resolveHeroSlideEntry(slide) {
  const plain = slide?.toObject ? slide.toObject() : slide;
  if (!plain) return null;

  if (plain.source === 'banner' && plain.bannerId) {
    const banner = await Banner.findById(plain.bannerId);
    if (!bannerIsLiveNow(banner)) return null;
    return formatBannerAsSlide(banner, plain);
  }

  const image = plain.desktopImage || plain.image || plain.mobileImage;
  if (!image) return null;
  return {
    _id: plain._id,
    id: String(plain._id || ''),
    titleAr: plain.titleAr,
    titleEn: plain.titleEn,
    subtitleAr: plain.subtitleAr || '',
    subtitleEn: plain.subtitleEn || '',
    image: plain.image || plain.desktopImage,
    desktopImage: plain.desktopImage || plain.image,
    mobileImage: plain.mobileImage || '',
    link: plain.link || '/products',
    ctaAr: plain.ctaAr || 'تسوق الآن',
    ctaEn: plain.ctaEn || 'Shop Now',
  };
}

async function resolveCuratedHeroSlides(slides) {
  const active = (slides || []).filter((s) => s.isActive !== false);
  const resolved = await Promise.all(active.map(resolveHeroSlideEntry));
  return resolved.filter(Boolean);
}

async function resolveBannerSlots(section, { defaultPlacement = 'hero', limit = null } = {}) {
  const configuredSlides = section.heroSlides || [];
  const mode = section.heroMode
    ?? (configuredSlides.length > 0 ? 'curated' : 'auto');

  let result = [];

  if (mode === 'weekly_rotation') {
    const rotation = normalizeHeroRotation(section.heroRotation || {});
    const { unit, cycleLength, periods } = rotation;
    const now = new Date();
    const phase = getSchedulePhase(rotation, now);

    if (phase === 'before' || phase === 'disabled') {
      result = await resolveCuratedHeroSlides(section.heroSlides);
    } else if (phase === 'after') {
      const afterSlides = rotation.sameFallback !== false
        ? section.heroSlides
        : (rotation.fallbackAfterSlides?.length ? rotation.fallbackAfterSlides : section.heroSlides);
      result = await resolveCuratedHeroSlides(afterSlides);
    } else {
      const periodIndex = getSchedulePeriodIndex(rotation.startDate, unit, cycleLength, now);

      if (periodIndex === 0) {
        const fallback = await resolveCuratedHeroSlides(section.heroSlides);
        if (fallback.length) {
          result = fallback;
        } else {
          const firstPeriod = periods.find((p) => p.periodIndex === 1) || periods[0];
          if (firstPeriod?.slides?.length) {
            result = await resolveCuratedHeroSlides(firstPeriod.slides);
          }
        }
      } else {
        const period = periods.find((p) => p.periodIndex === periodIndex)
          || periods[periodIndex - 1];
        const periodSlides = period?.slides || [];
        const resolved = await resolveCuratedHeroSlides(periodSlides);
        if (resolved.length) {
          result = resolved;
        } else {
          result = await resolveCuratedHeroSlides(section.heroSlides);
        }
      }
    }
  } else if (mode === 'auto' || (mode === 'curated' && configuredSlides.length === 0 && section.heroMode === undefined)) {
    const placement = section.campaignPlacement || defaultPlacement;
    const now = new Date();
    const queryLimit = limit ?? 12;
    const banners = await Banner.find({
      isActive: true,
      placement,
      targetAudience: 'all',
      $and: [
        { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
        { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] },
      ],
    }).sort({ priority: -1, sortOrder: 1, createdAt: -1 }).limit(queryLimit);
    result = banners.map((b) => formatBannerAsSlide(b));
  } else {
    result = await resolveCuratedHeroSlides(configuredSlides);
  }

  if (limit && result.length > limit) {
    return result.slice(0, limit);
  }
  return result;
}

async function resolvePromoBanners(section) {
  if (!['promo_grid', 'image_strip'].includes(section.type)) return [];
  const layout = section.layout || (section.type === 'image_strip' ? 'scroll' : 'grid');
  const isScroll = layout === 'scroll';
  const limit = isScroll
    ? 12
    : Math.min(4, Math.max(2, Number(section.gridColumns) || 3));
  const placement = section.campaignPlacement || 'promo';
  return resolveBannerSlots(section, { defaultPlacement: placement, limit });
}

async function resolveHeroSlides(section) {
  if (section.type !== 'hero_slider') return [];
  return resolveBannerSlots(section, { defaultPlacement: 'hero', limit: null });
}

async function bannersForSection(section) {
  const bannerTypes = ['promo_grid', 'sidebar_banners'];
  if (!bannerTypes.includes(section.type)) return [];

  const defaultPlacement = {
    image_strip: 'promo',
    promo_grid: 'promo',
    sidebar_banners: 'sidebar',
  };

  const placement = section.campaignPlacement || defaultPlacement[section.type] || 'promo';
  const now = new Date();
  const limit = section.type === 'promo_grid'
    ? Math.min(4, Math.max(2, Number(section.gridColumns) || 3))
    : section.type === 'sidebar_banners' ? 6 : 12;

  return Banner.find({
    isActive: true,
    placement,
    targetAudience: 'all',
    $and: [
      { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
      { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] },
    ],
  }).sort({ priority: -1, sortOrder: 1, createdAt: -1 }).limit(limit);
}

async function enrichSection(section) {
  const products = await productsForSection(section);
  const heroSlidesResolved = section.type === 'hero_slider'
    ? await resolveHeroSlides(section)
    : [];
  const banners = section.type === 'hero_slider'
    ? heroSlidesResolved
    : section.type === 'promo_grid' || section.type === 'image_strip'
      ? await resolvePromoBanners(section)
      : section.type === 'sidebar_banners'
        ? await resolveBannerSlots(
          Object.assign(section.toObject ? section.toObject() : { ...section }, { heroMode: section.heroMode || 'auto' }),
          { defaultPlacement: section.campaignPlacement || 'sidebar', limit: 6 },
        )
        : await bannersForSection(section);

  const data = section.toObject();
  attachSectionCategoryMeta(section, data);
  data.products = products;
  data.banners = banners;
  data.heroSlideCount = heroSlidesResolved.length;
  if ((section.type === 'hero_slider' || section.type === 'promo_grid' || section.type === 'image_strip' || section.type === 'sidebar_banners')
    && section.heroMode === 'weekly_rotation') {
    const rotation = normalizeHeroRotation(section.heroRotation || {});
    data.heroSchedulePhase = getSchedulePhase(rotation);
    data.heroRotationPeriodIndex = getSchedulePeriodIndex(
      rotation.startDate,
      rotation.unit,
      rotation.cycleLength,
    );
    data.heroRotationCycleLength = rotation.cycleLength;
    data.heroRotationUnit = rotation.unit;
    data.heroRotationWeekIndex = data.heroRotationPeriodIndex;
    data.heroRotationCycleWeeks = rotation.cycleLength;
  }
  if (section.type === 'announcement_strip' || section.type === 'flash_strip') {
    const config = normalizeAnnouncementConfig(section.announcementConfig || { isEnabled: true });
    data.announcementConfig = config;
    data.announcementPhase = getAnnouncementPhase(config);
    data.announcementVisible = data.announcementPhase === 'active';
    if (section.type === 'flash_strip' && !data.layout) {
      data.layout = 'bold';
    }
  }
  if (section.type === 'split_promo') {
    data.splitPromoConfig = normalizeSplitPromoConfig(section.splitPromoConfig || {});
    data.splitPromoTileCount = (section.items || []).filter((item) => item.titleAr || item.titleEn).length;
  }
  if (['browse_hub', 'top_categories', 'subcategories_preview', 'all_products_entry'].includes(section.type)) {
    let browseConfig = normalizeBrowseConfig(section.browseConfig || {});
    if (section.type === 'subcategories_preview') {
      browseConfig = normalizeBrowseConfig({
        ...browseConfig,
        variant: 'banner',
        showProducts: false,
        subcategoriesLink: section.link || browseConfig.subcategoriesLink,
      });
    }
    if (section.type === 'all_products_entry') {
      browseConfig = normalizeBrowseConfig({
        ...browseConfig,
        variant: 'products',
        showSubcategories: false,
        productsLink: section.link || browseConfig.productsLink,
      });
    }
    data.browseConfig = browseConfig;
  }
  if (section.type === 'categories_scroll') {
    data.categoryNavConfig = normalizeCategoryNavConfig(section.categoryNavConfig || {});
  }
  if (section.type === 'brand_row') {
    data.brandRowConfig = normalizeBrandRowConfig(section.brandRowConfig || {});
  }
  if (['product_grid', 'product_carousel', 'top_rated'].includes(section.type)) {
    data.productShowcaseConfig = normalizeProductShowcaseConfig(section.productShowcaseConfig || {}, section);
    data.layout = data.productShowcaseConfig.layout;
  }
  if (['daily_offers', 'flash_sale'].includes(section.type)) {
    data.dealConfig = normalizeDealConfig(section.dealConfig || {}, section);
    data.layout = data.dealConfig.layout;

    let promotion = null;
    if (section.promotionId) {
      promotion = await Promotion.findById(section.promotionId);
      if (promotion) {
        const productCount = await countPromotionProducts(promotion);
        data.linkedPromotion = formatPromotion(promotion, { productCount });
      }
    } else {
      const promotions = await findActiveLimitedPromotions();
      const countdownEnd = resolveLimitedDealsCountdownEnd(promotions);
      if (countdownEnd) {
        data.dealsMeta = { countdownEnd: countdownEnd.toISOString() };
      }
    }

    data.dealCountdownEnd = computeDealCountdownEnd(section, promotion);
  }
  return data;
}

export const getHomepageCampaignCandidates = asyncHandler(async (_req, res) => {
  const data = await fetchHomepageCampaignCandidates();
  res.json({ success: true, data });
});

export const getPublicHomepageSections = asyncHandler(async (_req, res) => {
  const now = Date.now();
  if (publicHomepageCache.data && now - publicHomepageCache.at < PUBLIC_HOMEPAGE_CACHE_TTL_MS) {
    res.set('Cache-Control', 'public, max-age=30');
    return res.json({ success: true, data: publicHomepageCache.data });
  }

  await syncTimedPromotionLifecycles();
  await ensureDefaultSections();
  const sections = await HomepageSection.find({ isActive: true })
    .populate('category', 'slug nameAr nameEn isActive')
    .sort({ sortOrder: 1, createdAt: 1 });

  const data = await Promise.all(sections.map(enrichSection));
  publicHomepageCache = { data, at: now };
  res.set('Cache-Control', 'public, max-age=30');
  res.json({ success: true, data });
});

export const getAdminHomepageSections = asyncHandler(async (_req, res) => {
  await ensureDefaultSections();
  const sections = await HomepageSection.find()
    .populate('category', 'slug nameAr nameEn isActive')
    .populate('products', 'slug nameAr nameEn price images')
    .sort({ sortOrder: 1, createdAt: 1 });

  res.json({ success: true, data: await Promise.all(sections.map(enrichSection)) });
});

export const createHomepageSection = asyncHandler(async (req, res) => {
  const section = await HomepageSection.create(normalizePayload(req.body));
  try {
    await syncHomepageDealSection(section);
    await section.save();
  } catch (err) {
    await section.deleteOne();
    throw err;
  }
  await section.populate('category', 'slug nameAr nameEn isActive');
  await section.populate('products', 'slug nameAr nameEn price images');
  clearPublicHomepageCache();
  res.status(201).json({ success: true, data: await enrichSection(section) });
});

export const updateHomepageSection = asyncHandler(async (req, res) => {
  const section = await HomepageSection.findById(req.params.id);
  if (!section) throw new AppError('Homepage section not found', 404);

  Object.assign(section, normalizePayload({ ...section.toObject(), ...req.body }));
  await syncHomepageDealSection(section);
  await section.save();
  await section.populate('category', 'slug nameAr nameEn isActive');
  await section.populate('products', 'slug nameAr nameEn price images');

  clearPublicHomepageCache();
  res.json({ success: true, data: await enrichSection(section) });
});

export const deleteHomepageSection = asyncHandler(async (req, res) => {
  const section = await HomepageSection.findById(req.params.id);
  if (!section) throw new AppError('Homepage section not found', 404);
  await clearHomepagePromotionLink(section._id);
  await section.deleteOne();
  clearPublicHomepageCache();
  res.json({ success: true, message: 'Homepage section deleted' });
});

export const reorderHomepageSections = asyncHandler(async (req, res) => {
  const { order } = req.body;
  if (!Array.isArray(order) || order.length === 0) {
    throw new AppError('Section order must be a non-empty array', 400);
  }

  const existing = await HomepageSection.find({ _id: { $in: order } }).select('_id');
  if (existing.length !== order.length) {
    throw new AppError('One or more homepage sections were not found', 400);
  }

  await Promise.all(
    order.map((id, index) => HomepageSection.updateOne(
      { _id: id },
      { sortOrder: (index + 1) * 10 },
    )),
  );

  const sections = await HomepageSection.find()
    .populate('category', 'slug nameAr nameEn isActive')
    .populate('products', 'slug nameAr nameEn price images')
    .sort({ sortOrder: 1, createdAt: 1 });

  clearPublicHomepageCache();
  res.json({ success: true, data: await Promise.all(sections.map(enrichSection)) });
});

export const uploadHeroSlideImage = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError('Image file is required', 400);
  try {
    const result = await uploadFileToCloudinary(req.file, CLOUDINARY_FOLDERS.homepage);
    res.json({ success: true, data: { url: result.url, publicId: result.publicId } });
  } catch {
    throw new AppError('Image upload failed — configure Cloudinary or use image URL', 400);
  }
});
