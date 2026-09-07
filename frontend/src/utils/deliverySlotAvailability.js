import {
  getDeliveryDateBounds,
} from '../constants/deliveryOptions';
import { DEFAULT_SCHEDULED_LEAD_MINUTES } from './deliveryLeadTime.js';

export const STORE_TIMEZONE = 'Africa/Cairo';
export { DEFAULT_SCHEDULED_LEAD_MINUTES as DELIVERY_MIN_LEAD_MINUTES };

export function getStoreDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: STORE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function normalizeTime(timeStr) {
  const [hours = '0', minutes = '0'] = String(timeStr || '00:00').trim().split(':');
  return `${String(Number(hours)).padStart(2, '0')}:${String(Number(minutes)).padStart(2, '0')}`;
}

export function buildSlotDateTime(dateKey, fromTime) {
  return new Date(`${dateKey}T${normalizeTime(fromTime)}:00+02:00`);
}

export function buildSlotEndDateTime(dateKey, toTime) {
  const normalized = normalizeTime(toTime);
  if (normalized === '00:00') {
    const nextDay = new Date(`${dateKey}T00:00:00+02:00`);
    nextDay.setDate(nextDay.getDate() + 1);
    return nextDay;
  }
  return buildSlotDateTime(dateKey, toTime);
}

export function getMinBookingDateTime(referenceDate = new Date(), minLeadMinutes = DEFAULT_SCHEDULED_LEAD_MINUTES) {
  return new Date(referenceDate.getTime() + minLeadMinutes * 60 * 1000);
}

export function isActiveSlot(slot) {
  return Boolean(slot) && slot.isActive !== false;
}

export function isSlotAvailableForDate({
  dateStr,
  slot,
  referenceDate = new Date(),
  minLeadMinutes = DEFAULT_SCHEDULED_LEAD_MINUTES,
}) {
  if (!isActiveSlot(slot) || !dateStr) return false;

  const slotStart = buildSlotDateTime(dateStr, slot.from);
  const slotEnd = buildSlotEndDateTime(dateStr, slot.to || slot.from);
  const minBooking = getMinBookingDateTime(referenceDate, minLeadMinutes);

  if (slotEnd <= slotStart) return false;
  return slotEnd > minBooking;
}

export function getEffectiveSlotStart({
  dateStr,
  slot,
  referenceDate = new Date(),
  minLeadMinutes = DEFAULT_SCHEDULED_LEAD_MINUTES,
}) {
  const slotStart = buildSlotDateTime(dateStr, slot.from);
  const minBooking = getMinBookingDateTime(referenceDate, minLeadMinutes);
  return slotStart > minBooking ? slotStart : minBooking;
}

export function filterAvailableSlots(
  slots,
  dateStr,
  referenceDate = new Date(),
  minLeadMinutes = DEFAULT_SCHEDULED_LEAD_MINUTES,
) {
  return (slots || []).filter((slot) => isSlotAvailableForDate({
    dateStr,
    slot,
    referenceDate,
    minLeadMinutes,
  }));
}

export function hasAvailableSlotsForDate(
  slots,
  dateStr,
  referenceDate = new Date(),
  minLeadMinutes = DEFAULT_SCHEDULED_LEAD_MINUTES,
) {
  return filterAvailableSlots(slots, dateStr, referenceDate, minLeadMinutes).length > 0;
}

export function isExpressAvailableNow({
  slots = [],
  referenceDate = new Date(),
  minLeadMinutes = DEFAULT_SCHEDULED_LEAD_MINUTES,
}) {
  const today = getStoreDateKey(referenceDate);
  const activeSlots = (slots || []).filter(isActiveSlot);
  if (!activeSlots.length) return true;
  return hasAvailableSlotsForDate(activeSlots, today, referenceDate, minLeadMinutes);
}

export function getEarliestBooking({
  slots,
  referenceDate = new Date(),
  minLeadMinutes = DEFAULT_SCHEDULED_LEAD_MINUTES,
}) {
  const activeSlots = (slots || []).filter(isActiveSlot);
  if (!activeSlots.length) return null;

  const { min, max } = getDeliveryDateBounds(referenceDate);
  const cursor = new Date(min);

  while (cursor <= max) {
    const dateStr = getStoreDateKey(cursor);
    const available = filterAvailableSlots(activeSlots, dateStr, referenceDate, minLeadMinutes);
    if (available.length) {
      return { date: dateStr, slot: available[0], slots: available };
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return null;
}

export function resolveSelectedSlot(timeSlots, scheduledTime, dateStr, referenceDate = new Date(), minLeadMinutes = DEFAULT_SCHEDULED_LEAD_MINUTES) {
  const available = filterAvailableSlots(timeSlots, dateStr, referenceDate, minLeadMinutes);
  return available.find((slot) => String(slot._id) === String(scheduledTime)) || available[0] || null;
}

export function slotAvailabilityError(lang = 'ar', minLeadMinutes = DEFAULT_SCHEDULED_LEAD_MINUTES) {
  const label = formatLeadMinutesLabel(minLeadMinutes, lang);
  return lang === 'ar'
    ? `يجب أن يكون موعد التوصيل بعد ${label} على الأقل من الآن`
    : `Delivery time must be at least ${label} from now`;
}

function formatLeadMinutesLabel(minutes, lang) {
  const m = Math.max(0, Math.round(Number(minutes) || 0));
  if (m % 60 === 0) {
    const hours = m / 60;
    return lang === 'ar' ? `${hours} ساعات` : `${hours} hour${hours === 1 ? '' : 's'}`;
  }
  return lang === 'ar' ? `${m} دقيقة` : `${m} min`;
}
