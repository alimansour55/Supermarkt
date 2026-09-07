import mongoose from 'mongoose';

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

const navigationSchema = new mongoose.Schema(
  {
    announcementAr: { type: String, trim: true, default: '' },
    announcementEn: { type: String, trim: true, default: '' },
    showCategoryLinks: { type: Boolean, default: true },
    homeNav: { type: homeNavSchema, default: () => ({}) },
    headerLinks: { type: [navLinkSchema], default: [] },
    navCategories: { type: [navCategorySchema], default: [] },
    headerToolbar: { type: [headerToolbarItemSchema], default: [] },
    footerColumns: { type: [footerColumnSchema], default: [] },
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

const invoiceSchema = new mongoose.Schema(
  {
    titleAr: { type: String, trim: true, default: 'فاتورة' },
    titleEn: { type: String, trim: true, default: 'Tax Invoice' },
    companyNameAr: { type: String, trim: true, default: 'سوق+' },
    companyNameEn: { type: String, trim: true, default: 'MarketPlus' },
    companyAddressAr: { type: String, trim: true, default: 'القاهرة، مصر' },
    companyAddressEn: { type: String, trim: true, default: 'Cairo, Egypt' },
    taxRegistrationNumber: { type: String, trim: true, default: '' },
    taxIdLabelAr: { type: String, trim: true, default: 'الرقم الضريبي' },
    taxIdLabelEn: { type: String, trim: true, default: 'Tax ID' },
    headerNoteAr: { type: String, trim: true, default: '' },
    headerNoteEn: { type: String, trim: true, default: '' },
    footerNoteAr: { type: String, trim: true, default: 'شكراً لتسوقكم معنا!' },
    footerNoteEn: { type: String, trim: true, default: 'Thank you for shopping with us!' },
    termsAr: { type: String, trim: true, default: 'هذه فاتورة إلكترونية ولا تحتاج إلى توقيع.' },
    termsEn: { type: String, trim: true, default: 'This is an electronic invoice and does not require a signature.' },
    showLogo: { type: Boolean, default: true },
    showTaxId: { type: Boolean, default: true },
    showOrderStatus: { type: Boolean, default: true },
    showPaymentStatus: { type: Boolean, default: true },
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

const searchSettingsSchema = new mongoose.Schema(
  {
    trendingMode: { type: String, enum: ['manual', 'auto'], default: 'manual' },
    trendingSearches: { type: [trendingSearchItemSchema], default: [] },
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
    themeColor: { type: String, trim: true, default: 'green' },
    themeShade: { type: Number, default: 600 },
    themeRotation: { type: themeRotationSchema, default: () => ({}) },
    siteFont: { type: String, trim: true, default: 'cairo' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const StoreSettings = mongoose.model('StoreSettings', storeSettingsSchema);

export default StoreSettings;
