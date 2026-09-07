export const DELIVERY_BOOKING_DAYS = 7;

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getDeliveryDateBounds(referenceDate = new Date()) {
  const min = startOfDay(referenceDate);
  const max = new Date(min);
  max.setDate(max.getDate() + DELIVERY_BOOKING_DAYS - 1);
  max.setHours(23, 59, 59, 999);
  return { min, max };
}

export function assertDeliveryDateInWindow(dateValue, referenceDate = new Date()) {
  if (!dateValue) {
    return { ok: false, message: 'Delivery date is required' };
  }
  const picked = startOfDay(new Date(dateValue));
  if (Number.isNaN(picked.getTime())) {
    return { ok: false, message: 'Invalid delivery date' };
  }
  const { min, max } = getDeliveryDateBounds(referenceDate);
  if (picked < min || picked > max) {
    return {
      ok: false,
      message: `Delivery date must be within the next ${DELIVERY_BOOKING_DAYS} days`,
    };
  }
  return { ok: true, date: picked };
}

export function addRecurringInterval(date, frequency) {
  const next = new Date(date);
  if (frequency === 'weekly') next.setDate(next.getDate() + 7);
  else if (frequency === 'biweekly') next.setDate(next.getDate() + 14);
  else if (frequency === 'monthly') next.setDate(next.getDate() + 30);
  else next.setDate(next.getDate() + 7);
  return next;
}

export function computeNextRecurringOccurrence({
  frequency,
  preferredWeekday,
  preferredDayOfMonth,
}, afterDate = new Date()) {
  const cursor = startOfDay(afterDate);
  for (let i = 0; i < 400; i += 1) {
    if (frequency === 'monthly') {
      if (cursor.getDate() === Number(preferredDayOfMonth)) {
        return new Date(cursor);
      }
    } else if (cursor.getDay() === Number(preferredWeekday)) {
      return new Date(cursor);
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return startOfDay(afterDate);
}

export function startOfDayDate(date) {
  return startOfDay(date);
}
