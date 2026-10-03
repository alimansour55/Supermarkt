import { mergeFreeDeliveryBanner, parseFreeDeliveryMethodsFromApi } from '../../utils/freeDelivery';

/** Keep in sync with DEFAULT_DRIVER_SETTINGS (backend/src/constants/storeDefaults.js). */
export const DEFAULT_DRIVER_SETTINGS = {
  autoAssignEnabled: false,
  autoAssignMaxActive: 0,
  availabilityEnabled: true,
  pickingChecklistEnabled: true,
  cashCalculatorEnabled: true,
};

export function normalizeDriverSettings(raw = {}) {
  const data = raw || {};
  const maxActive = Math.round(Number(data.autoAssignMaxActive));
  return {
    autoAssignEnabled: data.autoAssignEnabled === true,
    autoAssignMaxActive: Number.isFinite(maxActive) ? Math.min(50, Math.max(0, maxActive)) : 0,
    availabilityEnabled: data.availabilityEnabled !== false,
    pickingChecklistEnabled: data.pickingChecklistEnabled !== false,
    cashCalculatorEnabled: data.cashCalculatorEnabled !== false,
  };
}

/** Keep in sync with DEFAULT_LIVE_CHAT (backend/src/constants/storeDefaults.js). maxConcurrentChats: 0 = unlimited. */
export const DEFAULT_LIVE_CHAT_SETTINGS = {
  enabled: true,
  scheduleEnabled: false,
  schedule: [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, enabled: true, from: '09:00', to: '23:00' })),
  maxConcurrentChats: 2,
  csatTargetPercent: 90,
  monthlyChatTarget: 0,
  idlePromptMinutes: 1,
  autoCloseMinutes: 15,
  ratingEnabled: true,
  offlineMessageAr: '',
  offlineMessageEn: '',
};

export function normalizeLiveChatSettings(raw = {}) {
  const data = raw || {};
  const byDay = new Map((Array.isArray(data.schedule) ? data.schedule : []).map((e) => [Number(e?.day), e]));
  const schedule = DEFAULT_LIVE_CHAT_SETTINGS.schedule.map(({ day, from, to }) => {
    const entry = byDay.get(day) || {};
    return {
      day,
      enabled: entry.enabled !== false,
      from: entry.from || from,
      to: entry.to || to,
    };
  });
  const maxConcurrent = Math.round(Number(data.maxConcurrentChats));
  return {
    enabled: data.enabled !== false,
    scheduleEnabled: data.scheduleEnabled === true,
    schedule,
    maxConcurrentChats: Number.isFinite(maxConcurrent) ? Math.min(50, Math.max(0, maxConcurrent)) : DEFAULT_LIVE_CHAT_SETTINGS.maxConcurrentChats,
    idlePromptMinutes: Number.isFinite(Number(data.idlePromptMinutes)) ? Math.max(0, Math.round(Number(data.idlePromptMinutes))) : 1,
    autoCloseMinutes: Number.isFinite(Number(data.autoCloseMinutes)) ? Math.max(0, Math.round(Number(data.autoCloseMinutes))) : 15,
    ratingEnabled: data.ratingEnabled !== false,
    csatTargetPercent: Number.isFinite(Number(data.csatTargetPercent)) ? Math.min(100, Math.max(0, Number(data.csatTargetPercent))) : 90,
    monthlyChatTarget: Number.isFinite(Number(data.monthlyChatTarget)) ? Math.max(0, Math.round(Number(data.monthlyChatTarget))) : 0,
    offlineMessageAr: data.offlineMessageAr ?? '',
    offlineMessageEn: data.offlineMessageEn ?? '',
  };
}

/** Keep in sync with DEFAULT_LOCATION_GATE (backend/src/constants/storeDefaults.js). */
export const DEFAULT_LOCATION_GATE = {
  enabled: false,
  mandatory: true,
  enforceCoverage: true,
  titleAr: 'اختر منطقتك',
  titleEn: 'Choose your area',
  subtitleAr: 'حدّد منطقة التوصيل لعرض المنتجات والأسعار ومواعيد التوصيل الصحيحة',
  subtitleEn: 'Set your delivery area to see the right products, prices and delivery slots',
  mapCenterLat: 29.8453,
  mapCenterLng: 31.3339,
  mapZoom: 12,
  /** Coverage areas (the umbrella) — one or more circles; no delivery zone may accept orders from outside all of them. Empty until configured. */
  coverageAreas: [],
};

