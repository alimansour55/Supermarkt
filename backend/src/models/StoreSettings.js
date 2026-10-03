import mongoose from 'mongoose';
import { DEFAULT_LIVE_CHAT } from '../constants/storeDefaults.js';

const socialLinksSchema = new mongoose.Schema(
  {
    facebook: { type: String, trim: true, default: '' },
    instagram: { type: String, trim: true, default: '' },
    x: { type: String, trim: true, default: '' },
    youtube: { type: String, trim: true, default: '' },
  },
  { _id: false },
);

const appLinksSchema = new mongoose.Schema(
  {
    appStore: { type: String, trim: true, default: '' },
    googlePlay: { type: String, trim: true, default: '' },
    appGallery: { type: String, trim: true, default: '' },
  },
  { _id: false },
);

const loyaltySchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: true },
    earnPointsPerEGP: { type: Number, min: 0, default: 0.1 },
    redemptionEGPPerPoint: { type: Number, min: 0, default: 0.1 },
    expiryDays: { type: Number, min: 0, default: 365 },
    minOrderToEarn: { type: Number, min: 0, default: 0 },
    minRedeemPoints: { type: Number, min: 0, default: 10 },
    maxRedeemPercent: { type: Number, min: 0, max: 100, default: 50 },
  },
  { _id: false },
);

const walletSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: true },
    /** Customers may request manual top-ups (InstaPay / Vodafone Cash). */
    allowTopUp: { type: Boolean, default: true },
    /** Wallet balance may be spent at checkout. */
    allowCheckoutSpend: { type: Boolean, default: true },
    minTopUp: { type: Number, min: 1, default: 50 },
    maxTopUp: { type: Number, min: 1, default: 5000 },
    /** Reject top-ups that would push the balance above this. 0 = no cap. */
    maxBalance: { type: Number, min: 0, default: 20000 },
    /** Max share of an order's payable total the wallet can cover. */
    maxCheckoutPercent: { type: Number, min: 0, max: 100, default: 100 },
  },
  { _id: false },
);

const navLinkSchema = new mongoose.Schema(
  {
    labelAr: { type: String, trim: true, default: '' },
    labelEn: { type: String, trim: true, default: '' },
    href: { type: String, trim: true, default: '/' },
    sortOrder: { type: Number, default: 0 },
    isExternal: { type: Boolean, default: false },
    highlight: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    showOnMobile: { type: Boolean, default: true },
  },
  { _id: true },
);

const footerColumnSchema = new mongoose.Schema(
  {
    titleAr: { type: String, trim: true, default: '' },
    titleEn: { type: String, trim: true, default: '' },
    sortOrder: { type: Number, default: 0 },
    links: { type: [navLinkSchema], default: [] },
  },
  { _id: true },
);

const navCategorySchema = new mongoose.Schema(
  {
    categorySlug: { type: String, trim: true, required: true },
    labelAr: { type: String, trim: true, default: '' },
    labelEn: { type: String, trim: true, default: '' },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    showOnMobile: { type: Boolean, default: true },
  },
  { _id: true },
);

const homeNavSchema = new mongoose.Schema(
  {
    labelAr: { type: String, trim: true, default: 'الرئيسية' },
    labelEn: { type: String, trim: true, default: 'Home' },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    showOnMobile: { type: Boolean, default: true },
  },
  { _id: false },
);

const headerToolbarItemSchema = new mongoose.Schema(
  {
    itemKey: { type: String, trim: true, default: 'link' },
    labelAr: { type: String, trim: true, default: '' },
    labelEn: { type: String, trim: true, default: '' },
    href: { type: String, trim: true, default: '/' },
    zone: { type: String, enum: ['start', 'end'], default: 'end' },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    isExternal: { type: Boolean, default: false },
    showLabel: { type: Boolean, default: true },
    icon: { type: String, trim: true, default: 'layout-grid' },
    variant: { type: String, enum: ['pill', 'plain'], default: 'pill' },
  },
  { _id: true },
);

const footerConfigSchema = new mongoose.Schema(
  {
    showBackToTop: { type: Boolean, default: true },
    showSocial: { type: Boolean, default: true },
    showContact: { type: Boolean, default: true },
    showApps: { type: Boolean, default: true },
    showPayment: { type: Boolean, default: true },
    showLegal: { type: Boolean, default: true },
    /** Empty → storefront falls back to the built-in default legal links. */
    legalLinks: { type: [navLinkSchema], default: [] },
    /** Empty → storefront falls back to ['visa', 'mastercard']. */
    paymentMethods: {
      type: [{ type: String, enum: ['visa', 'mastercard', 'meeza', 'valu', 'fawry', 'instapay', 'vodafone-cash'] }],
      default: [],
    },
  },
  { _id: false },
);

