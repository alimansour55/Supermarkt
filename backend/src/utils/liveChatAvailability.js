import { getStoreDateKey, getStoreOffset } from './storeDate.js';

const DAY_MS = 24 * 60 * 60 * 1000;

function weekdayForDateKey(dateKey) {
  return new Date(`${dateKey}T00:00:00Z`).getUTCDay();
}

function windowFor(liveChat, dateKey) {
  const dow = weekdayForDateKey(dateKey);
  const entry = (liveChat?.schedule || []).find((e) => e.day === dow);
  if (!entry?.enabled || !entry.from || !entry.to) return null;
  const offset = getStoreOffset(dateKey);
  const start = new Date(`${dateKey}T${entry.from}:00${offset}`);
  let end = new Date(`${dateKey}T${entry.to}:00${offset}`);
  if (end <= start) end = new Date(end.getTime() + DAY_MS);
  return { start, end };
}

/** Is live chat open right now, given the store's `liveChat` settings sub-object? */
export function isLiveChatAvailableNow(liveChat, now = new Date()) {
  if (!liveChat?.enabled) return false;
  if (!liveChat?.scheduleEnabled) return true;

  const dateKey = getStoreDateKey(now);
  const todayWindow = windowFor(liveChat, dateKey);
  if (todayWindow && now >= todayWindow.start && now <= todayWindow.end) return true;

  // An overnight window from yesterday may still be open (e.g. yesterday 22:00 -> today 02:00).
  const yesterdayKey = getStoreDateKey(new Date(now.getTime() - DAY_MS));
  const yesterdayWindow = windowFor(liveChat, yesterdayKey);
  if (yesterdayWindow && now >= yesterdayWindow.start && now <= yesterdayWindow.end) return true;

  return false;
}

/** Next instant live chat will be available, scanning up to 7 days ahead. Null if disabled or no day is ever enabled. */
export function getNextAvailableAt(liveChat, from = new Date()) {
  if (!liveChat?.enabled) return null;
  if (!liveChat?.scheduleEnabled) return null;

  for (let i = 0; i < 8; i += 1) {
    const dateKey = getStoreDateKey(new Date(from.getTime() + i * DAY_MS));
    const window = windowFor(liveChat, dateKey);
    if (window && window.start > from) return window.start;
    if (window && from >= window.start && from <= window.end) return from;
  }
  return null;
}