/** Keep in sync with DEFAULT_CUSTOMER_SERVICE (backend/src/constants/storeDefaults.js). */
export const DEFAULT_CUSTOMER_SERVICE = {
  enabled: true,
  channels: [
    {
      id: 'phone', type: 'phone', enabled: true,
      labelAr: 'اتصال هاتفي', labelEn: 'Phone call',
      descriptionAr: 'اتصل بنا مباشرة', descriptionEn: 'Call us directly',
      value: '', icon: 'phone', sortOrder: 0,
    },
    {
      id: 'callback', type: 'callback', enabled: true,
      labelAr: 'اطلب أن نتصل بك', labelEn: 'Request a call back',
      descriptionAr: 'اترك رقمك وهنتصل بيك', descriptionEn: "Leave your number and we'll call you",
      value: '', icon: 'phone-outgoing', sortOrder: 1,
    },
    {
      id: 'chat', type: 'chat', enabled: true,
      labelAr: 'الدردشة المباشرة', labelEn: 'Live chat',
      descriptionAr: 'تحدث مع المساعد الذكي', descriptionEn: 'Chat with our assistant',
      value: '', icon: 'message-circle', sortOrder: 2,
    },
    {
      id: 'email', type: 'email', enabled: true,
      labelAr: 'البريد الإلكتروني', labelEn: 'Email',
      descriptionAr: 'راسلنا وسنرد خلال 24 ساعة', descriptionEn: "Email us — we'll reply within 24 hours",
      value: '', icon: 'mail', sortOrder: 3,
    },
  ],
  callback: {
    noteAr: 'هنتصل بيك خلال ساعة في أوقات العمل',
    noteEn: "We'll call you back within an hour during business hours",
    workingHoursAr: '',
    workingHoursEn: '',
  },
};

export function normalizeCustomerService(raw = {}) {
  const data = raw || {};
  const channels = Array.isArray(data.channels) && data.channels.length
    ? data.channels.map((ch, index) => ({
      id: ch?.id || `channel-${index}`,
      type: ch?.type || 'custom',
      enabled: ch?.enabled !== false,
      labelAr: ch?.labelAr || '',
      labelEn: ch?.labelEn || '',
      descriptionAr: ch?.descriptionAr || '',
      descriptionEn: ch?.descriptionEn || '',
      value: ch?.value || '',
      icon: ch?.icon || '',
      sortOrder: Number(ch?.sortOrder ?? index),
    }))
    : DEFAULT_CUSTOMER_SERVICE.channels.map((ch) => ({ ...ch }));
  return {
    enabled: data.enabled !== false,
    channels,
    callback: {
      noteAr: data.callback?.noteAr ?? DEFAULT_CUSTOMER_SERVICE.callback.noteAr,
      noteEn: data.callback?.noteEn ?? DEFAULT_CUSTOMER_SERVICE.callback.noteEn,
      workingHoursAr: data.callback?.workingHoursAr ?? '',
      workingHoursEn: data.callback?.workingHoursEn ?? '',
    },
  };
}

let coverageAreaIdSeq = 0;
export function makeCoverageAreaId() {
  coverageAreaIdSeq += 1;
  return `area-${Date.now()}-${coverageAreaIdSeq}`;
}

function normalizeCoverageArea(raw) {
  const lat = Number(raw?.lat);
  const lng = Number(raw?.lng);
  const radiusKm = Number(raw?.radiusKm);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(radiusKm)) return null;
  return {
    id: raw?.id || makeCoverageAreaId(),
    label: raw?.label || '',
    lat,
    lng,
    radiusKm,
  };
}

export function normalizeLocationGate(raw = {}) {
  const data = raw || {};
  const num = (value, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };
  return {
    enabled: data.enabled === true,
    mandatory: data.mandatory !== false,
    enforceCoverage: data.enforceCoverage !== false,
    titleAr: data.titleAr ?? DEFAULT_LOCATION_GATE.titleAr,
    titleEn: data.titleEn ?? DEFAULT_LOCATION_GATE.titleEn,
    subtitleAr: data.subtitleAr ?? DEFAULT_LOCATION_GATE.subtitleAr,
    subtitleEn: data.subtitleEn ?? DEFAULT_LOCATION_GATE.subtitleEn,
    mapCenterLat: num(data.mapCenterLat, DEFAULT_LOCATION_GATE.mapCenterLat),
    mapCenterLng: num(data.mapCenterLng, DEFAULT_LOCATION_GATE.mapCenterLng),
    mapZoom: Math.round(num(data.mapZoom, DEFAULT_LOCATION_GATE.mapZoom)),
    coverageAreas: Array.isArray(data.coverageAreas)
      ? data.coverageAreas.map(normalizeCoverageArea).filter(Boolean)
      : [],
  };
}