const navigationSchema = new mongoose.Schema(
  {
    announcementAr: { type: String, trim: true, default: '' },
    announcementEn: { type: String, trim: true, default: '' },
    showCategoryLinks: { type: Boolean, default: true },
    /** Top utility bar (desktop) — customer-service link label / target. */
    topBarServiceLabelAr: { type: String, trim: true, default: '' },
    topBarServiceLabelEn: { type: String, trim: true, default: '' },
    topBarServiceHref: { type: String, trim: true, default: '' },
    homeNav: { type: homeNavSchema, default: () => ({}) },
    headerLinks: { type: [navLinkSchema], default: [] },
    navCategories: { type: [navCategorySchema], default: [] },
    headerToolbar: { type: [headerToolbarItemSchema], default: [] },
    footerColumns: { type: [footerColumnSchema], default: [] },
    footer: { type: footerConfigSchema, default: () => ({}) },
  },
  { _id: false },
);

const seoSchema = new mongoose.Schema(
  {
    defaultTitleAr: { type: String, trim: true, default: '' },
    defaultTitleEn: { type: String, trim: true, default: '' },
    defaultDescriptionAr: { type: String, trim: true, default: '' },
    defaultDescriptionEn: { type: String, trim: true, default: '' },
    ogImageUrl: { type: String, trim: true, default: '' },
    robotsIndex: { type: Boolean, default: true },
    googleAnalyticsId: { type: String, trim: true, default: '' },
    facebookPixelId: { type: String, trim: true, default: '' },
  },
  { _id: false },
);

const invoiceLabelsSchema = new mongoose.Schema(
  {
    invoiceAr: { type: String, trim: true, default: 'فاتورة' },
    invoiceEn: { type: String, trim: true, default: 'Invoice' },
    orderNumberAr: { type: String, trim: true, default: 'رقم الطلب' },
    orderNumberEn: { type: String, trim: true, default: 'Order no.' },
    dateAr: { type: String, trim: true, default: 'التاريخ' },
    dateEn: { type: String, trim: true, default: 'Date' },
    customerAr: { type: String, trim: true, default: 'بيانات العميل' },
    customerEn: { type: String, trim: true, default: 'Customer' },
    itemsAr: { type: String, trim: true, default: 'المنتجات' },
    itemsEn: { type: String, trim: true, default: 'Items' },
    itemAr: { type: String, trim: true, default: 'المنتج' },
    itemEn: { type: String, trim: true, default: 'Product' },
    qtyAr: { type: String, trim: true, default: 'الكمية' },
    qtyEn: { type: String, trim: true, default: 'Qty' },
    priceAr: { type: String, trim: true, default: 'السعر' },
    priceEn: { type: String, trim: true, default: 'Price' },
    lineTotalAr: { type: String, trim: true, default: 'المجموع' },
    lineTotalEn: { type: String, trim: true, default: 'Total' },
    subtotalAr: { type: String, trim: true, default: 'المجموع الفرعي' },
    subtotalEn: { type: String, trim: true, default: 'Subtotal' },
    deliveryAr: { type: String, trim: true, default: 'التوصيل' },
    deliveryEn: { type: String, trim: true, default: 'Delivery' },
    discountAr: { type: String, trim: true, default: 'الخصم' },
    discountEn: { type: String, trim: true, default: 'Discount' },
    pointsDiscountAr: { type: String, trim: true, default: 'خصم النقاط' },
    pointsDiscountEn: { type: String, trim: true, default: 'Points discount' },
    grandTotalAr: { type: String, trim: true, default: 'الإجمالي' },
    grandTotalEn: { type: String, trim: true, default: 'Grand total' },
    orderStatusAr: { type: String, trim: true, default: 'حالة الطلب' },
    orderStatusEn: { type: String, trim: true, default: 'Order status' },
    paymentStatusAr: { type: String, trim: true, default: 'حالة الدفع' },
    paymentStatusEn: { type: String, trim: true, default: 'Payment status' },
    phoneAr: { type: String, trim: true, default: 'الهاتف' },
    phoneEn: { type: String, trim: true, default: 'Phone' },
  },
  { _id: false },
);

const invoiceColumnsSchema = new mongoose.Schema(
  {
    sku: { type: Boolean, default: false },
    unitPrice: { type: Boolean, default: true },
    lineTotal: { type: Boolean, default: true },
  },
  { _id: false },
);

const invoiceCustomRowSchema = new mongoose.Schema(
  {
    labelAr: { type: String, trim: true, default: '' },
    labelEn: { type: String, trim: true, default: '' },
    valueAr: { type: String, trim: true, default: '' },
    valueEn: { type: String, trim: true, default: '' },
  },
  { _id: false },
);

