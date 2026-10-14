/**
 * Pure helpers for the Banners admin: plain-language labels, live status,
 * health warnings and store-time (Africa/Cairo) schedule fields.
 */
import { splitStoreScheduleField } from '../../utils/storeSchedule.js';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const BANNER_PLACEMENTS = [
  {
    value: 'hero',
    labelAr: 'السلايدر الرئيسي',
    labelEn: 'Main slider',
    descAr: 'البانر الكبير أعلى الصفحة الرئيسية.',
    descEn: 'The big banner at the top of the homepage.',
    sizeDesktop: { w: 1600, h: 490 },
    sizeMobile: { w: 800, h: 400 },
    previewAspect: 'aspect-[3.3/1]',
    previewAspectMobile: 'aspect-[2/1]',
  },
  {
    value: 'promo',
    labelAr: 'بطاقات العروض',
    labelEn: 'Offer tiles',
    descAr: 'بطاقات العروض في الصفحة الرئيسية وصفحة العروض.',
    descEn: 'Offer cards on the homepage and the Offers page.',
    sizeDesktop: { w: 800, h: 320 },
    sizeMobile: { w: 800, h: 320 },
    previewAspect: 'aspect-[2.5/1]',
    previewAspectMobile: 'aspect-[2.5/1]',
  },
  {
    value: 'sidebar',
    labelAr: 'بانرات صغيرة',
    labelEn: 'Small banners',
    descAr: 'صف بانرات صغيرة يمكن تمريرها في الصفحة الرئيسية.',
    descEn: 'A scrolling row of small banners on the homepage.',
    sizeDesktop: { w: 520, h: 320 },
    sizeMobile: { w: 520, h: 320 },
    previewAspect: 'aspect-[1.6/1]',
    previewAspectMobile: 'aspect-[1.6/1]',
  },
];

export const BANNER_AUDIENCES = [
  { value: 'all', labelAr: 'الجميع', labelEn: 'Everyone', descAr: 'كل الزوار', descEn: 'All visitors' },
  { value: 'guests', labelAr: 'الزوار الجدد', labelEn: 'Visitors not signed in', descAr: 'لم يسجّلوا الدخول', descEn: 'Not signed in' },
  { value: 'customers', labelAr: 'العملاء المسجّلون', labelEn: 'Signed-in customers', descAr: 'سجّلوا الدخول', descEn: 'Signed in' },
];

