import mongoose from 'mongoose';

const homepageItemSchema = new mongoose.Schema(
  {
    titleAr: { type: String, trim: true, default: '' },
    titleEn: { type: String, trim: true, default: '' },
    subtitleAr: { type: String, trim: true, default: '' },
    subtitleEn: { type: String, trim: true, default: '' },
    image: { type: String, trim: true, default: '' },
    link: { type: String, trim: true, default: '/products' },
    emoji: { type: String, trim: true, default: '' },
    query: { type: String, trim: true, default: '' },
    ctaAr: { type: String, trim: true, default: '' },
    ctaEn: { type: String, trim: true, default: '' },
    accent: { type: String, trim: true, default: '' },
  },
  { _id: true },
);

const heroSlideSchema = new mongoose.Schema(
  {
    weekIndex: { type: Number, min: 1, max: 8760, default: null },
    periodIndex: { type: Number, min: 1, max: 8760, default: null },
    source: { type: String, enum: ['manual', 'banner'], default: 'manual' },
    bannerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Banner', default: null },
    titleAr: { type: String, trim: true, default: '' },
    titleEn: { type: String, trim: true, default: '' },
    subtitleAr: { type: String, trim: true, default: '' },
    subtitleEn: { type: String, trim: true, default: '' },
    image: { type: String, trim: true, default: '' },
    desktopImage: { type: String, trim: true, default: '' },
    mobileImage: { type: String, trim: true, default: '' },
    link: { type: String, trim: true, default: '/products' },
    ctaAr: { type: String, trim: true, default: 'تسوق الآن' },
    ctaEn: { type: String, trim: true, default: 'Shop Now' },
    isActive: { type: Boolean, default: true },
  },
  { _id: true },
);

const productQuerySchema = new mongoose.Schema(
  {
    section: { type: String, trim: true, default: '' },
    sort: { type: String, trim: true, default: 'newest' },
    brand: { type: String, trim: true, default: '' },
    offers: { type: Boolean, default: false },
    limit: { type: Number, min: 1, max: 24, default: 8 },
  },
  { _id: false },
);

const seoContentSchema = new mongoose.Schema(
  {
    bodyAr: { type: String, trim: true, default: '' },
    bodyEn: { type: String, trim: true, default: '' },
  },
  { _id: false },
);

const heroSchedulePeriodSchema = new mongoose.Schema(
  {
    periodIndex: { type: Number, min: 1, max: 8760, required: true },
    slides: { type: [heroSlideSchema], default: [] },
  },
  { _id: true },
);

const heroRotationSchema = new mongoose.Schema(
  {
    isEnabled: { type: Boolean, default: true },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    runsForever: { type: Boolean, default: true },
    unit: {
      type: String,
      enum: ['hour', 'day', 'week', 'month'],
      default: 'week',
    },
    cycleLength: { type: Number, default: 4, min: 1, max: 8760 },
    cycleWeeks: { type: Number, default: 4, min: 1, max: 52 },
    periods: { type: [heroSchedulePeriodSchema], default: [] },
    slots: { type: [heroSlideSchema], default: [] },
    sameFallback: { type: Boolean, default: true },
    fallbackAfterSlides: { type: [heroSlideSchema], default: [] },
  },
  { _id: false },
);

const announcementConfigSchema = new mongoose.Schema(
  {
    isEnabled: { type: Boolean, default: true },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    runsForever: { type: Boolean, default: true },
    mode: { type: String, enum: ['single', 'rotate'], default: 'single' },
    rotateSeconds: { type: Number, default: 6, min: 3, max: 20 },
    dismissible: { type: Boolean, default: false },
    sticky: { type: Boolean, default: false },
  },
  { _id: false },
);

const splitPromoConfigSchema = new mongoose.Schema(
  {
    columns: { type: Number, default: 2, min: 2, max: 4 },
    layout: {
      type: String,
      enum: ['balanced', 'featured-first', 'featured-last'],
      default: 'balanced',
    },
    cardStyle: {
      type: String,
      enum: ['overlay', 'gradient', 'minimal', 'bordered'],
      default: 'overlay',
    },
    tileHeight: {
      type: String,
      enum: ['compact', 'medium', 'tall'],
      default: 'medium',
    },
    gap: {
      type: String,
      enum: ['tight', 'normal', 'wide'],
      default: 'normal',
    },
    showTitle: { type: Boolean, default: false },
  },
  { _id: false },
);

const browseConfigSchema = new mongoose.Schema(
  {
    variant: {
      type: String,
      enum: ['split', 'products', 'subcategories', 'banner'],
      default: 'split',
    },
    subcategoryCount: { type: Number, default: 7, min: 4, max: 12 },
    showProducts: { type: Boolean, default: true },
    showSubcategories: { type: Boolean, default: true },
    productsLink: { type: String, trim: true, default: '/products' },
    subcategoriesLink: { type: String, trim: true, default: '/subcategories' },
  },
  { _id: false },
);

