import { endOfStoreDay } from './storeSchedule';
import { normalizeTileColumns } from './tileGridShared';

export const DEAL_STYLES = [
  {
    value: 'standard',
    labelAr: 'عروض يومية',
    labelEn: 'Daily deals',
    icon: '🔥',
    hintAr: 'عنوان + عدّاد — مناسب لعروض اليوم',
    hintEn: 'Title + countdown — ideal for daily deals',
  },
  {
    value: 'flash',
    labelAr: 'عرض سريع',
    labelEn: 'Flash sale',
    icon: '⚡',
    hintAr: 'شريط بارز + عدّاد كبير',
    hintEn: 'Bold banner + large countdown',
  },
  {
    value: 'minimal',
    labelAr: 'بسيط',
    labelEn: 'Minimal',
    icon: '🏷️',
    hintAr: 'منتجات مخفّضة بدون عدّاد',
    hintEn: 'On-sale products without countdown',
  },
];

export const DEAL_LAYOUTS = [
  { value: 'scroll', labelAr: 'شريط أفقي', labelEn: 'Horizontal scroll', hintAr: 'تمرير أفقي — بطاقات منتجات كاملة', hintEn: 'Horizontal scroll — full compact cards' },
  { value: 'grid', labelAr: 'شبكة', labelEn: 'Grid', hintAr: 'بطاقات منتجات عادية في أعمدة', hintEn: 'Normal product cards in columns' },
];

export const COUNTDOWN_MODES = [
  {
    value: 'end_of_day',
    labelAr: 'حتى نهاية اليوم',
    labelEn: 'Until end of today',
    hintAr: 'ينتهي عند منتصف الليل',
    hintEn: 'Ends at midnight',
  },
  {
    value: 'duration',
    labelAr: 'مدة محددة (ساعات)',
    labelEn: 'Fixed duration (hours)',
    hintAr: 'عدّاد من الآن — مثالي للعروض السريعة',
    hintEn: 'Countdown from now — great for flash sales',
  },
  {
    value: 'custom',
    labelAr: 'تاريخ ووقت مخصص',
    labelEn: 'Custom date & time',
    hintAr: 'حدد متى ينتهي العرض بالضبط',
    hintEn: 'Pick exact end date and time',
  },
  {
    value: 'promotion',
    labelAr: 'من الحملة المرتبطة',
    labelEn: 'From linked campaign',
    hintAr: 'ينتهي تلقائياً مع حملة العروض',
    hintEn: 'Ends when the linked campaign ends',
  },
];

export const DEAL_CAMPAIGN_MODES = [
  {
    value: 'linked',
    labelAr: 'حملة موجودة',
    labelEn: 'Existing campaign',
    hintAr: 'اختر عرضاً محدوداً من «العروض والتخفيضات»',
    hintEn: 'Pick a limited-time campaign from Offers & promotions',
    icon: '🔗',
  },
  {
    value: 'standalone',
    labelAr: 'إعداد يدوي',
    labelEn: 'Manual setup',
    hintAr: 'يُنشئ حملة محدودة تلقائياً عند الحفظ',
    hintEn: 'Creates a limited-time campaign when you save',
    icon: '✏️',
  },
];

export const DEFAULT_DEAL_CONFIG = {
  style: 'standard',
  campaignMode: 'standalone',
  discountPercent: 15,
  showCountdown: true,
  countdownMode: 'end_of_day',
  countdownEnd: '',
  countdownDurationHours: 6,
  layout: 'scroll',
  columns: 4,
  showSubtitle: true,
  showViewAll: true,
};

export const TODAYS_DEALS_PATH = '/today-deals';

const LEGACY_DEAL_VIEW_ALL_LINKS = new Set([
  '/offers',
  '/offers?offers=true&sort=discount',
  '/products?section=daily-offers&sort=discount',
]);

export function isDealSectionType(type) {
  return ['daily_offers', 'flash_sale'].includes(type);
}

export function resolveDealViewAllLink(section) {
  const link = String(section?.link || '').trim();
  if (link && !LEGACY_DEAL_VIEW_ALL_LINKS.has(link)) return link;
  return isDealSectionType(section?.type) ? TODAYS_DEALS_PATH : (link || null);
}

