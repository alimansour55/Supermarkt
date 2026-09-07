const MINUTE_MS = 60 * 1000;

/** Admin dashboard: flag driver GPS as possibly stale */
export const STALE_DRIVER_LOCATION_MS = 2 * MINUTE_MS;

/** Customer map: hide live driver pin / route when GPS is older than this */
export const HIDE_TRACKING_MAP_MS = (() => {
  const mins = Number(process.env.TRACKING_MAP_HIDE_MINUTES);
  if (Number.isFinite(mins) && mins > 0) return mins * MINUTE_MS;
  return 5 * MINUTE_MS;
})();