export const STATUS_META = {
  live: { labelAr: 'يظهر الآن', labelEn: 'Live', className: 'bg-green-100 text-green-800', dot: 'bg-green-500' },
  scheduled: { labelAr: 'مجدول', labelEn: 'Scheduled', className: 'bg-blue-100 text-blue-800', dot: 'bg-blue-500' },
  paused: { labelAr: 'متوقف', labelEn: 'Paused', className: 'bg-slate-200 text-slate-700', dot: 'bg-slate-400' },
  ended: { labelAr: 'انتهى', labelEn: 'Ended', className: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500' },
};

const SECTION_TYPE_NAMES = {
  hero_slider: { ar: 'السلايدر الرئيسي', en: 'Main slider' },
  promo_grid: { ar: 'شبكة العروض', en: 'Offer grid' },
  image_strip: { ar: 'شريط الصور', en: 'Image strip' },
  sidebar_banners: { ar: 'صف البانرات الصغيرة', en: 'Small banner row' },
};

/** Homepage section name for messages — its title, or a plain name for its type. */
export function sectionName(section, isAr) {
  const title = isAr ? section?.titleAr || section?.titleEn : section?.titleEn || section?.titleAr;
  if (title) return title;
  const type = SECTION_TYPE_NAMES[section?.type];
  return type ? (isAr ? type.ar : type.en) : (isAr ? 'قسم في الصفحة الرئيسية' : 'Homepage section');
}

export function placementMeta(value) {
  return BANNER_PLACEMENTS.find((p) => p.value === value) || BANNER_PLACEMENTS[0];
}

export function audienceMeta(value) {
  return BANNER_AUDIENCES.find((a) => a.value === value)
    || (value === 'staff'
      ? { value: 'staff', labelAr: 'الموظفون فقط', labelEn: 'Staff only' }
      : BANNER_AUDIENCES[0]);
}

export function bannerId(banner) {
  return banner?._id || banner?.id || null;
}

const toTime = (value) => {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
};

/** live | scheduled | paused | ended, plus the next moment the status changes. */
export function bannerStatus(banner, now = Date.now()) {
  const start = toTime(banner?.startsAt);
  const end = toTime(banner?.endsAt);
  if (end !== null && end < now) return { key: 'ended', at: end };
  if (!banner?.isActive) return { key: 'paused', at: null };
  if (start !== null && start > now) return { key: 'scheduled', at: start };
  return { key: 'live', at: end };
}

/** "in 3 days" / "2 hours ago" in the admin's language. */
export function relativeTime(at, isAr, now = Date.now()) {
  if (at === null || at === undefined) return '';
  const diff = at - now;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(isAr ? 'ar-EG' : 'en', { numeric: 'auto' });
  if (abs < HOUR) return rtf.format(Math.round(diff / 60000), 'minute');
  if (abs < DAY) return rtf.format(Math.round(diff / HOUR), 'hour');
  return rtf.format(Math.round(diff / DAY), 'day');
}

/** One line under the status chip, e.g. "Ends in 2 days". */
export function statusDetail(banner, isAr, now = Date.now()) {
  const status = bannerStatus(banner, now);
  const when = relativeTime(status.at, isAr, now);
  if (status.key === 'scheduled') return isAr ? `يبدأ ${when}` : `Starts ${when}`;
  if (status.key === 'ended') return isAr ? `انتهى ${when}` : `Ended ${when}`;
  if (status.key === 'live') return status.at ? (isAr ? `ينتهي ${when}` : `Ends ${when}`) : (isAr ? 'بدون تاريخ انتهاء' : 'No end date');
  return isAr ? 'لن يظهر حتى تشغّله' : 'Hidden until you turn it on';
}

/** Same order the storefront uses. */
export function sortBanners(list) {
  return [...list].sort((a, b) => (
    (Number(b.priority) || 0) - (Number(a.priority) || 0)
    || (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0)
    || (toTime(b.createdAt) || 0) - (toTime(a.createdAt) || 0)
  ));
}

export function groupByPlacement(list) {
  const groups = Object.fromEntries(BANNER_PLACEMENTS.map((p) => [p.value, []]));
  for (const banner of sortBanners(list)) {
    (groups[banner.placement] || groups.hero).push(banner);
  }
  return groups;
}

export function countByStatus(list, now = Date.now()) {
  const counts = { live: 0, scheduled: 0, paused: 0, ended: 0 };
  for (const banner of list) counts[bannerStatus(banner, now).key] += 1;
  return counts;
}

const ARABIC = /[؀-ۿ]/;
const LATIN = /[A-Za-z]/;

/**
 * Things worth fixing on a banner. `placementSections` says which homepage
 * sections show each placement automatically (from the admin API).
 */
export function bannerWarnings(banner, { placementSections = null, brokenImage = false, now = Date.now() } = {}) {
  const warnings = [];
  const image = banner.desktopImage || banner.image || banner.mobileImage;
  if (!image || brokenImage) warnings.push('image');
  if (banner.placement === 'hero' && !banner.mobileImage) warnings.push('mobile');
  if (banner.titleAr && !ARABIC.test(banner.titleAr)) warnings.push('arabicTitle');
  if (banner.titleEn && !LATIN.test(banner.titleEn)) warnings.push('englishTitle');
  const status = bannerStatus(banner, now);
  if (status.key === 'live' && status.at && status.at - now < 2 * DAY) warnings.push('endingSoon');
  if (
    placementSections
    && banner.placement !== 'promo' // promo also always shows on the Offers page
    && !(banner.usedIn || []).length
    && !(placementSections[banner.placement] || []).some((s) => s.isActive)
  ) {
    warnings.push('notShown');
  }
  return warnings;
}

export const WARNING_TEXT = {
  image: { ar: 'الصورة لا تعمل', en: 'Image is broken or missing' },
  mobile: { ar: 'لا توجد صورة للموبايل — ستُقص صورة الكمبيوتر', en: 'No phone image — the desktop image gets cropped' },
  arabicTitle: { ar: 'العنوان العربي مكتوب بالإنجليزية', en: 'Arabic title has no Arabic text' },
  englishTitle: { ar: 'العنوان الإنجليزي مكتوب بالعربية', en: 'English title has no English text' },
  endingSoon: { ar: 'ينتهي خلال يومين', en: 'Ends within 2 days' },
  notShown: { ar: 'لا يوجد قسم في الصفحة الرئيسية يعرض هذا المكان', en: 'No homepage section shows this placement' },
};

/** Value for a datetime-local input, in store time (Cairo), from an ISO instant. */
export function toStoreInput(value) {
  if (!value) return '';
  const { date, time } = splitStoreScheduleField(value);
  return date ? `${date}T${time}` : '';
}

function cairoOffsetAt(date) {
  const label = new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Cairo', timeZoneName: 'longOffset' })
    .formatToParts(date)
    .find((p) => p.type === 'timeZoneName')?.value || 'GMT+02:00';
  return label.match(/GMT([+-]\d{2}:\d{2})/)?.[1] || '+02:00';
}

/** Instant for a store-time input value (Cairo has DST, so the offset is looked up). */
export function storeInputToDate(value) {
  if (!value) return null;
  const guess = new Date(`${value}:00+02:00`);
  if (Number.isNaN(guess.getTime())) return null;
  return new Date(`${value}:00${cairoOffsetAt(guess)}`);
}

/** Store-time input value `days` (or months) from now. */
export function storeInputFromNow({ days = 0, months = 0 } = {}, now = new Date()) {
  const d = new Date(now.getTime());
  if (months) d.setMonth(d.getMonth() + months);
  if (days) d.setTime(d.getTime() + days * DAY);
  return toStoreInput(d.toISOString());
}

/** The editable fields of a banner, as the form holds them. */
export function bannerToForm(banner = {}) {
  return {
    titleAr: banner.titleAr || '',
    titleEn: banner.titleEn || '',
    subtitleAr: banner.subtitleAr || '',
    subtitleEn: banner.subtitleEn || '',
    ctaAr: banner.ctaAr || 'تسوق الآن',
    ctaEn: banner.ctaEn || 'Shop Now',
    link: banner.link || '/offers',
    placement: banner.placement || 'hero',
    targetAudience: banner.targetAudience || 'all',
    startsAt: toStoreInput(banner.startsAt),
    endsAt: toStoreInput(banner.endsAt),
    isActive: banner.isActive !== false,
    showText: banner.showText !== false,
    desktopImage: banner.desktopImage || banner.image || '',
    mobileImage: banner.mobileImage || '',
  };
}

/** Problems that block saving, as message keys. */
export function validateBannerForm(form, files = {}) {
  const errors = [];
  if (!form.titleAr.trim() && !form.titleEn.trim()) errors.push('title');
  if (!form.desktopImage && !form.mobileImage && !files.desktopImage && !files.mobileImage) errors.push('image');
  if (form.startsAt && form.endsAt && form.startsAt > form.endsAt) errors.push('dates');
  return errors;
}

export function formIsDirty(form, initial, files = {}) {
  if (files.desktopImage || files.mobileImage) return true;
  return Object.keys(initial).some((k) => String(form[k] ?? '') !== String(initial[k] ?? ''));
}
