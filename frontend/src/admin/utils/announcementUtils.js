export const ANNOUNCEMENT_STYLES = [
  {
    value: 'accent',
    labelAr: 'لون مميز',
    labelEn: 'Accent',
    descAr: 'خلفية فاتحة مع حدود — مناسب للتوصيل والعروض الهادئة',
    descEn: 'Soft highlight — great for delivery & gentle promos',
    previewClass: 'border-primary-300 bg-primary-50 text-primary-900',
  },
  {
    value: 'minimal',
    labelAr: 'بسيط',
    labelEn: 'Minimal',
    descAr: 'محايد — يناسب أي صفحة',
    descEn: 'Neutral — fits any page',
    previewClass: 'border-border bg-surface-muted/60 text-text',
  },
  {
    value: 'bold',
    labelAr: 'بارز',
    labelEn: 'Bold',
    descAr: 'لون قوي — للعروض العاجلة',
    descEn: 'Strong color — for urgent offers',
    previewClass: 'border-primary-600 bg-primary-600 text-white',
  },
];

export const ANNOUNCEMENT_ICONS = ['🚚', '📢', '🏷️', '⚡', '🎁', '✨', '🔥', '💡', '🆓', '📍', '⏰', '✅'];

export const ANNOUNCEMENT_PRESETS = [
  {
    id: 'free-delivery',
    icon: '🚚',
    titleAr: 'توصيل مجاني للطلبات فوق 500 ج.م',
    titleEn: 'Free delivery on orders over EGP 500',
    ctaLabelAr: 'تسوق الآن',
    ctaLabelEn: 'Shop now',
    link: '/products',
    layout: 'accent',
  },
  {
    id: 'sale',
    icon: '🏷️',
    titleAr: 'خصومات حتى 30% — لفترة محدودة',
    titleEn: 'Up to 30% off — limited time',
    ctaLabelAr: 'تسوق العروض',
    ctaLabelEn: 'Shop offers',
    link: '/offers',
    layout: 'bold',
  },
  {
    id: 'flash',
    icon: '⚡',
    titleAr: '⚡ عرض سريع — لفترة محدودة!',
    titleEn: '⚡ Flash sale — limited time!',
    ctaLabelAr: 'تسوق الآن',
    ctaLabelEn: 'Shop now',
    link: '/offers',
    layout: 'bold',
  },
  {
    id: 'new',
    icon: '✨',
    titleAr: 'منتجات جديدة وصلت للتو',
    titleEn: 'New arrivals just landed',
    ctaLabelAr: 'اكتشف',
    ctaLabelEn: 'Discover',
    link: '/products?sort=newest',
    layout: 'minimal',
  },
];

export const EMPTY_ANNOUNCEMENT_CONFIG = {
  isEnabled: true,
  startDate: '',
  endDate: '',
  runsForever: true,
  mode: 'single',
  rotateSeconds: 6,
  dismissible: false,
  sticky: false,
};

export function dateInputValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 16);
}

export function normalizeAnnouncementConfig(config = {}) {
  const runsForever = config.runsForever !== false;
  let endDate = '';
  if (!runsForever && config.endDate) {
    const parsed = new Date(config.endDate);
    if (!Number.isNaN(parsed.getTime())) endDate = config.endDate;
  }
  return {
    isEnabled: config.isEnabled !== false,
    startDate: config.startDate || '',
    endDate,
    runsForever: runsForever && !endDate,
    mode: config.mode === 'rotate' ? 'rotate' : 'single',
    rotateSeconds: Math.min(20, Math.max(3, Number(config.rotateSeconds) || 6)),
    dismissible: !!config.dismissible,
    sticky: !!config.sticky,
  };
}

/** before | active | after | disabled */
export function getAnnouncementPhase(config, now = new Date()) {
  if (config.isEnabled === false) return 'disabled';
  const start = config.startDate ? new Date(config.startDate) : null;
  const runsForever = config.runsForever !== false;
  const end = !runsForever && config.endDate ? new Date(config.endDate) : null;
  if (start && !Number.isNaN(start.getTime()) && now < start) return 'before';
  if (end && !Number.isNaN(end.getTime()) && now > end) return 'after';
  return 'active';
}

export function isAnnouncementVisible(config, now = new Date()) {
  return getAnnouncementPhase(config, now) === 'active';
}

export function formatAnnouncementPhaseLabel(phase, isAr) {
  const map = {
    disabled: { ar: '⏸ متوقف يدوياً', en: '⏸ Paused manually' },
    before: { ar: '⏳ قبل تاريخ البداية', en: '⏳ Before start date' },
    active: { ar: '✓ يُعرض على الموقع', en: '✓ Visible on site' },
    after: { ar: '⏹ بعد تاريخ النهاية', en: '⏹ After end date' },
  };
  const row = map[phase] || map.active;
  return isAr ? row.ar : row.en;
}

export function announcementStyleMeta(layout) {
  return ANNOUNCEMENT_STYLES.find((s) => s.value === layout) || ANNOUNCEMENT_STYLES[0];
}