const invoiceSchema = new mongoose.Schema(
  {
    titleAr: { type: String, trim: true, default: 'فاتورة' },
    titleEn: { type: String, trim: true, default: 'Tax Invoice' },
    documentPrefixAr: { type: String, trim: true, default: '' },
    documentPrefixEn: { type: String, trim: true, default: '' },
    companyNameAr: { type: String, trim: true, default: 'سوق+' },
    companyNameEn: { type: String, trim: true, default: 'MarketPlus' },
    companyAddressAr: { type: String, trim: true, default: 'القاهرة، مصر' },
    companyAddressEn: { type: String, trim: true, default: 'Cairo, Egypt' },
    taxRegistrationNumber: { type: String, trim: true, default: '' },
    taxIdLabelAr: { type: String, trim: true, default: 'الرقم الضريبي' },
    taxIdLabelEn: { type: String, trim: true, default: 'Tax ID' },
    paymentMethodLabelAr: { type: String, trim: true, default: 'طريقة الدفع' },
    paymentMethodLabelEn: { type: String, trim: true, default: 'Payment method' },
    headerNoteAr: { type: String, trim: true, default: '' },
    headerNoteEn: { type: String, trim: true, default: '' },
    footerNoteAr: { type: String, trim: true, default: 'شكراً لتسوقكم معنا!' },
    footerNoteEn: { type: String, trim: true, default: 'Thank you for shopping with us!' },
    termsAr: { type: String, trim: true, default: 'هذه فاتورة إلكترونية ولا تحتاج إلى توقيع.' },
    termsEn: { type: String, trim: true, default: 'This is an electronic invoice and does not require a signature.' },
    bankDetailsAr: { type: String, trim: true, default: '' },
    bankDetailsEn: { type: String, trim: true, default: '' },

    // Appearance
    accentColor: { type: String, trim: true, default: '#0f766e' },
    pageSize: { type: String, enum: ['A4', 'Letter'], default: 'A4' },
    logoPosition: { type: String, enum: ['start', 'center', 'end'], default: 'end' },
    logoSize: { type: String, enum: ['sm', 'md', 'lg'], default: 'md' },

    // Display toggles
    showLogo: { type: Boolean, default: true },
    showTaxId: { type: Boolean, default: true },
    showOrderStatus: { type: Boolean, default: true },
    showPaymentStatus: { type: Boolean, default: true },
    showPaymentMethod: { type: Boolean, default: true },
    showSavings: { type: Boolean, default: true },
    showBankDetails: { type: Boolean, default: false },
    showStamp: { type: Boolean, default: false },
    showQr: { type: Boolean, default: false },

    // Assets
    stampUrl: { type: String, trim: true, default: '' },
    stampPublicId: { type: String, trim: true, default: '' },

    columns: { type: invoiceColumnsSchema, default: () => ({}) },
    customRows: { type: [invoiceCustomRowSchema], default: [] },
    labels: { type: invoiceLabelsSchema, default: () => ({}) },
  },
  { _id: false },
);