export const DEFAULT_SEO_SETTINGS = {
  defaultTitleAr: '',
  defaultTitleEn: '',
  defaultDescriptionAr: '',
  defaultDescriptionEn: '',
  ogImageUrl: '',
  robotsIndex: true,
  googleAnalyticsId: '',
  facebookPixelId: '',
};

export const emptyStoreSettings = {
  storeNameAr: '',
  storeNameEn: '',
  taglineAr: '',
  taglineEn: '',
  logoUrl: '',
  faviconUrl: '',
  seo: { ...DEFAULT_SEO_SETTINGS },
  supportPhone: '',
  supportEmail: '',
  whatsappUrl: '',
  defaultLocationAr: '',
  defaultLocationEn: '',
  deliveryPromiseAr: '',
  deliveryPromiseEn: '',
  cartToastAddedAr: '',
  cartToastAddedEn: '',
  lowStockAlertEnabled: true,
  lowStockAlertThreshold: 10,
  lowStockMessageAr: 'باقي {{qty}} فقط',
  lowStockMessageEn: 'Only {{qty}} left',
  reviewSettings: {
    autoRequestOnDelivered: true,
    requestSms: true,
    requestEmail: true,
  },
  freeDeliveryThreshold: 0,
  freeDeliveryEnabled: true,
  gpsDeliveryEnabled: true,
  aiChatEnabled: true,
  locationGate: { ...DEFAULT_LOCATION_GATE },
  driverSettings: { ...DEFAULT_DRIVER_SETTINGS },
  customerService: { ...DEFAULT_CUSTOMER_SERVICE },
  freeDeliveryMethods: ['scheduled', 'recurring'],
  freeDeliveryBanner: mergeFreeDeliveryBanner(),
  scheduledMinLeadMinutes: 120,
  expressMinLeadMinutes: 120,
  currency: 'EGP',
  socialLinks: {
    facebook: '',
    instagram: '',
    x: '',
    youtube: '',
  },
  appLinks: {
    appStore: '',
    googlePlay: '',
    appGallery: '',
  },
  loyalty: {
    enabled: true,
    earnPointsPerEGP: 0.1,
    redemptionEGPPerPoint: 0.1,
    expiryDays: 365,
    minOrderToEarn: 100,
    minRedeemPoints: 100,
    maxRedeemPercent: 50,
  },
  isActive: true,
  adminPanel: {
    showRevenue: true,
  },
  invoice: {
    titleAr: 'فاتورة ضريبية',
    titleEn: 'Tax Invoice',
    documentPrefixAr: '',
    documentPrefixEn: '',
    companyNameAr: 'سوق+ للتجارة',
    companyNameEn: 'MarketPlus Retail',
    companyAddressAr: 'شارع التحرير، مدينة نصر، القاهرة، مصر',
    companyAddressEn: 'Tahrir Street, Nasr City, Cairo, Egypt',
    taxRegistrationNumber: '123-456-789',
    taxIdLabelAr: 'الرقم الضريبي',
    taxIdLabelEn: 'Tax ID',
    paymentMethodLabelAr: 'طريقة الدفع',
    paymentMethodLabelEn: 'Payment method',
    headerNoteAr: 'شكراً لاختياركم سوق+ — نتمنى لكم تسوقاً ممتعاً',
    headerNoteEn: 'Thank you for choosing MarketPlus — happy shopping!',
    footerNoteAr: 'للاستفسارات: اتصل بنا على الرقم الموضح أعلاه',
    footerNoteEn: 'For questions, call the support number shown above.',
    termsAr: 'هذه فاتورة إلكترونية صادرة من نظام سوق+ ولا تحتاج إلى توقيع أو ختم.',
    termsEn: 'This is an electronic invoice issued by MarketPlus and does not require a signature or stamp.',
    bankDetailsAr: '',
    bankDetailsEn: '',
    accentColor: '#0f766e',
    pageSize: 'A4',
    logoPosition: 'end',
    logoSize: 'md',
    showLogo: true,
    showTaxId: true,
    showOrderStatus: true,
    showPaymentStatus: true,
    showPaymentMethod: true,
    showSavings: true,
    showBankDetails: false,
    showStamp: false,
    showQr: false,
    stampUrl: '',
    columns: { sku: false, unitPrice: true, lineTotal: true },
    customRows: [],
    labels: {
      invoiceAr: 'فاتورة',
      invoiceEn: 'Invoice',
      orderNumberAr: 'رقم الطلب',
      orderNumberEn: 'Order no.',
      dateAr: 'التاريخ',
      dateEn: 'Date',
      customerAr: 'بيانات العميل',
      customerEn: 'Customer',
      itemsAr: 'المنتجات',
      itemsEn: 'Items',
      itemAr: 'المنتج',
      itemEn: 'Product',
      qtyAr: 'الكمية',
      qtyEn: 'Qty',
      priceAr: 'السعر',
      priceEn: 'Price',
      lineTotalAr: 'المجموع',
      lineTotalEn: 'Total',
      subtotalAr: 'المجموع الفرعي',
      subtotalEn: 'Subtotal',
      deliveryAr: 'التوصيل',
      deliveryEn: 'Delivery',
      discountAr: 'الخصم',
      discountEn: 'Discount',
      pointsDiscountAr: 'خصم النقاط',
      pointsDiscountEn: 'Points discount',
      grandTotalAr: 'الإجمالي',
      grandTotalEn: 'Grand total',
      orderStatusAr: 'حالة الطلب',
      orderStatusEn: 'Order status',
      paymentStatusAr: 'حالة الدفع',
      paymentStatusEn: 'Payment status',
      phoneAr: 'الهاتف',
      phoneEn: 'Phone',
    },
  },
};

