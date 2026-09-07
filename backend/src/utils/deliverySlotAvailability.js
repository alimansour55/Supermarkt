import { DELIVERY_BOOKING_DAYS, getDeliveryDateBounds, startOfDayDate } from './deliveryDate.js';
import { getStoreDateKey, STORE_TIMEZONE } from './storeDate.js';
import { DEFAULT_SCHEDULED_LEAD_MINUTES } from './deliveryLeadTime.js';

export { STORE_TIMEZONE };
export { DEFAULT_SCHEDULED_LEAD_MINUTES as DELIVERY_MIN_LEAD_MINUTES };

function normalizeTime(timeStr) {
  const [hours = '0', minutes = '0'] = String(timeStr || '00:00').trim().split(':');
  return `${String(Number(hours)).padStart(2, '0')}:${String(Number(minutes)).padStart(2, '0')}`;
}

/** Slot start in store timezone (Egypt +02:00). */
export function buildSlotDateTime(dateKey, fromTime) {
  return new Date(`${dateKey}T${normalizeTime(fromTime)}:00+02:00`);
}

/** Slot end — `00:00` means midnight at the end of the same calendar day. */
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

/**
 * A slot is available when the delivery window [from, to) still has time
 * after the earliest deliverable moment (now + lead time).
 */
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
  bookingDays = DELIVERY_BOOKING_DAYS,
  minLeadMinutes = DEFAULT_SCHEDULED_LEAD_MINUTES,
}) {
  const activeSlots = (slots || []).filter(isActiveSlot);
  if (!activeSlots.length) return null;

  const { min, max } = getDeliveryDateBounds(referenceDate);
  const cursor = startOfDayDate(min);

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

export function assertDeliverySlotAvailable({
  scheduledDate,
  slot,
  slots,
  referenceDate = new Date(),
  minLeadMinutes = DEFAULT_SCHEDULED_LEAD_MINUTES,
  lang = 'en',
}) {
  const isAr = lang === 'ar';

  if (!slot) {
    return {
      ok: false,
      message: isAr ? 'يرجى اختيار موعد توصيل' : 'Delivery time slot is required',
    };
  }

  const dateKey = getStoreDateKey(new Date(scheduledDate));
  const inZone = (slots || []).some((entry) => String(entry._id) === String(slot._id));
  if (!inZone) {
    return {
      ok: false,
      message: isAr
        ? 'موعد التوصيل المختار غير متاح في منطقتك'
        : 'Selected delivery time slot is not available in this area',
    };
  }

  if (!isSlotAvailableForDate({ dateStr: dateKey, slot, referenceDate, minLeadMinutes })) {
    const label = formatLeadMinutesLabel(minLeadMinutes, lang);
    return {
      ok: false,
      message: isAr
        ? `يجب أن يكون موعد التوصيل بعد ${label} على الأقل من الآن`
        : `Delivery time must be at least ${label} from now`,
    };
  }

  return { ok: true, dateKey };
}

function formatLeadMinutesLabel(minutes, lang) {
  const m = Math.max(0, Math.round(Number(minutes) || 0));
  if (m % 60 === 0) {
    const hours = m / 60;
    return lang === 'ar' ? `${hours} ساعات` : `${hours} hour${hours === 1 ? '' : 's'}`;
  }
  return lang === 'ar' ? `${m} دقيقة` : `${m} min`;
}