const trendingSearchItemSchema = new mongoose.Schema(
  {
    query: { type: String, required: true, trim: true },
    labelAr: { type: String, trim: true, default: '' },
    labelEn: { type: String, trim: true, default: '' },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { _id: true },
);

const trendingConfigSchema = new mongoose.Schema(
  {
    /** Max chips shown to the customer (search bar + home section). */
    displayLimit: { type: Number, min: 1, max: 20, default: 8 },
    /** Analytics lookback window for auto / hybrid fill. */
    autoLookbackDays: { type: Number, min: 1, max: 30, default: 7 },
    /** Minimum times a query must have been searched to qualify. */
    autoMinCount: { type: Number, min: 1, default: 3 },
    /** Only surface queries that produced at least one conversion. */
    requireConversion: { type: Boolean, default: false },
    /** Never surface the same product twice (manual pin wins in hybrid). */
    dedupeByProduct: { type: Boolean, default: true },
    /** Normalized queries that must never appear in auto / hybrid results. */
    autoBlocklist: { type: [String], default: [] },
  },
  { _id: false },
);

const searchSettingsSchema = new mongoose.Schema(
  {
    trendingMode: { type: String, enum: ['manual', 'auto', 'hybrid'], default: 'manual' },
    trendingSearches: { type: [trendingSearchItemSchema], default: [] },
    trendingConfig: { type: trendingConfigSchema, default: () => ({}) },
  },
  { _id: false },
);

const adminPanelSchema = new mongoose.Schema(
  {
    showRevenue: { type: Boolean, default: true },
  },
  { _id: false },
);

const partnerRevenueWeightsSchema = new mongoose.Schema(
  {
    products: { type: Number, min: 0, default: 10 },
    productSales: { type: Number, min: 0, default: 25 },
    categories: { type: Number, min: 0, default: 5 },
    brands: { type: Number, min: 0, default: 5 },
    fulfillmentLocations: { type: Number, min: 0, default: 15 },
    deliveryZones: { type: Number, min: 0, default: 15 },
    promotions: { type: Number, min: 0, default: 10 },
    zoneOrders: { type: Number, min: 0, default: 12 },
    deliveryFees: { type: Number, min: 0, default: 8 },
  },
  { _id: false },
);

const partnerFactorEnabledSchema = new mongoose.Schema(
  {
    products: { type: Boolean, default: true },
    productSales: { type: Boolean, default: true },
    categories: { type: Boolean, default: true },
    brands: { type: Boolean, default: true },
    fulfillmentLocations: { type: Boolean, default: true },
    deliveryZones: { type: Boolean, default: true },
    promotions: { type: Boolean, default: true },
    zoneOrders: { type: Boolean, default: true },
    deliveryFees: { type: Boolean, default: true },
  },
  { _id: false },
);

const partnerScopesSchema = new mongoose.Schema(
  {
    products: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    categories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
    brands: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Brand' }],
    fulfillmentLocations: [{ type: mongoose.Schema.Types.ObjectId, ref: 'FulfillmentLocation' }],
    deliveryZones: [{ type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryZone' }],
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    promotions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Promotion' }],
  },
  { _id: false },
);

const partnerAttributionStreamsSchema = new mongoose.Schema(
  {
    productSales: { type: Boolean, default: true },
    zoneOrders: { type: Boolean, default: true },
    zoneDeliveryFees: { type: Boolean, default: true },
    locationOrders: { type: Boolean, default: true },
    customerOrders: { type: Boolean, default: true },
    promotionSales: { type: Boolean, default: true },
  },
  { _id: false },
);

const partnerBankSchema = new mongoose.Schema(
  {
    bankName: { type: String, trim: true, default: '' },
    accountHolder: { type: String, trim: true, default: '' },
    iban: { type: String, trim: true, default: '' },
    accountNumber: { type: String, trim: true, default: '' },
    swift: { type: String, trim: true, default: '' },
    branch: { type: String, trim: true, default: '' },
  },
  { _id: false },
);

const partnerEntrySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    nameAr: { type: String, trim: true, default: '' },
    nameEn: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' },
    fixedSharePercent: { type: Number, min: 0, max: 100, default: null },
    baseSharePercent: { type: Number, min: 0, max: 100, default: null },
    assignmentSharePercent: { type: Number, min: 0, max: 100, default: 100 },
    revenueRole: { type: String, enum: ['combined', 'assigned_only', 'pool_only'], default: 'combined' },
    weightMultiplier: { type: Number, min: 0.1, max: 10, default: 1 },
    scopes: { type: partnerScopesSchema, default: () => ({}) },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },

    /** Lifecycle — supersedes isActive; isActive is kept in sync on normalize. */
    status: { type: String, enum: ['active', 'paused', 'archived'], default: 'active' },
    displayColor: { type: String, trim: true, default: '' },
    avatarUrl: { type: String, trim: true, default: '' },
    tags: { type: [String], default: [] },

    /** CRM / legal */
    legalName: { type: String, trim: true, default: '' },
    taxId: { type: String, trim: true, default: '' },
    commercialRegNo: { type: String, trim: true, default: '' },
    contactPerson: { type: String, trim: true, default: '' },
    address: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    country: { type: String, trim: true, default: '' },
    website: { type: String, trim: true, default: '' },
    statementEmail: { type: String, trim: true, default: '' },
    onboardingNotes: { type: String, trim: true, default: '' },

    /** Banking / payout controls */
    bank: { type: partnerBankSchema, default: () => ({}) },
    payoutMethod: { type: String, enum: ['bank_transfer', 'cash', 'wallet', 'cheque', 'other', ''], default: '' },
    payoutCurrency: { type: String, trim: true, default: 'EGP' },
    payoutScheduleDay: { type: Number, min: 1, max: 28, default: null },
    minPayoutThreshold: { type: Number, min: 0, default: 0 },
    maxMonthlyPayout: { type: Number, min: 0, default: null },

    /** Contract window (YYYY-MM-DD) — partner is inert for rules/payouts outside it. */
    contractStartKey: { type: String, trim: true, default: '' },
    contractEndKey: { type: String, trim: true, default: '' },
    defaultCommissionPercent: { type: Number, min: 0, max: 100, default: null },
  },
  { _id: true },
);

