export const STORE_TIMEZONE = process.env.STORE_TIMEZONE || 'Africa/Cairo';

export const REVENUE_EXCLUDED_STATUSES = ['cancelled', 'returned'];
export const MAX_REVENUE_RANGE_DAYS = 3650; // ~10 years

export function revenueOrderMatch(extra = {}) {
  return {
    orderStatus: { $nin: REVENUE_EXCLUDED_STATUSES },
    ...extra,
  };
}

export function getStoreDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: STORE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function addDaysToStoreDateKey(dateKey, days) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const utc = Date.UTC(y, m - 1, d + days);
  return getStoreDateKey(new Date(utc));
}

export function startOfStoreDay(date = new Date()) {
  const key = getStoreDateKey(date);
  return new Date(`${key}T00:00:00+02:00`);
}

export function daysBetween(startKey, endKey) {
  const [ys, ms, ds] = startKey.split('-').map(Number);
  const [ye, me, de] = endKey.split('-').map(Number);
  const start = Date.UTC(ys, ms - 1, ds);
  const end = Date.UTC(ye, me - 1, de);
  return Math.floor((end - start) / 86400000) + 1;
}

export function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function parseRevenuePeriod(period = '30d') {
  const endKey = getStoreDateKey(new Date());

  if (period === 'today') {
    return {
      since: startOfStoreDay(new Date()),
      days: 1,
      startKey: endKey,
      endKey,
      periodKey: 'today',
    };
  }

  if (period === 'mtd') {
    const [y, m] = endKey.split('-');
    const startKey = `${y}-${m}-01`;
    const since = new Date(`${startKey}T00:00:00+02:00`);
    return {
      since,
      days: daysBetween(startKey, endKey),
      startKey,
      endKey,
      periodKey: 'mtd',
    };
  }

  const normalized = String(period).replace(/d$/i, '');
  const days = Math.min(Math.max(parseInt(normalized, 10) || 30, 1), 365);
  const startKey = addDaysToStoreDateKey(endKey, -(days - 1));
  const since = new Date(`${startKey}T00:00:00+02:00`);
  return { since, days, startKey, endKey, periodKey: `${days}d` };
}

function isValidDateKey(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function clampRevenueRangeDays(days) {
  return Math.min(Math.max(days || 1, 1), MAX_REVENUE_RANGE_DAYS);
}

export function parseRevenueRangeQuery({ period, start, end } = {}) {
  const endKeyDefault = getStoreDateKey(new Date());

  if (isValidDateKey(start) && isValidDateKey(end)) {
    const startKey = start;
    const endKey = end;
    const days = clampRevenueRangeDays(daysBetween(startKey, endKey));
    const clampedEndKey = addDaysToStoreDateKey(startKey, days - 1);
    const since = new Date(`${startKey}T00:00:00+02:00`);
    const until = new Date(`${addDaysToStoreDateKey(clampedEndKey, 1)}T00:00:00+02:00`);
    return {
      since,
      until,
      days,
      startKey,
      endKey: clampedEndKey,
      periodKey: 'custom',
      isCustom: true,
    };
  }

  const parsed = parseRevenuePeriod(period || '30d');
  return {
    since: parsed.since,
    until: new Date(`${addDaysToStoreDateKey(parsed.endKey, 1)}T00:00:00+02:00`),
    days: parsed.days,
    startKey: parsed.startKey,
    endKey: parsed.endKey,
    periodKey: parsed.periodKey,
    isCustom: false,
    endKeyDefault,
  };
}

export function pickRevenueInterval({ interval, days }) {
  const normalized = String(interval || 'auto').toLowerCase();
  if (['day', 'week', 'month', 'year'].includes(normalized)) return normalized;
  // Auto: keep chart points sane for long ranges.
  if (days <= 120) return 'day';
  if (days <= 365) return 'week';
  if (days <= 1200) return 'month';
  return 'year';
}

export function intervalDateFormat(interval) {
  if (interval === 'year') return '%Y';
  if (interval === 'month') return '%Y-%m';
  if (interval === 'week') return '%G-W%V';
  return '%Y-%m-%d';
}

export function previousPeriodRange({ periodKey, startKey, endKey, days }) {
  if (periodKey === 'today') {
    const yesterdayKey = addDaysToStoreDateKey(endKey, -1);
    return {
      prevStart: new Date(`${yesterdayKey}T00:00:00+02:00`),
      prevEnd: new Date(`${endKey}T00:00:00+02:00`),
    };
  }

  if (periodKey === 'mtd') {
    const [y, m, d] = endKey.split('-').map(Number);
    const prevMonth = m === 1 ? 12 : m - 1;
    const prevYear = m === 1 ? y - 1 : y;
    const prevStartKey = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`;
    const prevEndDay = Math.min(d, daysInMonth(prevYear, prevMonth));
    const prevEndKey = addDaysToStoreDateKey(prevStartKey, prevEndDay - 1);
    return {
      prevStart: new Date(`${prevStartKey}T00:00:00+02:00`),
      prevEnd: new Date(`${addDaysToStoreDateKey(prevEndKey, 1)}T00:00:00+02:00`),
    };
  }

  const prevEnd = new Date(`${startKey}T00:00:00+02:00`);
  const prevStartKey = addDaysToStoreDateKey(startKey, -days);
  return {
    prevStart: new Date(`${prevStartKey}T00:00:00+02:00`),
    prevEnd,
  };
}

export function storeDateGroupField() {
  return {
    $dateToString: {
      format: '%Y-%m-%d',
      date: '$createdAt',
      timezone: STORE_TIMEZONE,
    },
  };
}

export function fillRevenueByDay(rows, dayCount, startKeyOverride = null) {
  const map = new Map(rows.map((row) => [row.date, row]));
  const endKey = getStoreDateKey(new Date());
  const startKey = startKeyOverride || addDaysToStoreDateKey(endKey, -(dayCount - 1));
  const result = [];
  let cursor = startKey;

  for (let i = 0; i < dayCount; i += 1) {
    const row = map.get(cursor);
    result.push({
      date: cursor,
      revenue: row?.revenue || 0,
      orders: row?.orders || 0,
    });
    cursor = addDaysToStoreDateKey(cursor, 1);
  }

  return result;
}

export function pctChange(current, previous) {
  // With no prior-period baseline, any percentage is a fabricated number
  // (e.g. 2 vs 0 and 1000 vs 0 would both read as "+100%"). Report "no
  // comparison available" instead of a misleading fixed value.
  if (!previous) return current > 0 ? null : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export const PAYMENT_LABELS = {
  cod: { ar: 'الدفع عند الاستلام', en: 'Cash on delivery' },
  stripe: { ar: 'دفع أونلاين', en: 'Online payment' },
};
