import {
  DEFAULT_THEME_COLOR,
  DEFAULT_THEME_SHADE,
  resolveThemeColor,
  resolveThemeShade,
} from './siteThemes';

export const DEFAULT_THEME_ROTATION = {
  enabled: false,
  intervalMinutes: 30,
  steps: [],
};

export const MIN_THEME_ROTATION_STEPS = 2;
export const MAX_THEME_ROTATION_STEPS = 12;

export const THEME_ROTATION_INTERVAL_OPTIONS = [
  { value: 1, labelAr: 'كل دقيقة', labelEn: 'Every 1 minute' },
  { value: 5, labelAr: 'كل 5 دقائق', labelEn: 'Every 5 minutes' },
  { value: 15, labelAr: 'كل 15 دقيقة', labelEn: 'Every 15 minutes' },
  { value: 30, labelAr: 'كل 30 دقيقة', labelEn: 'Every 30 minutes' },
  { value: 60, labelAr: 'كل ساعة', labelEn: 'Every 1 hour' },
  { value: 360, labelAr: 'كل 6 ساعات', labelEn: 'Every 6 hours' },
  { value: 1440, labelAr: 'كل 24 ساعة', labelEn: 'Every 24 hours' },
];

export function themeStepKey(step) {
  return `${resolveThemeColor(step?.color)}:${resolveThemeShade(step?.shade)}`;
}

export function normalizeThemeRotationStep(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    color: resolveThemeColor(raw.color),
    shade: resolveThemeShade(raw.shade),
  };
}

export function normalizeThemeRotation(raw, fallback = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const fallbackColor = resolveThemeColor(fallback.color || DEFAULT_THEME_COLOR);
  const fallbackShade = resolveThemeShade(fallback.shade ?? DEFAULT_THEME_SHADE);

  const steps = (Array.isArray(source.steps) ? source.steps : [])
    .map(normalizeThemeRotationStep)
    .filter(Boolean)
    .slice(0, MAX_THEME_ROTATION_STEPS);

  const intervalMinutes = Math.min(
    1440,
    Math.max(1, Math.round(Number(source.intervalMinutes) || DEFAULT_THEME_ROTATION.intervalMinutes)),
  );

  const enabled = source.enabled === true;

  if (enabled && steps.length < MIN_THEME_ROTATION_STEPS) {
    return {
      enabled: false,
      intervalMinutes,
      steps: steps.length ? steps : [{ color: fallbackColor, shade: fallbackShade }],
    };
  }

  return { enabled, intervalMinutes, steps };
}

export function getThemeRotationStepIndex(steps, intervalMinutes, now = Date.now()) {
  if (!steps?.length) return 0;
  const intervalMs = Math.max(1, intervalMinutes) * 60 * 1000;
  return Math.floor(now / intervalMs) % steps.length;
}

export function getActiveThemeRotationStep(rotation, now = Date.now()) {
  const normalized = normalizeThemeRotation(rotation);
  if (!normalized.enabled || normalized.steps.length < MIN_THEME_ROTATION_STEPS) return null;
  const index = getThemeRotationStepIndex(normalized.steps, normalized.intervalMinutes, now);
  return { ...normalized.steps[index], index };
}

export function msUntilNextThemeRotation(rotation, now = Date.now()) {
  const normalized = normalizeThemeRotation(rotation);
  if (!normalized.enabled || normalized.steps.length < MIN_THEME_ROTATION_STEPS) return null;
  const intervalMs = normalized.intervalMinutes * 60 * 1000;
  return intervalMs - (now % intervalMs);
}

export function themeRotationsEqual(a, b) {
  return JSON.stringify(normalizeThemeRotation(a)) === JSON.stringify(normalizeThemeRotation(b));
}