const attributionRuleTierSchema = new mongoose.Schema(
  { upToValue: { type: Number, default: null }, value: { type: Number, default: 0 } },
  { _id: false },
);

const attributionRuleRateSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['percent', 'fixedPerOrder', 'fixedPerUnit', 'tiered'], default: 'percent' },
    value: { type: Number, default: 100 },
    tiers: { type: [attributionRuleTierSchema], default: [] },
  },
  { _id: false },
);

const attributionRuleConditionsSchema = new mongoose.Schema(
  {
    customers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    customerType: { type: String, enum: ['any', 'new', 'returning'], default: 'any' },
    minCustomerOrderCount: { type: Number, min: 0, default: null },
    maxCustomerOrderCount: { type: Number, min: 0, default: null },
    deliveryZones: [{ type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryZone' }],
    cities: { type: [String], default: [] },
    governorates: { type: [String], default: [] },
    fulfillmentLocations: [{ type: mongoose.Schema.Types.ObjectId, ref: 'FulfillmentLocation' }],
    products: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    categories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
    brands: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Brand' }],
    promotions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Promotion' }],
    couponCodes: { type: [String], default: [] },
    paymentMethods: { type: [String], default: [] },
    deliveryMethods: { type: [String], default: [] },
    minOrderValue: { type: Number, min: 0, default: null },
    maxOrderValue: { type: Number, min: 0, default: null },
    weekdays: { type: [Number], default: [] },
    dateFromKey: { type: String, trim: true, default: '' },
    dateToKey: { type: String, trim: true, default: '' },
  },
  { _id: false },
);

const attributionRuleBeneficiarySchema = new mongoose.Schema(
  {
    partnerKey: { type: String, trim: true, required: true },
    sharePercent: { type: Number, min: 0, max: 100, default: 100 },
  },
  { _id: false },
);

const attributionRuleSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: '' },
    description: { type: String, trim: true, default: '' },
    enabled: { type: Boolean, default: true },
    priority: { type: Number, default: 100 },
    source: { type: String, enum: ['manual', 'auto'], default: 'manual' },
    sourcePartnerKey: { type: String, trim: true, default: '' },
    scope: { type: String, enum: ['order', 'line'], default: 'order' },
    basis: {
      type: String,
      enum: ['orderTotal', 'orderSubtotal', 'orderGrossProfit', 'lineRevenue', 'lineGrossProfit', 'deliveryFee'],
      default: 'lineRevenue',
    },
    rate: { type: attributionRuleRateSchema, default: () => ({}) },
    stackable: { type: Boolean, default: false },
    beneficiaries: { type: [attributionRuleBeneficiarySchema], default: [] },
    conditions: { type: attributionRuleConditionsSchema, default: () => ({}) },
  },
  { _id: true },
);

const partnerRevenueSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    mode: { type: String, enum: ['weighted', 'equal', 'fixed', 'hybrid', 'attribution'], default: 'attribution' },
    revenueBasis: { type: String, enum: ['total', 'productSales', 'grossProfit'], default: 'total' },
    reservePercent: { type: Number, min: 0, max: 100, default: 0 },
    unassignedPolicy: { type: String, enum: ['percentage', 'equal', 'weighted', 'platform'], default: 'percentage' },
    attributionStreams: { type: partnerAttributionStreamsSchema, default: () => ({}) },
    weights: { type: partnerRevenueWeightsSchema, default: () => ({}) },
    factorEnabled: { type: partnerFactorEnabledSchema, default: () => ({}) },
    partners: { type: [partnerEntrySchema], default: [] },
    /** Ordered compound attribution rules (evaluated when mode === 'attribution'). */
    rules: { type: [attributionRuleSchema], default: [] },
  },
  { _id: false },
);

