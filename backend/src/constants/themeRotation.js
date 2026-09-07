import {
  DEFAULT_THEME_COLOR,
  DEFAULT_THEME_SHADE,
  isValidThemeColor,
  isValidThemeShade,
  resolveThemeColor,
  resolveThemeShade,
} from './siteThemes.js';

export const DEFAULT_THEME_ROTATION = {
  enabled: false,
  intervalMinutes: 30,
  steps: [],
};

export const MIN_THEME_ROTATION_STEPS = 2;
export const MAX_THEME_ROTATION_STEPS = 12;
export const MIN_THEME_ROTATION_INTERVAL = 1;
export const MAX_THEME_ROTATION_INTERVAL = 1440;

export function normalizeThemeRotationStep(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const color = resolveThemeColor(raw.color);
  const shade = resolveThemeShade(raw.shade);
  if (!isValidThemeColor(color) || !isValidThemeShade(shade)) return null;
  return { color, shade };
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
    MAX_THEME_ROTATION_INTERVAL,
    Math.max(MIN_THEME_ROTATION_INTERVAL, Math.round(Number(source.intervalMinutes) || DEFAULT_THEME_ROTATION.intervalMinutes)),
  );

  const enabled = source.enabled === true || source.enabled === 'true' || source.enabled === '1';

  if (enabled && steps.length < MIN_THEME_ROTATION_STEPS) {
    return {
      enabled: false,
      intervalMinutes,
      steps: steps.length ? steps : [{ color: fallbackColor, shade: fallbackShade }],
    };
  }

  return { enabled, intervalMinutes, steps };
}

export function sanitizeThemeRotationUpdate(raw, fallback = {}) {
  const normalized = normalizeThemeRotation(raw, fallback);
  if (normalized.enabled && normalized.steps.length < MIN_THEME_ROTATION_STEPS) {
    throw new Error('Theme rotation needs at least 2 colors in the series');
  }
  return normalized;
}
