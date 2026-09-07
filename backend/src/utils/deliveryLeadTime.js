export const DEFAULT_SCHEDULED_LEAD_MINUTES = 120;
export const DEFAULT_EXPRESS_LEAD_MINUTES = 120;

export function clampLeadMinutes(value, fallback) {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.min(parsed, 24 * 60);
}

/** Zone override wins when leadTimeOverride is true; otherwise global store values apply. */
export function resolveDeliveryLeadMinutes({
  deliveryMethod = 'scheduled',
  storeSettings = null,
  zone = null,
} = {}) {
  const isExpress = deliveryMethod === 'express';
  const globalScheduled = clampLeadMinutes(
    storeSettings?.scheduledMinLeadMinutes,
    DEFAULT_SCHEDULED_LEAD_MINUTES,
  );
  const globalExpress = clampLeadMinutes(
    storeSettings?.expressMinLeadMinutes,
    DEFAULT_EXPRESS_LEAD_MINUTES,
  );

  if (zone?.leadTimeOverride === true) {
    if (isExpress) {
      return clampLeadMinutes(zone.expressMinLeadMinutes, globalExpress);
    }
    return clampLeadMinutes(zone.scheduledMinLeadMinutes, globalScheduled);
  }

  return isExpress ? globalExpress : globalScheduled;
}

export function resolveZoneLeadTimeConfig(zone, storeSettings = null) {
  const globalScheduled = clampLeadMinutes(
    storeSettings?.scheduledMinLeadMinutes,
    DEFAULT_SCHEDULED_LEAD_MINUTES,
  );
  const globalExpress = clampLeadMinutes(
    storeSettings?.expressMinLeadMinutes,
    DEFAULT_EXPRESS_LEAD_MINUTES,
  );

  return {
    leadTimeOverride: zone?.leadTimeOverride === true,
    scheduledMinLeadMinutes: resolveDeliveryLeadMinutes({
      deliveryMethod: 'scheduled',
      storeSettings,
      zone,
    }),
    expressMinLeadMinutes: resolveDeliveryLeadMinutes({
      deliveryMethod: 'express',
      storeSettings,
      zone,
    }),
    scheduledMinLeadMinutesGlobal: globalScheduled,
    expressMinLeadMinutesGlobal: globalExpress,
    zoneScheduledMinLeadMinutes: clampLeadMinutes(
      zone?.scheduledMinLeadMinutes,
      globalScheduled,
    ),
    zoneExpressMinLeadMinutes: clampLeadMinutes(
      zone?.expressMinLeadMinutes,
      globalExpress,
    ),
  };
}

export function formatLeadMinutesLabel(minutes, lang = 'ar') {
  const m = clampLeadMinutes(minutes, DEFAULT_SCHEDULED_LEAD_MINUTES);
  if (m % 60 === 0) {
    const hours = m / 60;
    return lang === 'ar' ? `${hours} ساعات` : `${hours} hour${hours === 1 ? '' : 's'}`;
  }
  return lang === 'ar' ? `${m} دقيقة` : `${m} min`;
}