const productFilterSectionSchema = new mongoose.Schema(
  {
    id: { type: String, trim: true, required: true },
    enabled: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { _id: false },
);

const productSourceOptionSchema = new mongoose.Schema(
  {
    id: { type: String, trim: true, required: true },
    labelAr: { type: String, trim: true, default: '' },
    labelEn: { type: String, trim: true, default: '' },
    enabled: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { _id: false },
);

const productFilterSettingsSchema = new mongoose.Schema(
  {
    sections: { type: [productFilterSectionSchema], default: [] },
    sourceOptions: { type: [productSourceOptionSchema], default: [] },
  },
  { _id: false },
);

const freeDeliveryBannerSchema = new mongoose.Schema(
  {
    progressTitleAr: { type: String, trim: true, default: 'أضف {{remaining}} للمجاني' },
    progressTitleEn: { type: String, trim: true, default: 'Add {{remaining}} for free' },
    progressSubtitleAr: { type: String, trim: true, default: '{{methodsOnly}} · {{subtotal}}' },
    progressSubtitleEn: { type: String, trim: true, default: '{{methodsOnly}} · {{subtotal}}' },
    successTitleAr: { type: String, trim: true, default: '🎉 توصيل مجاني' },
    successTitleEn: { type: String, trim: true, default: '🎉 Free delivery' },
    successSubtitleAr: { type: String, trim: true, default: '' },
    successSubtitleEn: { type: String, trim: true, default: '' },
    switchTitleAr: { type: String, trim: true, default: '🎉 توصيل مجاني' },
    switchTitleEn: { type: String, trim: true, default: '🎉 Free delivery' },
    switchSubtitleAr: { type: String, trim: true, default: '{{methodsOnly}}' },
    switchSubtitleEn: { type: String, trim: true, default: '{{methodsOnly}}' },
    couponTitleAr: { type: String, trim: true, default: '🎁 توصيل مجاني' },
    couponTitleEn: { type: String, trim: true, default: '🎁 Free delivery' },
    couponSubtitleAr: { type: String, trim: true, default: 'من الكوبون' },
    couponSubtitleEn: { type: String, trim: true, default: 'Coupon applied' },
    methodNoteAr: { type: String, trim: true, default: '{{methodsOnly}}' },
    methodNoteEn: { type: String, trim: true, default: '{{methodsOnly}}' },
  },
  { _id: false },
);

const locationGateSchema = new mongoose.Schema(
  {
    /** Show the "choose your area" popup when a visitor opens the storefront. */
    enabled: { type: Boolean, default: false },
    /** When true the popup blocks browsing until a location is chosen. */
    mandatory: { type: Boolean, default: true },
    /** When true, a pin outside every active zone's radius is rejected ("we don't cover this area"). */
    enforceCoverage: { type: Boolean, default: true },
    titleAr: { type: String, trim: true, default: 'اختر منطقتك' },
    titleEn: { type: String, trim: true, default: 'Choose your area' },
    subtitleAr: {
      type: String,
      trim: true,
      default: 'حدّد منطقة التوصيل لعرض المنتجات والأسعار ومواعيد التوصيل الصحيحة',
    },
    subtitleEn: {
      type: String,
      trim: true,
      default: 'Set your delivery area to see the right products, prices and delivery slots',
    },
    /** Initial map center — defaults to Helwan, Cairo. */
    mapCenterLat: { type: Number, default: 29.8453 },
    mapCenterLng: { type: Number, default: 31.3339 },
    mapZoom: { type: Number, min: 3, max: 18, default: 12 },
    /**
     * Coverage areas (the umbrella): one or more independent circles that together define
     * everywhere the business delivers at all — they need not be adjacent (e.g. separate
     * circles for Cairo and Alexandria). Delivery zones are named sub-areas that must fall
     * inside at least one of these circles; they cannot extend service beyond them. Empty
     * until the admin configures at least one.
     */
    coverageAreas: {
      type: [
        {
          _id: false,
          id: { type: String, required: true },
          label: { type: String, trim: true, default: '' },
          lat: { type: Number, required: true },
          lng: { type: Number, required: true },
          radiusKm: { type: Number, min: 0.3, required: true },
        },
      ],
      default: [],
    },
  },
  { _id: false },
);

const FREE_DELIVERY_METHOD_VALUES = ['scheduled', 'express', 'recurring'];

const paymentAccountNumberSchema = new mongoose.Schema(
  {
    number: { type: String, trim: true, required: true },
    labelAr: { type: String, trim: true, default: '' },
    labelEn: { type: String, trim: true, default: '' },
  },
  { _id: false },
);

const paymentMethodSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, trim: true },
    enabled: { type: Boolean, default: true },
    labelAr: { type: String, trim: true, default: '' },
    labelEn: { type: String, trim: true, default: '' },
    descriptionAr: { type: String, trim: true, default: '' },
    descriptionEn: { type: String, trim: true, default: '' },
    sortOrder: { type: Number, default: 0 },
    accountNumbers: { type: [paymentAccountNumberSchema], default: [] },
  },
  { _id: false },
);

const themeRotationStepSchema = new mongoose.Schema(
  {
    color: { type: String, trim: true, default: 'green' },
    shade: { type: Number, default: 600 },
  },
  { _id: false },
);

const themeRotationSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    intervalMinutes: { type: Number, min: 1, max: 1440, default: 30 },
    steps: { type: [themeRotationStepSchema], default: [] },
  },
  { _id: false },
);

