/** Store schedule helpers — all promotion times are Africa/Cairo wall clock. */
export const STORE_TIMEZONE = 'Africa/Cairo';
export const STORE_UTC_OFFSET = '+02:00';

function pad2(n) {
  return String(n).padStart(2, '0');
}

export function normalizeScheduleTime(timeStr) {
  const [hours = '0', minutes = '0'] = String(timeStr || '00:00').trim().split(':');
  return `${pad2(Number(hours))}:${pad2(Number(minutes))}`;
}

/** Parse YYYY-MM-DD + HH:mm as store wall clock → UTC instant. */
export function parseStoreSchedule(dateStr, timeStr = '00:00') {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T${normalizeScheduleTime(timeStr)}:00${STORE_UTC_OFFSET}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Split ISO instant into store date + time (matches admin list & editor). */
export function splitStoreScheduleField(iso) {
  if (!iso) return { date: '', time: '' };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: '', time: '' };

  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: STORE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: STORE_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);

  const hh = pad2(Number(parts.find((p) => p.type === 'hour')?.value ?? 0));
  const mm = pad2(Number(parts.find((p) => p.type === 'minute')?.value ?? 0));
  return { date, time: `${hh}:${mm}` };
}

export function nowStoreSchedule() {
  return splitStoreScheduleField(new Date().toISOString());
}

export function storeScheduleTimestamp(date, time = '00:00') {
  return parseStoreSchedule(date, time)?.getTime() ?? 0;
}

export function endOfStoreDay(dateInput = new Date()) {
  const key = new Intl.DateTimeFormat('en-CA', {
    timeZone: STORE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(dateInput instanceof Date ? dateInput : new Date(dateInput));
  return new Date(`${key}T23:59:59.999${STORE_UTC_OFFSET}`);
}

export function combineScheduleField(date, time) {
  if (!date) return null;
  if (time) return `${date}T${normalizeScheduleTime(time)}`;
  return date;
}
