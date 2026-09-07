export const STORE_TIMEZONE = process.env.STORE_TIMEZONE || 'Africa/Cairo';

export function getStoreDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: STORE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function endOfStoreDay(dateInput) {
  const key = getStoreDateKey(dateInput instanceof Date ? dateInput : new Date(dateInput));
  return new Date(`${key}T23:59:59.999+02:00`);
}

export function startOfStoreDay(dateInput) {
  const key = getStoreDateKey(dateInput instanceof Date ? dateInput : new Date(dateInput));
  return new Date(`${key}T00:00:00.000+02:00`);
}

/** Append store UTC offset to wall-clock datetime (matches frontend storeSchedule). */
export function storeWallClockIso(dateStr, timeStr = '00:00') {
  const [hh, mm] = String(timeStr || '00:00').trim().split(':');
  return `${dateStr}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00+02:00`;
}

/** Parse admin schedule — date-only snaps to day boundary; datetime is store wall clock. */
export function parsePromotionScheduleInstant(value, boundary = 'start') {
  if (value == null || value === '') return null;
  const raw = String(value).trim();
  if (!raw) return null;

  if (/T\d{1,2}:\d{2}/.test(raw)) {
    const withSeconds = raw.length === 16 ? `${raw}:00` : raw;
    const withTz = /([zZ]|[+-]\d{2}:\d{2})$/.test(withSeconds) ? withSeconds : `${withSeconds}+02:00`;
    const d = new Date(withTz);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  return boundary === 'end' ? endOfStoreDay(raw) : startOfStoreDay(raw);
}