export function normalizeDealConfig(config = {}, section = {}) {
  const style = DEAL_STYLES.some((s) => s.value === config.style)
    ? config.style
    : (section.type === 'flash_sale' ? 'flash' : 'standard');

  const layoutRaw = config.layout || section.layout || 'scroll';
  const campaignMode = DEAL_CAMPAIGN_MODES.some((m) => m.value === config.campaignMode)
    ? config.campaignMode
    : (section.promotionId ? 'linked' : 'standalone');

  let countdownMode = COUNTDOWN_MODES.some((m) => m.value === config.countdownMode)
    ? config.countdownMode
    : 'end_of_day';
  if (campaignMode === 'linked') countdownMode = 'promotion';

  const minimal = style === 'minimal';

  return {
    ...DEFAULT_DEAL_CONFIG,
    ...config,
    style,
    campaignMode,
    discountPercent: Math.min(99, Math.max(1, Number(config.discountPercent) || 15)),
    showCountdown: minimal ? false : config.showCountdown !== false,
    countdownMode: minimal ? 'end_of_day' : countdownMode,
    countdownEnd: String(config.countdownEnd || ''),
    countdownDurationHours: Math.min(72, Math.max(1, Number(config.countdownDurationHours) || 6)),
    layout: layoutRaw === 'grid' ? 'grid' : 'scroll',
    columns: normalizeTileColumns(config.columns, 6),
    showSubtitle: config.showSubtitle !== false,
    showViewAll: config.showViewAll !== false,
  };
}

export function resolveDealCountdownEnd(section) {
  const config = normalizeDealConfig(section?.dealConfig || {}, section);
  if (!config.showCountdown || !isDealSectionType(section?.type)) return null;

  const parseEnd = (value) => {
    if (!value) return null;
    const end = new Date(value);
    if (Number.isNaN(end.getTime()) || end.getTime() <= Date.now()) return null;
    return end;
  };

  // Authoritative end from API (matches saved campaign schedule)
  const serverEnd = parseEnd(section?.dealCountdownEnd);
  if (serverEnd) return serverEnd;

  const isLinked = config.campaignMode === 'linked' || config.countdownMode === 'promotion';

  if (isLinked) {
    return parseEnd(section?.linkedPromotion?.endsAt || section?.promotion?.endsAt);
  }

  if (section?.promotionId) {
    const syncedEnd = parseEnd(section?.linkedPromotion?.endsAt);
    if (syncedEnd) return syncedEnd;
  }

  if (config.countdownMode === 'custom' && config.countdownEnd) {
    return parseEnd(config.countdownEnd);
  }

  if (config.countdownMode === 'duration') {
    return parseEnd(section?.linkedPromotion?.endsAt)
      || new Date(Date.now() + config.countdownDurationHours * 3600000);
  }

  if (config.countdownMode === 'end_of_day') {
    return parseEnd(section?.linkedPromotion?.endsAt) || endOfStoreDay();
  }

  return parseEnd(section?.dealsMeta?.countdownEnd);
}

export function dealSectionShowsCountdown(section) {
  return resolveDealCountdownEnd(section) !== null;
}

export function resolveDealProductLayout(section) {
  const config = normalizeDealConfig(section?.dealConfig || {}, section);
  return {
    layout: config.layout === 'grid' ? 'grid' : 'scroll',
    columns: config.columns,
    showViewAll: config.showViewAll,
  };
}

export function resolveProductShowcaseLayout(section) {
  const config = section?.productShowcaseConfig || {};
  const layoutRaw = config.layout || section?.layout || 'scroll';
  return {
    layout: layoutRaw === 'grid' ? 'grid' : 'scroll',
    columns: normalizeTileColumns(config.columns, 6),
    showViewAll: config.showViewAll !== false,
  };
}

export function productSectionLayout(section) {
  if (isDealSectionType(section?.type)) {
    return resolveDealProductLayout(section);
  }
  if (['product_grid', 'product_carousel', 'top_rated'].includes(section?.type)) {
    return resolveProductShowcaseLayout(section);
  }
  const layout = section?.layout || 'scroll';
  return { layout: layout === 'grid' ? 'grid' : 'scroll', columns: 4, showViewAll: true };
}

/** @deprecated use productSectionLayout().layout === 'scroll' */
export function productSectionCompact(section) {
  return productSectionLayout(section).layout === 'scroll';
}

export function gridClassForColumns(columns = 4, compact = false) {
  if (compact) return '';
  const map = {
    2: 'grid-cols-2',
    3: 'grid-cols-2 sm:grid-cols-3',
    4: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
  };
  return map[columns] || map[4];
}