const customerServiceChannelSchema = new mongoose.Schema(
  {
    id: { type: String, trim: true, required: true },
    type: {
      type: String,
      enum: ['phone', 'callback', 'chat', 'email', 'whatsapp', 'custom'],
      default: 'custom',
    },
    enabled: { type: Boolean, default: true },
    labelAr: { type: String, trim: true, default: '' },
    labelEn: { type: String, trim: true, default: '' },
    descriptionAr: { type: String, trim: true, default: '' },
    descriptionEn: { type: String, trim: true, default: '' },
    /** Phone number / email address / external URL — unused for 'callback' and 'chat'. */
    value: { type: String, trim: true, default: '' },
    icon: { type: String, trim: true, default: '' },
    sortOrder: { type: Number, default: 0 },
  },
  { _id: false },
);

const customerServiceCallbackSchema = new mongoose.Schema(
  {
    noteAr: { type: String, trim: true, default: 'هنتصل بيك في أقرب وقت ممكن' },
    noteEn: { type: String, trim: true, default: "We'll call you back as soon as possible" },
    workingHoursAr: { type: String, trim: true, default: '' },
    workingHoursEn: { type: String, trim: true, default: '' },
  },
  { _id: false },
);

const customerServiceSchema = new mongoose.Schema(
  {
    /** Master switch for the customer-service hub (contact page + assistant integration). */
    enabled: { type: Boolean, default: true },
    channels: { type: [customerServiceChannelSchema], default: [] },
    callback: { type: customerServiceCallbackSchema, default: () => ({}) },
  },
  { _id: false },
);

const liveChatScheduleEntrySchema = new mongoose.Schema(
  {
    day: { type: Number, min: 0, max: 6, required: true },
    enabled: { type: Boolean, default: true },
    from: { type: String, trim: true, default: '09:00' },
    to: { type: String, trim: true, default: '23:00' },
  },
  { _id: false },
);

const liveChatSettingsSchema = new mongoose.Schema(
  {
    /** Master switch: when false the human live-chat feature is entirely off, regardless of hours. */
    enabled: { type: Boolean, default: DEFAULT_LIVE_CHAT.enabled },
    /** When false, live chat is always available (24/7) and `schedule` is ignored. */
    scheduleEnabled: { type: Boolean, default: DEFAULT_LIVE_CHAT.scheduleEnabled },
    schedule: { type: [liveChatScheduleEntrySchema], default: () => DEFAULT_LIVE_CHAT.schedule },
    /** Concurrent active conversations before new ones wait in queue (0 = unlimited). */
    maxConcurrentChats: { type: Number, min: 0, max: 50, default: DEFAULT_LIVE_CHAT.maxConcurrentChats },
    /** Team target: % of rated chats scoring 4-5 stars. */
    csatTargetPercent: { type: Number, min: 0, max: 100, default: DEFAULT_LIVE_CHAT.csatTargetPercent },
    /** Minutes of customer silence before asking to continue (0 = never). */
    idlePromptMinutes: { type: Number, min: 0, max: 1440, default: DEFAULT_LIVE_CHAT.idlePromptMinutes },
    /** Minutes of customer silence before the chat closes itself (0 = never). */
    autoCloseMinutes: { type: Number, min: 0, max: 10080, default: DEFAULT_LIVE_CHAT.autoCloseMinutes },
    /** Ask customers to rate a finished chat. */
    ratingEnabled: { type: Boolean, default: DEFAULT_LIVE_CHAT.ratingEnabled },
    /** Per-agent monthly handled-chats target (0 = none). */
    monthlyChatTarget: { type: Number, min: 0, max: 100000, default: DEFAULT_LIVE_CHAT.monthlyChatTarget },
    offlineMessageAr: { type: String, trim: true, default: DEFAULT_LIVE_CHAT.offlineMessageAr },
    offlineMessageEn: { type: String, trim: true, default: DEFAULT_LIVE_CHAT.offlineMessageEn },
  },
  { _id: false },
);

const driverSettingsSchema = new mongoose.Schema(
  {
    /** Master switch: pick a driver automatically when an order ships. */
    autoAssignEnabled: { type: Boolean, default: false },
    /** Skip drivers with at least this many active deliveries (0 = no cap). */
    autoAssignMaxActive: { type: Number, min: 0, max: 50, default: 0 },
    /** Show the online/offline control in the driver app and honour it in auto-assign. */
    availabilityEnabled: { type: Boolean, default: true },
    /** Show the picking checklist on the driver delivery screen. */
    pickingChecklistEnabled: { type: Boolean, default: true },
    /** Show the cash-on-delivery change calculator on the driver delivery screen. */
    cashCalculatorEnabled: { type: Boolean, default: true },
  },
  { _id: false },
);

const storeSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      unique: true,
      default: 'main',
      immutable: true,
    },
    storeNameAr: {
      type: String,
      trim: true,
      default: 'سوق+',
    },
    storeNameEn: {
      type: String,
      trim: true,
      default: 'MarketPlus',
    },
    taglineAr: {
      type: String,
      trim: true,
      default: 'تسوق احتياجاتك اليومية بسهولة وسرعة',
    },
    taglineEn: {
      type: String,
      trim: true,
      default: 'Shop everyday essentials quickly and easily',
    },
    logoUrl: { type: String, trim: true, default: '' },
    logoPublicId: { type: String, trim: true, default: '' },
    faviconUrl: { type: String, trim: true, default: '' },
    faviconPublicId: { type: String, trim: true, default: '' },
    supportPhone: { type: String, trim: true, default: '16XXX' },
    supportEmail: { type: String, trim: true, default: 'support@marketplus.com' },
    whatsappUrl: { type: String, trim: true, default: '' },
    defaultLocationAr: { type: String, trim: true, default: 'القاهرة' },
    defaultLocationEn: { type: String, trim: true, default: 'Cairo' },
    deliveryPromiseAr: { type: String, trim: true, default: 'توصيل خلال ساعتين' },
    deliveryPromiseEn: { type: String, trim: true, default: '2h delivery' },
    cartToastAddedAr: { type: String, trim: true, default: 'تمت إضافة {{qty}} × {{name}} إلى السلة' },
    cartToastAddedEn: { type: String, trim: true, default: 'Added {{qty}} × {{name}} to cart' },
    lowStockAlertEnabled: { type: Boolean, default: true },
    lowStockAlertThreshold: { type: Number, min: 1, default: 10 },
    /** Admin inventory alerts: show products with stock ≤ this value (0 = out-of-stock only for "below"). */
    adminStockAlertThreshold: { type: Number, min: 0, default: 10 },
    lowStockMessageAr: { type: String, trim: true, default: 'باقي {{qty}} فقط' },
    lowStockMessageEn: { type: String, trim: true, default: 'Only {{qty}} left' },
    freeDeliveryThreshold: { type: Number, min: 0, default: 500 },
    freeDeliveryEnabled: { type: Boolean, default: true },
    /** When false: no map pin at checkout, no live driver tracking for customers. */
    gpsDeliveryEnabled: { type: Boolean, default: true },
    /** When false: hide the store AI chat widget and block assistant API for customers. */
    aiChatEnabled: { type: Boolean, default: true },
    /** Startup "choose your area" popup configuration. */
    locationGate: { type: locationGateSchema, default: () => ({}) },
    freeDeliveryMethods: {
      type: [{ type: String, enum: FREE_DELIVERY_METHOD_VALUES }],
      default: ['scheduled', 'recurring'],
    },
    /** Minimum minutes before standard/recurring slot can start (global default). */
    scheduledMinLeadMinutes: { type: Number, min: 0, max: 1440, default: 120 },
    /** Minimum minutes before express delivery can start (global default). */
    expressMinLeadMinutes: { type: Number, min: 0, max: 1440, default: 120 },
    freeDeliveryBanner: { type: freeDeliveryBannerSchema, default: () => ({}) },
    currency: { type: String, trim: true, default: 'EGP' },
    socialLinks: { type: socialLinksSchema, default: () => ({}) },
    appLinks: { type: appLinksSchema, default: () => ({}) },
    loyalty: { type: loyaltySchema, default: () => ({}) },
    wallet: { type: walletSchema, default: () => ({}) },
    navigation: { type: navigationSchema, default: () => ({}) },
    seo: { type: seoSchema, default: () => ({}) },
    paymentMethods: { type: [paymentMethodSchema], default: [] },
    searchSettings: { type: searchSettingsSchema, default: () => ({}) },
    reviewSettings: {
      autoRequestOnDelivered: { type: Boolean, default: true },
      requestSms: { type: Boolean, default: true },
      requestEmail: { type: Boolean, default: true },
    },
    adminPanel: { type: adminPanelSchema, default: () => ({}) },
    partnerRevenue: { type: partnerRevenueSchema, default: () => ({}) },
    productFilterSettings: { type: productFilterSettingsSchema, default: () => ({}) },
    invoice: { type: invoiceSchema, default: () => ({}) },
    themeColor: { type: String, trim: true, default: 'hyperone' },
    themeShade: { type: Number, default: 600 },
    themeRotation: { type: themeRotationSchema, default: () => ({}) },
    driverSettings: { type: driverSettingsSchema, default: () => ({}) },
    customerService: { type: customerServiceSchema, default: () => ({}) },
    liveChat: { type: liveChatSettingsSchema, default: () => ({}) },
    siteFont: { type: String, trim: true, default: 'cairo' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const StoreSettings = mongoose.model('StoreSettings', storeSettingsSchema);

export default StoreSettings;
