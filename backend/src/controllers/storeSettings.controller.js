import StoreSettings from '../models/StoreSettings.js';
import {
  DEFAULT_NAVIGATION,
  DEFAULT_PAYMENT_METHODS,
  DEFAULT_SEARCH_SETTINGS,
  DEFAULT_TRENDING_CONFIG,
  DEFAULT_ADMIN_PANEL,
  DEFAULT_PARTNER_REVENUE,
  DEFAULT_SEO,
  DEFAULT_LOW_STOCK_ALERT,
  DEFAULT_LOCATION_GATE,
  DEFAULT_DRIVER_SETTINGS,
  DEFAULT_CUSTOMER_SERVICE,
  DEFAULT_LIVE_CHAT,
  DEFAULT_THEME_COLOR,
  DEFAULT_SITE_FONT,
} from '../constants/storeDefaults.js';
import { DEFAULT_THEME_SHADE, isValidThemeColor, isValidThemeShade, resolveThemeShade } from '../constants/siteThemes.js';
import { normalizeThemeRotation } from '../constants/themeRotation.js';
import { isValidSiteFont } from '../constants/siteFonts.js';
import { DEFAULT_INVOICE } from '../constants/invoiceDefaults.js';
import { DEFAULT_FREE_DELIVERY_BANNER } from '../constants/freeDeliveryBannerDefaults.js';
import { getDefaultProductFilterSettings, normalizeProductFilterSettings } from '../utils/productFilterSettings.js';
import { normalizeSearchQuery } from '../utils/searchQuery.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  CLOUDINARY_FOLDERS,
  deleteFromCloudinary,
  uploadFileToCloudinary,
} from '../utils/cloudinaryUpload.js';
import { invalidateStoreSettingsCache } from '../services/storeSettings.service.js';
import { isLiveChatAvailableNow, getNextAvailableAt } from '../utils/liveChatAvailability.js';
import { promoteFromQueue } from './supportConversation.controller.js';
import { generateSampleInvoicePdf } from '../services/invoicePdf.service.js';

const SETTINGS_KEY = 'main';

const ALLOWED_FIELDS = [
  'storeNameAr',
  'storeNameEn',
  'taglineAr',
  'taglineEn',
  'logoUrl',
  'faviconUrl',
  'supportPhone',
  'supportEmail',
  'whatsappUrl',
  'defaultLocationAr',
  'defaultLocationEn',
  'deliveryPromiseAr',
  'deliveryPromiseEn',
  'cartToastAddedAr',
  'cartToastAddedEn',
  'lowStockAlertEnabled',
  'lowStockAlertThreshold',
  'adminStockAlertThreshold',
  'lowStockMessageAr',
  'lowStockMessageEn',
  'freeDeliveryThreshold',
  'freeDeliveryEnabled',
  'gpsDeliveryEnabled',
  'aiChatEnabled',
  'locationGate',
  'freeDeliveryMethods',
  'freeDeliveryBanner',
  'scheduledMinLeadMinutes',
  'expressMinLeadMinutes',
  'currency',
  'socialLinks',
  'appLinks',
  'loyalty',
  'wallet',
  'navigation',
  'seo',
  'paymentMethods',
  'searchSettings',
  'adminPanel',
  'partnerRevenue',
  'productFilterSettings',
  'invoice',
  'themeColor',
  'themeShade',
  'themeRotation',
  'driverSettings',
  'customerService',
  'liveChat',
  'siteFont',
  'isActive',
];

