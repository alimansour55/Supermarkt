/** Delivery method labels & recurring options — keep in sync with backend enums. */

import {
  filterAvailableSlots,
  getEarliestBooking,
  getStoreDateKey,
  hasAvailableSlotsForDate,
} from '../utils/deliverySlotAvailability.js';
import { DEFAULT_SCHEDULED_LEAD_MINUTES } from '../utils/deliveryLeadTime.js';

export const DELIVERY_METHODS = {
  scheduled: {
    value: 'scheduled',
    labelAr: 'توصيل عادي',
    labelEn: 'Standard Delivery',
    descAr: 'اختر اليوم والموعد خلال الأسبوع القادم',
    descEn: 'Pick your day and time slot within the next 7 days',
    etaAr: 'خلال 4–6 ساعات من الموعد',
    etaEn: 'Within 4–6 hours of your slot',
  },
  express: {
    value: 'express',
    labelAr: 'توصيل سريع',
    labelEn: 'Express Delivery',
    descAr: 'توصيل خلال ساعتين — للطلبات العاجلة',
    descEn: 'Delivery within 2 hours — for urgent orders',
    etaAr: 'خلال ساعتين',
    etaEn: 'Within 2 hours',
  },
  recurring: {
    value: 'recurring',
    labelAr: 'توصيل دوري',
    labelEn: 'Recurring Delivery',
    descAr: 'كرّر طلبك تلقائياً — بدون إعادة الطلب في كل مرة',
    descEn: 'Repeat your order automatically — no need to checkout every time',
    etaAr: 'حسب الجدول الذي تختاره',
    etaEn: 'On your chosen schedule',
  },
};

export const RECURRING_FREQUENCIES = [
  { value: 'weekly', labelAr: 'أسبوعياً', labelEn: 'Weekly', hintAr: 'كل 7 أيام', hintEn: 'Every 7 days' },
  { value: 'biweekly', labelAr: 'كل أسبوعين', labelEn: 'Every 2 weeks', hintAr: 'كل 14 يوم', hintEn: 'Every 14 days' },
  { value: 'monthly', labelAr: 'شهرياً', labelEn: 'Monthly', hintAr: 'كل 30 يوم', hintEn: 'Every 30 days' },
];

export const DELIVERY_BOOKING_DAYS = 7;
export { DEFAULT_SCHEDULED_LEAD_MINUTES as DELIVERY_MIN_LEAD_MINUTES };

/** JavaScript getDay(): 0=Sunday … 6=Saturday */
export const WEEKDAY_AR_FULL = [
  'الأحد',
  'الاثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت',
];

export const WEEKDAY_EN_FULL = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/** Saturday-first display order (common in Egypt) */
export const WEEKDAYS_DISPLAY_ORDER = [
  { index: 6, labelAr: 'السبت', labelEn: 'Saturday' },
  { index: 0, labelAr: 'الأحد', labelEn: 'Sunday' },
  { index: 1, labelAr: 'الاثنين', labelEn: 'Monday' },
  { index: 2, labelAr: 'الثلاثاء', labelEn: 'Tuesday' },
  { index: 3, labelAr: 'الأربعاء', labelEn: 'Wednesday' },
  { index: 4, labelAr: 'الخميس', labelEn: 'Thursday' },
  { index: 5, labelAr: 'الجمعة', labelEn: 'Friday' },
];

export function getWeekdayLabel(weekdayIndex, isAr = true) {
  const list = isAr ? WEEKDAY_AR_FULL : WEEKDAY_EN_FULL;
  return list[weekdayIndex] || '';
}