export function normalizeStoreSettings(data = {}) {
  return {
    ...emptyStoreSettings,
    ...data,
    socialLinks: { ...emptyStoreSettings.socialLinks, ...(data.socialLinks || {}) },
    appLinks: { ...emptyStoreSettings.appLinks, ...(data.appLinks || {}) },
    seo: { ...DEFAULT_SEO_SETTINGS, ...(data.seo || {}) },
    loyalty: { ...emptyStoreSettings.loyalty, ...(data.loyalty || {}) },
    invoice: {
      ...emptyStoreSettings.invoice,
      ...(data.invoice || {}),
      labels: { ...emptyStoreSettings.invoice.labels, ...(data.invoice?.labels || {}) },
      columns: { ...emptyStoreSettings.invoice.columns, ...(data.invoice?.columns || {}) },
      customRows: Array.isArray(data.invoice?.customRows) ? data.invoice.customRows : [],
    },
    freeDeliveryThreshold: data.freeDeliveryThreshold ?? 0,
    freeDeliveryEnabled: data.freeDeliveryEnabled !== false,
    gpsDeliveryEnabled: data.gpsDeliveryEnabled !== false,
    aiChatEnabled: data.aiChatEnabled !== false,
    locationGate: normalizeLocationGate(data.locationGate),
    driverSettings: normalizeDriverSettings(data.driverSettings),
    customerService: normalizeCustomerService(data.customerService),
    liveChat: normalizeLiveChatSettings(data.liveChat),
    freeDeliveryMethods: parseFreeDeliveryMethodsFromApi(data.freeDeliveryMethods),
    freeDeliveryBanner: mergeFreeDeliveryBanner(data.freeDeliveryBanner),
    scheduledMinLeadMinutes: Number(data.scheduledMinLeadMinutes) || 120,
    expressMinLeadMinutes: Number(data.expressMinLeadMinutes) || 120,
    cartToastAddedAr: data.cartToastAddedAr ?? emptyStoreSettings.cartToastAddedAr,
    cartToastAddedEn: data.cartToastAddedEn ?? emptyStoreSettings.cartToastAddedEn,
    lowStockAlertEnabled: data.lowStockAlertEnabled !== false,
    lowStockAlertThreshold: Number(data.lowStockAlertThreshold) || 10,
    lowStockMessageAr: data.lowStockMessageAr ?? emptyStoreSettings.lowStockMessageAr,
    lowStockMessageEn: data.lowStockMessageEn ?? emptyStoreSettings.lowStockMessageEn,
    reviewSettings: {
      autoRequestOnDelivered: data.reviewSettings?.autoRequestOnDelivered !== false,
      requestSms: data.reviewSettings?.requestSms !== false,
      requestEmail: data.reviewSettings?.requestEmail !== false,
    },
    isActive: data.isActive !== false,
    adminPanel: {
      showRevenue: data.adminPanel?.showRevenue !== false,
    },
  };
}