const getOrCreateSettings = async () => {
  let settings = await StoreSettings.findOneAndUpdate(
    { key: SETTINGS_KEY },
    { $setOnInsert: { key: SETTINGS_KEY } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  let changed = false;
  if (!settings.navigation?.headerLinks?.length) {
    settings.navigation = { ...DEFAULT_NAVIGATION, ...(settings.navigation?.toObject?.() || settings.navigation) };
    changed = true;
  }
  if (!settings.seo?.defaultTitleAr) {
    settings.seo = { ...DEFAULT_SEO, ...(settings.seo?.toObject?.() || settings.seo) };
    changed = true;
  }
  if (!settings.paymentMethods?.length) {
    settings.paymentMethods = DEFAULT_PAYMENT_METHODS;
    changed = true;
  } else {
    const codMethod = settings.paymentMethods.find((method) => method.id === 'cod');
    if (codMethod?.descriptionAr?.includes('بالبطاقة للمندوب')) {
      codMethod.descriptionAr = 'ادفع نقداً عند الاستلام';
      codMethod.descriptionEn = 'Pay in cash on delivery';
      changed = true;
    }
    for (const defaultMethod of DEFAULT_PAYMENT_METHODS) {
      if (!settings.paymentMethods.some((method) => method.id === defaultMethod.id)) {
        settings.paymentMethods.push({ ...defaultMethod });
        changed = true;
      }
    }
  }
  if (!settings.invoice?.titleAr || !settings.invoice?.labels?.itemAr || !settings.invoice?.accentColor) {
    const current = settings.invoice?.toObject?.() || settings.invoice || {};
    settings.invoice = {
      ...DEFAULT_INVOICE,
      ...current,
      labels: {
        ...DEFAULT_INVOICE.labels,
        ...(settings.invoice?.labels?.toObject?.() || current.labels || {}),
      },
      columns: { ...DEFAULT_INVOICE.columns, ...(current.columns || {}) },
      customRows: Array.isArray(current.customRows) ? current.customRows : [],
    };
    changed = true;
  }
  if (!settings.searchSettings?.trendingSearches?.length) {
    settings.searchSettings = {
      ...DEFAULT_SEARCH_SETTINGS,
      ...(settings.searchSettings?.toObject?.() || settings.searchSettings),
    };
    changed = true;
  } else if (Array.isArray(settings.searchSettings.trendingSearches)) {
    let trendingFixed = false;
    const normalizedTrending = settings.searchSettings.trendingSearches.map((item, index) => {
      const raw = item?.toObject?.() || item;
      const query = String(raw.query || raw.labelAr || raw.labelEn || '').trim();
      if (!String(raw.query || '').trim() && query) trendingFixed = true;
      return {
        ...raw,
        query,
        labelAr: String(raw.labelAr || query).trim(),
        labelEn: String(raw.labelEn || query).trim(),
        productId: raw.productId || null,
        sortOrder: Number(raw.sortOrder ?? index),
      };
    }).filter((item) => item.query);
    if (trendingFixed) {
      settings.searchSettings.trendingSearches = normalizedTrending;
      changed = true;
    }
  }
  if (settings.searchSettings && settings.searchSettings.trendingConfig?.displayLimit === undefined) {
    const currentSearch = settings.searchSettings.toObject?.() || settings.searchSettings;
    settings.searchSettings = {
      ...currentSearch,
      trendingConfig: {
        ...DEFAULT_TRENDING_CONFIG,
        ...(settings.searchSettings.trendingConfig?.toObject?.()
          || currentSearch.trendingConfig
          || {}),
      },
    };
    changed = true;
  }
  if (settings.adminPanel?.showRevenue === undefined) {
    settings.adminPanel = {
      ...DEFAULT_ADMIN_PANEL,
      ...(settings.adminPanel?.toObject?.() || settings.adminPanel),
    };
    changed = true;
  }
  if (!settings.partnerRevenue || typeof settings.partnerRevenue !== 'object') {
    settings.partnerRevenue = { ...DEFAULT_PARTNER_REVENUE };
    changed = true;
  } else if (!settings.partnerRevenue.weights?.products && settings.partnerRevenue.weights?.products !== 0) {
    settings.partnerRevenue.weights = {
      ...DEFAULT_PARTNER_REVENUE.weights,
      ...(settings.partnerRevenue.weights?.toObject?.() || settings.partnerRevenue.weights || {}),
    };
    changed = true;
  }
  if (!settings.productFilterSettings?.sections?.length) {
    settings.productFilterSettings = getDefaultProductFilterSettings();
    settings.markModified('productFilterSettings');
    changed = true;
  }
  if (!settings.freeDeliveryBanner || typeof settings.freeDeliveryBanner !== 'object') {
    settings.freeDeliveryBanner = { ...DEFAULT_FREE_DELIVERY_BANNER };
    changed = true;
  }
  if (settings.freeDeliveryEnabled === undefined) {
    settings.freeDeliveryEnabled = true;
    changed = true;
  }
  if (settings.gpsDeliveryEnabled === undefined) {
    settings.gpsDeliveryEnabled = true;
    changed = true;
  }
  if (settings.aiChatEnabled === undefined) {
    settings.aiChatEnabled = true;
    changed = true;
  }
  if (!settings.locationGate || typeof settings.locationGate !== 'object' || settings.locationGate.enabled === undefined) {
    settings.locationGate = {
      ...DEFAULT_LOCATION_GATE,
      ...(settings.locationGate?.toObject?.() || settings.locationGate || {}),
    };
    settings.markModified('locationGate');
    changed = true;
  }
  if (!settings.driverSettings
    || typeof settings.driverSettings !== 'object'
    || settings.driverSettings.autoAssignEnabled === undefined) {
    settings.driverSettings = {
      ...DEFAULT_DRIVER_SETTINGS,
      ...(settings.driverSettings?.toObject?.() || settings.driverSettings || {}),
    };
    settings.markModified('driverSettings');
    changed = true;
  }
  if (!settings.liveChat?.schedule?.length) {
    const rawLiveChat = settings.liveChat?.toObject?.() || settings.liveChat || {};
    settings.liveChat = {
      ...DEFAULT_LIVE_CHAT,
      ...rawLiveChat,
      schedule: DEFAULT_LIVE_CHAT.schedule,
      offlineMessageAr: rawLiveChat.offlineMessageAr || DEFAULT_LIVE_CHAT.offlineMessageAr,
      offlineMessageEn: rawLiveChat.offlineMessageEn || DEFAULT_LIVE_CHAT.offlineMessageEn,
    };
    settings.markModified('liveChat');
    changed = true;
  }
  if (!settings.customerService?.channels?.length) {
    settings.customerService = {
      ...DEFAULT_CUSTOMER_SERVICE,
      ...(settings.customerService?.toObject?.() || settings.customerService || {}),
      channels: settings.customerService?.channels?.length
        ? settings.customerService.channels
        : DEFAULT_CUSTOMER_SERVICE.channels,
    };
    settings.markModified('customerService');
    changed = true;
  }
  if (settings.lowStockAlertThreshold === undefined || settings.lowStockAlertThreshold === null) {
    settings.lowStockAlertThreshold = DEFAULT_LOW_STOCK_ALERT.lowStockAlertThreshold;
    changed = true;
  }
  if (settings.adminStockAlertThreshold === undefined || settings.adminStockAlertThreshold === null) {
    settings.adminStockAlertThreshold = DEFAULT_LOW_STOCK_ALERT.adminStockAlertThreshold;
    changed = true;
  }
  if (settings.lowStockAlertEnabled === undefined) {
    settings.lowStockAlertEnabled = DEFAULT_LOW_STOCK_ALERT.lowStockAlertEnabled;
    changed = true;
  }
  if (!settings.lowStockMessageAr?.trim()) {
    settings.lowStockMessageAr = DEFAULT_LOW_STOCK_ALERT.lowStockMessageAr;
    changed = true;
  }
  if (!settings.lowStockMessageEn?.trim()) {
    settings.lowStockMessageEn = DEFAULT_LOW_STOCK_ALERT.lowStockMessageEn;
    changed = true;
  }
  if (!settings.reviewSettings || typeof settings.reviewSettings !== 'object') {
    settings.reviewSettings = {
      autoRequestOnDelivered: true,
      requestSms: true,
      requestEmail: true,
    };
    changed = true;
  }
  if (!settings.themeColor || !isValidThemeColor(settings.themeColor)) {
    settings.themeColor = DEFAULT_THEME_COLOR;
    changed = true;
  }
  if (!isValidThemeShade(settings.themeShade)) {
    settings.themeShade = DEFAULT_THEME_SHADE;
    changed = true;
  }
  const normalizedRotation = normalizeThemeRotation(settings.themeRotation, {
    color: settings.themeColor,
    shade: settings.themeShade,
  });
  if (JSON.stringify(settings.themeRotation || {}) !== JSON.stringify(normalizedRotation)) {
    settings.themeRotation = normalizedRotation;
    settings.markModified('themeRotation');
    changed = true;
  }
  if (!settings.siteFont || !isValidSiteFont(settings.siteFont)) {
    settings.siteFont = DEFAULT_SITE_FONT;
    changed = true;
  }
  if (changed) await settings.save();
  return settings;
};

const NESTED_SETTINGS_FIELDS = new Set([
  'socialLinks',
  'appLinks',
  'loyalty',
  'wallet',
  'navigation',
  'seo',
  'paymentMethods',
  'searchSettings',
  'adminPanel',
  'partnerRevenue',
  'productFilterSettings',
  'invoice',
  'freeDeliveryBanner',
  'freeDeliveryMethods',
  'reviewSettings',
  'themeRotation',
  'locationGate',
  'driverSettings',
  'customerService',
  'liveChat',
]);

const applySettingsUpdates = (settings, updates) => {
  Object.entries(updates).forEach(([key, value]) => {
    if (value === undefined) return;
    if (Array.isArray(value)) {
      settings.set(key, [...value]);
    } else {
      settings.set(key, value);
    }
    if (NESTED_SETTINGS_FIELDS.has(key)) {
      settings.markModified(key);
    }
  });
};

const parseSettingsPayload = (body) => {
  const raw = body || {};
  if (raw.settings !== undefined) {
    if (typeof raw.settings === 'string') {
      try {
        return JSON.parse(raw.settings);
      } catch {
        throw new AppError('Invalid settings JSON payload', 400);
      }
    }
    if (typeof raw.settings === 'object' && raw.settings !== null) {
      return raw.settings;
    }
  }
  return raw;
};

const pickSettings = (payload) => {
  const updates = {};
  ALLOWED_FIELDS.forEach((field) => {
    if (payload[field] !== undefined) updates[field] = payload[field];
  });

  if (updates.freeDeliveryThreshold !== undefined) {
    const threshold = Number(updates.freeDeliveryThreshold);
    if (Number.isNaN(threshold) || threshold < 0) {
      throw new AppError('freeDeliveryThreshold must be a positive number', 400);
    }
    updates.freeDeliveryThreshold = threshold;
  }

  if (updates.lowStockAlertThreshold !== undefined) {
    const threshold = Number(updates.lowStockAlertThreshold);
    if (Number.isNaN(threshold) || threshold < 1) {
      throw new AppError('lowStockAlertThreshold must be at least 1', 400);
    }
    updates.lowStockAlertThreshold = Math.min(9999, Math.round(threshold));
  }

  if (updates.adminStockAlertThreshold !== undefined) {
    const threshold = Number(updates.adminStockAlertThreshold);
    if (Number.isNaN(threshold) || threshold < 0) {
      throw new AppError('adminStockAlertThreshold must be 0 or greater', 400);
    }
    updates.adminStockAlertThreshold = Math.min(9999, Math.round(threshold));
  }

  if (updates.lowStockAlertEnabled !== undefined) {
    updates.lowStockAlertEnabled = updates.lowStockAlertEnabled === true
      || updates.lowStockAlertEnabled === 'true'
      || updates.lowStockAlertEnabled === '1';
  }

  if (updates.lowStockMessageAr !== undefined) {
    updates.lowStockMessageAr = String(updates.lowStockMessageAr || '').trim()
      || DEFAULT_LOW_STOCK_ALERT.lowStockMessageAr;
  }

  if (updates.lowStockMessageEn !== undefined) {
    updates.lowStockMessageEn = String(updates.lowStockMessageEn || '').trim()
      || DEFAULT_LOW_STOCK_ALERT.lowStockMessageEn;
  }

  if (updates.freeDeliveryEnabled !== undefined) {
    updates.freeDeliveryEnabled = updates.freeDeliveryEnabled === true
      || updates.freeDeliveryEnabled === 'true'
      || updates.freeDeliveryEnabled === '1';
  }
  if (updates.gpsDeliveryEnabled !== undefined) {
    updates.gpsDeliveryEnabled = updates.gpsDeliveryEnabled === true
      || updates.gpsDeliveryEnabled === 'true'
      || updates.gpsDeliveryEnabled === '1';
  }
  if (updates.aiChatEnabled !== undefined) {
    updates.aiChatEnabled = updates.aiChatEnabled === true
      || updates.aiChatEnabled === 'true'
      || updates.aiChatEnabled === '1';
  }

  if (updates.locationGate !== undefined) {
    const raw = updates.locationGate || {};
    const toBool = (value, fallback) => {
      if (value === undefined) return fallback;
      return value === true || value === 'true' || value === '1';
    };
    const clampNum = (value, min, max, fallback) => {
      const num = Number(value);
      if (Number.isNaN(num)) return fallback;
      return Math.min(max, Math.max(min, num));
    };
    updates.locationGate = {
      enabled: toBool(raw.enabled, false),
      mandatory: toBool(raw.mandatory, true),
      enforceCoverage: toBool(raw.enforceCoverage, true),
      titleAr: String(raw.titleAr ?? '').trim() || DEFAULT_LOCATION_GATE.titleAr,
      titleEn: String(raw.titleEn ?? '').trim() || DEFAULT_LOCATION_GATE.titleEn,
      subtitleAr: String(raw.subtitleAr ?? '').trim() || DEFAULT_LOCATION_GATE.subtitleAr,
      subtitleEn: String(raw.subtitleEn ?? '').trim() || DEFAULT_LOCATION_GATE.subtitleEn,
      mapCenterLat: clampNum(raw.mapCenterLat, -90, 90, DEFAULT_LOCATION_GATE.mapCenterLat),
      mapCenterLng: clampNum(raw.mapCenterLng, -180, 180, DEFAULT_LOCATION_GATE.mapCenterLng),
      mapZoom: Math.round(clampNum(raw.mapZoom, 3, 18, DEFAULT_LOCATION_GATE.mapZoom)),
      coverageAreas: Array.isArray(raw.coverageAreas)
        ? raw.coverageAreas
          .map((area, index) => {
            const lat = clampNum(area?.lat, -90, 90, null);
            const lng = clampNum(area?.lng, -180, 180, null);
            const radiusKm = clampNum(area?.radiusKm, 0.3, 500, null);
            if (lat == null || lng == null || radiusKm == null) return null;
            return {
              id: String(area?.id || '').trim() || `area-${Date.now()}-${index}`,
              label: String(area?.label ?? '').trim(),
              lat,
              lng,
              radiusKm,
            };
          })
          .filter(Boolean)
        : [],
    };
  }

  if (updates.driverSettings !== undefined) {
    const raw = updates.driverSettings || {};
    const toBool = (value, fallback) => {
      if (value === undefined) return fallback;
      return value === true || value === 'true' || value === '1';
    };
    const maxActive = Math.round(Number(raw.autoAssignMaxActive));
    updates.driverSettings = {
      autoAssignEnabled: toBool(raw.autoAssignEnabled, DEFAULT_DRIVER_SETTINGS.autoAssignEnabled),
      autoAssignMaxActive: Number.isFinite(maxActive)
        ? Math.min(50, Math.max(0, maxActive))
        : DEFAULT_DRIVER_SETTINGS.autoAssignMaxActive,
      availabilityEnabled: toBool(raw.availabilityEnabled, DEFAULT_DRIVER_SETTINGS.availabilityEnabled),
      pickingChecklistEnabled: toBool(raw.pickingChecklistEnabled, DEFAULT_DRIVER_SETTINGS.pickingChecklistEnabled),
      cashCalculatorEnabled: toBool(raw.cashCalculatorEnabled, DEFAULT_DRIVER_SETTINGS.cashCalculatorEnabled),
    };
  }

  if (updates.liveChat !== undefined) {
    const raw = updates.liveChat || {};
    const toBool = (value, fallback) => {
      if (value === undefined) return fallback;
      return value === true || value === 'true' || value === '1';
    };
    const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;
    const normTime = (value, fallback) => (timeRe.test(String(value || '')) ? value : fallback);
    const scheduleByDay = new Map(
      (Array.isArray(raw.schedule) ? raw.schedule : []).map((entry) => [Number(entry?.day), entry]),
    );
    const schedule = DEFAULT_LIVE_CHAT.schedule.map(({ day, from, to }) => {
      const entry = scheduleByDay.get(day) || {};
      return {
        day,
        enabled: toBool(entry.enabled, true),
        from: normTime(entry.from, from),
        to: normTime(entry.to, to),
      };
    });
    const maxConcurrent = Math.round(Number(raw.maxConcurrentChats));
    updates.liveChat = {
      enabled: toBool(raw.enabled, DEFAULT_LIVE_CHAT.enabled),
      scheduleEnabled: toBool(raw.scheduleEnabled, DEFAULT_LIVE_CHAT.scheduleEnabled),
      schedule,
      maxConcurrentChats: Number.isFinite(maxConcurrent)
        ? Math.min(50, Math.max(0, maxConcurrent))
        : DEFAULT_LIVE_CHAT.maxConcurrentChats,
      idlePromptMinutes: Number.isFinite(Number(raw.idlePromptMinutes))
        ? Math.min(1440, Math.max(0, Math.round(Number(raw.idlePromptMinutes))))
        : DEFAULT_LIVE_CHAT.idlePromptMinutes,
      autoCloseMinutes: Number.isFinite(Number(raw.autoCloseMinutes))
        ? Math.min(10080, Math.max(0, Math.round(Number(raw.autoCloseMinutes))))
        : DEFAULT_LIVE_CHAT.autoCloseMinutes,
      ratingEnabled: toBool(raw.ratingEnabled, DEFAULT_LIVE_CHAT.ratingEnabled),
      csatTargetPercent: Number.isFinite(Number(raw.csatTargetPercent))
        ? Math.min(100, Math.max(0, Number(raw.csatTargetPercent)))
        : DEFAULT_LIVE_CHAT.csatTargetPercent,
      monthlyChatTarget: Number.isFinite(Number(raw.monthlyChatTarget))
        ? Math.min(100000, Math.max(0, Math.round(Number(raw.monthlyChatTarget))))
        : DEFAULT_LIVE_CHAT.monthlyChatTarget,
      offlineMessageAr: String(raw.offlineMessageAr ?? '').trim() || DEFAULT_LIVE_CHAT.offlineMessageAr,
      offlineMessageEn: String(raw.offlineMessageEn ?? '').trim() || DEFAULT_LIVE_CHAT.offlineMessageEn,
    };
  }

  if (updates.customerService !== undefined) {
    const raw = updates.customerService || {};
    const allowedTypes = ['phone', 'callback', 'chat', 'email', 'whatsapp', 'custom'];
    const channels = (Array.isArray(raw.channels) ? raw.channels : [])
      .map((ch, index) => ({
        id: String(ch?.id || '').trim() || `channel-${Date.now()}-${index}`,
        type: allowedTypes.includes(ch?.type) ? ch.type : 'custom',
        enabled: ch?.enabled !== false && ch?.enabled !== 'false',
        labelAr: String(ch?.labelAr || '').trim(),
        labelEn: String(ch?.labelEn || '').trim(),
        descriptionAr: String(ch?.descriptionAr || '').trim(),
        descriptionEn: String(ch?.descriptionEn || '').trim(),
        value: String(ch?.value || '').trim(),
        icon: String(ch?.icon || '').trim(),
        sortOrder: Number(ch?.sortOrder ?? index),
      }))
      .filter((ch) => ch.labelAr || ch.labelEn);

    updates.customerService = {
      enabled: raw.enabled !== false && raw.enabled !== 'false',
      channels,
      callback: {
        noteAr: String(raw.callback?.noteAr ?? '').trim() || DEFAULT_CUSTOMER_SERVICE.callback.noteAr,
        noteEn: String(raw.callback?.noteEn ?? '').trim() || DEFAULT_CUSTOMER_SERVICE.callback.noteEn,
        workingHoursAr: String(raw.callback?.workingHoursAr ?? '').trim(),
        workingHoursEn: String(raw.callback?.workingHoursEn ?? '').trim(),
      },
    };
  }

  if (updates.freeDeliveryMethods !== undefined) {
    const allowed = ['scheduled', 'express', 'recurring'];
    const methods = (Array.isArray(updates.freeDeliveryMethods) ? updates.freeDeliveryMethods : [])
      .filter((m) => allowed.includes(m));
    if (!methods.length) {
      throw new AppError('Select at least one delivery method for free delivery', 400);
    }
    updates.freeDeliveryMethods = methods;
  }

  if (updates.freeDeliveryBanner !== undefined) {
    const raw = updates.freeDeliveryBanner || {};
    const merged = { ...DEFAULT_FREE_DELIVERY_BANNER };
    Object.keys(DEFAULT_FREE_DELIVERY_BANNER).forEach((key) => {
      if (raw[key] !== undefined) merged[key] = String(raw[key] ?? '').trim();
    });
    updates.freeDeliveryBanner = merged;
  }

  ['scheduledMinLeadMinutes', 'expressMinLeadMinutes'].forEach((field) => {
    if (updates[field] === undefined) return;
    const minutes = Math.round(Number(updates[field]));
    if (Number.isNaN(minutes) || minutes < 0 || minutes > 1440) {
      throw new AppError(`${field} must be between 0 and 1440 minutes`, 400);
    }
    updates[field] = minutes;
  });

  if (updates.loyalty !== undefined) {
    const current = updates.loyalty || {};
    updates.loyalty = {
      ...current,
      enabled: current.enabled !== false && current.enabled !== 'false',
      earnPointsPerEGP: Number(current.earnPointsPerEGP) || 0,
      redemptionEGPPerPoint: Number(current.redemptionEGPPerPoint) || 0,
      expiryDays: Math.max(0, Number(current.expiryDays) || 0),
      minOrderToEarn: Math.max(0, Number(current.minOrderToEarn) || 0),
      minRedeemPoints: Math.max(0, Number(current.minRedeemPoints) || 0),
      maxRedeemPercent: Math.min(100, Math.max(0, Number(current.maxRedeemPercent) || 0)),
    };
  }

  if (updates.isActive !== undefined && typeof updates.isActive !== 'boolean') {
    updates.isActive = updates.isActive === 'true' || updates.isActive === '1';
  }

  if (updates.paymentMethods !== undefined) {
    updates.paymentMethods = (Array.isArray(updates.paymentMethods) ? updates.paymentMethods : [])
      .map((method, index) => ({
        id: String(method.id || '').trim(),
        enabled: method.enabled !== false && method.enabled !== 'false',
        labelAr: method.labelAr || '',
        labelEn: method.labelEn || '',
        descriptionAr: method.descriptionAr || '',
        descriptionEn: method.descriptionEn || '',
        sortOrder: Number(method.sortOrder ?? index),
        accountNumbers: (Array.isArray(method.accountNumbers) ? method.accountNumbers : [])
          .map((entry) => ({
            number: String(entry.number || '').trim(),
            labelAr: String(entry.labelAr || '').trim(),
            labelEn: String(entry.labelEn || '').trim(),
          }))
          .filter((entry) => entry.number),
      }))
      .filter((method) => method.id);
  }

  if (updates.searchSettings !== undefined) {
    const current = updates.searchSettings || {};
    const cfg = current.trendingConfig || {};
    const clamp = (value, min, max, dflt) => {
      const num = Number(value);
      if (!Number.isFinite(num)) return dflt;
      return Math.min(Math.max(Math.round(num), min), max);
    };
    const bool = (v, dflt) => (v === undefined ? dflt : (v !== false && v !== 'false' && v !== '0'));
    updates.searchSettings = {
      trendingMode: ['auto', 'hybrid'].includes(current.trendingMode) ? current.trendingMode : 'manual',
      trendingSearches: (Array.isArray(current.trendingSearches) ? current.trendingSearches : [])
        .map((item, index) => ({
          query: String(item.query || item.labelAr || item.labelEn || '').trim(),
          labelAr: String(item.labelAr || item.query || '').trim(),
          labelEn: String(item.labelEn || item.query || '').trim(),
          productId: item.productId && String(item.productId).length === 24 ? item.productId : null,
          sortOrder: Number(item.sortOrder ?? index),
          isActive: item.isActive !== false && item.isActive !== 'false',
        }))
        .filter((item) => item.query),
      trendingConfig: {
        displayLimit: clamp(cfg.displayLimit, 1, 20, DEFAULT_TRENDING_CONFIG.displayLimit),
        autoLookbackDays: clamp(cfg.autoLookbackDays, 1, 30, DEFAULT_TRENDING_CONFIG.autoLookbackDays),
        autoMinCount: clamp(cfg.autoMinCount, 1, 1000, DEFAULT_TRENDING_CONFIG.autoMinCount),
        requireConversion: bool(cfg.requireConversion, DEFAULT_TRENDING_CONFIG.requireConversion),
        dedupeByProduct: bool(cfg.dedupeByProduct, DEFAULT_TRENDING_CONFIG.dedupeByProduct),
        autoBlocklist: [...new Set(
          (Array.isArray(cfg.autoBlocklist) ? cfg.autoBlocklist : [])
            .map((entry) => normalizeSearchQuery(String(entry || '')))
            .filter(Boolean),
        )].slice(0, 50),
      },
    };
  }

  if (updates.adminPanel !== undefined) {
    const current = updates.adminPanel || {};
    updates.adminPanel = {
      showRevenue: current.showRevenue !== false && current.showRevenue !== 'false',
    };
  }

  if (updates.productFilterSettings !== undefined) {
    updates.productFilterSettings = normalizeProductFilterSettings(updates.productFilterSettings);
  }

  if (updates.invoice !== undefined) {
    const current = updates.invoice || {};
    const bool = (v, dflt) => (v === undefined ? dflt : (v !== false && v !== 'false' && v !== '0'));
    const hex = /^#[0-9a-fA-F]{6}$/.test(String(current.accentColor || '').trim())
      ? String(current.accentColor).trim().toLowerCase()
      : DEFAULT_INVOICE.accentColor;
    const customRows = (Array.isArray(current.customRows) ? current.customRows : [])
      .map((r) => ({
        labelAr: String(r?.labelAr || '').trim().slice(0, 60),
        labelEn: String(r?.labelEn || '').trim().slice(0, 60),
        valueAr: String(r?.valueAr || '').trim().slice(0, 120),
        valueEn: String(r?.valueEn || '').trim().slice(0, 120),
      }))
      .filter((r) => r.labelAr || r.labelEn || r.valueAr || r.valueEn)
      .slice(0, 8);
    updates.invoice = {
      ...DEFAULT_INVOICE,
      ...current,
      accentColor: hex,
      pageSize: current.pageSize === 'Letter' ? 'Letter' : 'A4',
      logoPosition: ['start', 'center', 'end'].includes(current.logoPosition) ? current.logoPosition : 'end',
      logoSize: ['sm', 'md', 'lg'].includes(current.logoSize) ? current.logoSize : 'md',
      labels: { ...DEFAULT_INVOICE.labels, ...(current.labels || {}) },
      columns: {
        sku: current.columns?.sku === true || current.columns?.sku === 'true',
        unitPrice: bool(current.columns?.unitPrice, true),
        lineTotal: bool(current.columns?.lineTotal, true),
      },
      customRows,
      showLogo: bool(current.showLogo, true),
      showTaxId: bool(current.showTaxId, true),
      showOrderStatus: bool(current.showOrderStatus, true),
      showPaymentStatus: bool(current.showPaymentStatus, true),
      showPaymentMethod: bool(current.showPaymentMethod, true),
      showSavings: bool(current.showSavings, true),
      showBankDetails: current.showBankDetails === true || current.showBankDetails === 'true',
      showStamp: current.showStamp === true || current.showStamp === 'true',
      showQr: current.showQr === true || current.showQr === 'true',
    };
    // stampUrl / stampPublicId are managed by the upload handler, not the JSON body.
    delete updates.invoice.stampPublicId;
  }

  if (updates.themeColor !== undefined) {
    const theme = String(updates.themeColor || '').trim();
    if (!isValidThemeColor(theme)) {
      throw new AppError('Invalid theme color', 400);
    }
    updates.themeColor = theme;
  }

  if (updates.themeShade !== undefined) {
    const shade = resolveThemeShade(updates.themeShade);
    if (!isValidThemeShade(shade)) {
      throw new AppError('Invalid theme shade', 400);
    }
    updates.themeShade = shade;
  }

  if (updates.themeRotation !== undefined) {
    const normalized = normalizeThemeRotation(updates.themeRotation, {
      color: updates.themeColor || DEFAULT_THEME_COLOR,
      shade: updates.themeShade ?? DEFAULT_THEME_SHADE,
    });
    if (normalized.enabled && normalized.steps.length < 2) {
      throw new AppError('Theme rotation requires at least 2 colors in the series', 400);
    }
    updates.themeRotation = normalized;
  }

  if (updates.siteFont !== undefined) {
    const font = String(updates.siteFont || '').trim();
    if (!isValidSiteFont(font)) {
      throw new AppError('Invalid site font', 400);
    }
    updates.siteFont = font;
  }

  return updates;
};

const uploadOptionalImage = async ({ file, folder, previousPublicId }) => {
  if (!file) return null;
  try {
    if (previousPublicId) await deleteFromCloudinary(previousPublicId);
    return uploadFileToCloudinary(file, folder);
  } catch {
    throw new AppError('Image upload failed — configure Cloudinary or provide an image URL', 400);
  }
};

const serializeSettings = (settings) => (
  settings?.toObject ? settings.toObject({ flattenMaps: true }) : settings
);

/** Internal-only settings — served by GET /store-settings/admin, never to the storefront. */
const ADMIN_ONLY_SETTINGS_KEYS = ['partnerRevenue', 'driverSettings', 'adminPanel'];

export const getPublicStoreSettings = asyncHandler(async (_req, res) => {
  const settings = await getOrCreateSettings();
  const data = serializeSettings(settings);
  ADMIN_ONLY_SETTINGS_KEYS.forEach((key) => { delete data[key]; });
  if (data.liveChat) {
    const available = isLiveChatAvailableNow(data.liveChat);
    data.liveChat = {
      ...data.liveChat,
      available,
      nextAvailableAt: available ? null : getNextAvailableAt(data.liveChat),
    };
  }
  res.json({ success: true, data });
});

export const getAdminStoreSettings = asyncHandler(async (_req, res) => {
  const settings = await getOrCreateSettings();
  res.json({ success: true, data: serializeSettings(settings) });
});

export const updateAdminStoreSettings = asyncHandler(async (req, res) => {
  const settings = await getOrCreateSettings();
  const payload = parseSettingsPayload(req.body);
  const updates = pickSettings(payload);

  if (!Object.keys(updates).length) {
    throw new AppError('No settings fields to update', 400);
  }

  const previousLogoUrl = settings.logoUrl;
  const previousFaviconUrl = settings.faviconUrl;
  const previousStampPublicId = settings.invoice?.stampPublicId || '';
  const previousStampUrl = settings.invoice?.stampUrl || '';

  applySettingsUpdates(settings, updates);

  // The JSON body has no stamp fields — carry the stored stamp forward unless a
  // new file is uploaded or the form explicitly cleared it.
  if (updates.invoice !== undefined) {
    const clearedStamp = 'stampUrl' in (payload.invoice || {}) && !payload.invoice.stampUrl;
    settings.invoice.stampUrl = clearedStamp ? '' : previousStampUrl;
    settings.invoice.stampPublicId = clearedStamp ? '' : previousStampPublicId;
    settings.markModified('invoice');
  }

  const logoFile = req.files?.logo?.[0];
  const faviconFile = req.files?.favicon?.[0];

  const uploadedLogo = await uploadOptionalImage({
    file: logoFile,
    folder: CLOUDINARY_FOLDERS.store,
    previousPublicId: settings.logoPublicId,
  });
  if (uploadedLogo) {
    settings.logoUrl = uploadedLogo.url;
    settings.logoPublicId = uploadedLogo.publicId;
  } else if (updates.logoUrl !== undefined && updates.logoUrl !== previousLogoUrl && settings.logoPublicId) {
    await deleteFromCloudinary(settings.logoPublicId);
    settings.logoPublicId = '';
  }

  const uploadedFavicon = await uploadOptionalImage({
    file: faviconFile,
    folder: CLOUDINARY_FOLDERS.store,
    previousPublicId: settings.faviconPublicId,
  });
  if (uploadedFavicon) {
    settings.faviconUrl = uploadedFavicon.url;
    settings.faviconPublicId = uploadedFavicon.publicId;
  } else   if (updates.faviconUrl !== undefined && updates.faviconUrl !== previousFaviconUrl && settings.faviconPublicId) {
    await deleteFromCloudinary(settings.faviconPublicId);
    settings.faviconPublicId = '';
  }

  const invoiceStampFile = req.files?.invoiceStamp?.[0];
  const uploadedStamp = await uploadOptionalImage({
    file: invoiceStampFile,
    folder: CLOUDINARY_FOLDERS.store,
    previousPublicId: previousStampPublicId,
  });
  if (uploadedStamp) {
    settings.invoice.stampUrl = uploadedStamp.url;
    settings.invoice.stampPublicId = uploadedStamp.publicId;
    settings.markModified('invoice');
  } else if (previousStampPublicId && settings.invoice?.stampUrl === '') {
    // Stamp cleared from the form — drop the Cloudinary asset.
    await deleteFromCloudinary(previousStampPublicId);
  }

  await settings.save();
  invalidateStoreSettingsCache();
  if (updates.liveChat !== undefined) {
    promoteFromQueue().catch(() => {});
  }
  res.json({ success: true, data: serializeSettings(settings) });
});

export const previewInvoicePdf = asyncHandler(async (req, res) => {
  const settings = await getOrCreateSettings();
  const lang = req.query.lang === 'en' ? 'en' : 'ar';
  const pdf = await generateSampleInvoicePdf(settings, lang);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Length', pdf.length);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Disposition', `inline; filename="invoice-preview-${lang}.pdf"`);
  res.end(pdf);
});