export function computeFirstRecurringDeliveryDate({
  frequency,
  preferredWeekday,
  preferredDayOfMonth,
  slotFrom,
}, referenceDate = new Date(), timeSlots = [], minLeadMinutes = DEFAULT_SCHEDULED_LEAD_MINUTES) {
  const { min, max } = getDeliveryDateBounds(referenceDate);
  const cursor = new Date(min);

  while (cursor <= max) {
    const value = getStoreDateKey(cursor);
    const matchesPattern = frequency === 'monthly'
      ? new Date(`${value}T12:00:00+02:00`).getDate() === Number(preferredDayOfMonth)
      : new Date(`${value}T12:00:00+02:00`).getDay() === Number(preferredWeekday);

    if (matchesPattern) {
      if (!timeSlots.length) return value;
      const available = filterAvailableSlots(timeSlots, value, referenceDate, minLeadMinutes);
      const matching = slotFrom
        ? available.find((slot) => slot.from === slotFrom)
        : available[0];
      if (matching) return value;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  const fallback = getEarliestBooking({ slots: timeSlots, referenceDate, minLeadMinutes });
  if (fallback) return fallback.date;
  return getStoreDateKey(min);
}

export function buildRecurringScheduleSummary({
  frequency,
  preferredWeekday,
  preferredDayOfMonth,
  timeSlotLabelAr,
  timeSlotLabelEn,
}, isAr = true) {
  const slot = isAr ? timeSlotLabelAr : timeSlotLabelEn;
  const slotSuffix = slot ? ` — ${slot}` : '';

  if (frequency === 'monthly') {
    const day = preferredDayOfMonth || 1;
    return isAr
      ? `كل شهر يوم ${day}${slotSuffix}`
      : `Monthly on day ${day}${slotSuffix}`;
  }

  const dayName = getWeekdayLabel(Number(preferredWeekday), isAr);
  if (frequency === 'biweekly') {
    return isAr
      ? `كل أسبوعين يوم ${dayName}${slotSuffix}`
      : `Every 2 weeks on ${dayName}${slotSuffix}`;
  }

  return isAr
    ? `كل أسبوع يوم ${dayName}${slotSuffix}`
    : `Every week on ${dayName}${slotSuffix}`;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getDeliveryDateBounds(referenceDate = new Date()) {
  const min = startOfDay(referenceDate);
  const max = new Date(min);
  max.setDate(max.getDate() + DELIVERY_BOOKING_DAYS - 1);
  return { min, max };
}

export function toDateInputValue(date) {
  const d = startOfDay(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isDateWithinBookingWindow(dateStr, referenceDate = new Date()) {
  if (!dateStr) return false;
  const { min, max } = getDeliveryDateBounds(referenceDate);
  const picked = startOfDay(new Date(`${dateStr}T12:00:00`));
  return picked >= min && picked <= max;
}

export function buildDeliveryWeekDays(
  referenceDate = new Date(),
  visibleDays = 14,
  timeSlots = [],
  minLeadMinutes = DEFAULT_SCHEDULED_LEAD_MINUTES,
) {
  const { min, max } = getDeliveryDateBounds(referenceDate);
  const days = [];
  const cursor = new Date(min);
  const todayKey = getStoreDateKey(referenceDate);

  for (let i = 0; i < visibleDays; i += 1) {
    const value = getStoreDateKey(cursor);
    const inWindow = cursor >= min && cursor <= max;
    const hasSlots = !timeSlots.length || hasAvailableSlotsForDate(timeSlots, value, referenceDate, minLeadMinutes);
    days.push({
      value,
      date: new Date(cursor),
      selectable: inWindow && hasSlots,
      isToday: value === todayKey,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export function getDeliveryMethodLabel(method, isAr) {
  const entry = DELIVERY_METHODS[method];
  if (!entry) return method;
  return isAr ? entry.labelAr : entry.labelEn;
}

export function getRecurringFrequencyLabel(frequency, isAr) {
  const entry = RECURRING_FREQUENCIES.find((f) => f.value === frequency);
  if (!entry) return frequency;
  return isAr ? entry.labelAr : entry.labelEn;
}

export function defaultBookingDate(referenceDate = new Date(), timeSlots = [], minLeadMinutes = DEFAULT_SCHEDULED_LEAD_MINUTES) {
  const earliest = getEarliestBooking({ slots: timeSlots, referenceDate, minLeadMinutes });
  if (earliest) return earliest.date;
  return getStoreDateKey(getDeliveryDateBounds(referenceDate).min);
}