const categoryNavConfigSchema = new mongoose.Schema(
  {
    layout: { type: String, enum: ['scroll', 'grid'], default: 'scroll' },
    columns: { type: Number, default: 4, min: 3, max: 6 },
    showTitle: { type: Boolean, default: true },
    showViewAll: { type: Boolean, default: true },
    viewAllLink: { type: String, trim: true, default: '/categories' },
  },
  { _id: false },
);

const brandRowConfigSchema = new mongoose.Schema(
  {
    layout: { type: String, enum: ['scroll', 'grid'], default: 'scroll' },
    columns: { type: Number, default: 6, min: 4, max: 8 },
    tileStyle: { type: String, enum: ['logo', 'emoji', 'mixed'], default: 'mixed' },
  },
  { _id: false },
);

const productShowcaseConfigSchema = new mongoose.Schema(
  {
    layout: { type: String, enum: ['scroll', 'grid'], default: 'scroll' },
    columns: { type: Number, default: 4, min: 2, max: 4 },
    showViewAll: { type: Boolean, default: true },
  },
  { _id: false },
);

const dealConfigSchema = new mongoose.Schema(
  {
    style: { type: String, enum: ['standard', 'flash', 'minimal'], default: 'standard' },
    campaignMode: { type: String, enum: ['linked', 'standalone'], default: 'standalone' },
    discountPercent: { type: Number, default: 15, min: 1, max: 99 },
    showCountdown: { type: Boolean, default: true },
    countdownMode: {
      type: String,
      enum: ['end_of_day', 'duration', 'custom', 'promotion'],
      default: 'end_of_day',
    },
    countdownEnd: { type: String, trim: true, default: '' },
    countdownDurationHours: { type: Number, default: 6, min: 1, max: 72 },
    layout: { type: String, enum: ['scroll', 'grid'], default: 'scroll' },
    columns: { type: Number, default: 4, min: 2, max: 4 },
    showSubtitle: { type: Boolean, default: true },
    showViewAll: { type: Boolean, default: true },
  },
  { _id: false },
);

const homepageSectionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
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
      ],
      required: true,
      index: true,
    },
    titleAr: { type: String, trim: true, default: '' },
    titleEn: { type: String, trim: true, default: '' },
    subtitleAr: { type: String, trim: true, default: '' },
    subtitleEn: { type: String, trim: true, default: '' },
    sortOrder: { type: Number, default: 0, index: true },
    isActive: { type: Boolean, default: true, index: true },
    showOnMobile: { type: Boolean, default: true, index: true },
    layout: { type: String, trim: true, default: '' },
    ctaLabelAr: { type: String, trim: true, default: '' },
    ctaLabelEn: { type: String, trim: true, default: '' },
    link: { type: String, trim: true, default: '' },
    icon: { type: String, trim: true, default: '' },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    products: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
    }],
    promotionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Promotion',
      default: null,
    },
    campaignPlacement: {
      type: String,
      enum: ['hero', 'promo', 'sidebar', ''],
      default: '',
    },
    productQuery: {
      type: productQuerySchema,
      default: () => ({}),
    },
    items: {
      type: [homepageItemSchema],
      default: [],
    },
    heroMode: {
      type: String,
      enum: ['curated', 'auto', 'weekly_rotation'],
      default: 'curated',
    },
    heroSlides: {
      type: [heroSlideSchema],
      default: [],
    },
    heroRotation: {
      type: heroRotationSchema,
      default: () => ({}),
    },
    heroAutoplaySeconds: {
      type: Number,
      default: 6,
      min: 0,
      max: 60,
    },
    gridColumns: {
      type: Number,
      default: 3,
      min: 2,
      max: 4,
    },
    announcementConfig: {
      type: announcementConfigSchema,
      default: () => ({}),
    },
    splitPromoConfig: {
      type: splitPromoConfigSchema,
      default: () => ({}),
    },
    browseConfig: {
      type: browseConfigSchema,
      default: () => ({}),
    },
    categoryNavConfig: {
      type: categoryNavConfigSchema,
      default: () => ({}),
    },
    brandRowConfig: {
      type: brandRowConfigSchema,
      default: () => ({}),
    },
    productShowcaseConfig: {
      type: productShowcaseConfigSchema,
      default: () => ({}),
    },
    dealConfig: {
      type: dealConfigSchema,
      default: () => ({}),
    },
    seoContent: {
      type: seoContentSchema,
      default: () => ({}),
    },
  },
  { timestamps: true },
);

homepageSectionSchema.index({ isActive: 1, sortOrder: 1 });

const HomepageSection = mongoose.model('HomepageSection', homepageSectionSchema);

export default HomepageSection;
