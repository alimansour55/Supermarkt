import {
  getActiveThemeRotationStep,
  MIN_THEME_ROTATION_STEPS,
  msUntilNextThemeRotation,
  normalizeThemeRotation,
} from '../constants/themeRotation';
import { applySiteTheme } from './applySiteTheme';

let rotationTimer = null;
let rotationOwner = null;
let rotationStoppedHandler = null;

export function setThemeRotationStoppedHandler(handler) {
  rotationStoppedHandler = handler;
}

function clearRotationTimer() {
  if (rotationTimer) {
    clearTimeout(rotationTimer);
    rotationTimer = null;
  }
}

function applyRotationStep(rotation) {
  const step = getActiveThemeRotationStep(rotation);
  if (!step) return;
  document.documentElement.classList.add('theme-rotating');
  applySiteTheme(step.color, { themeShade: step.shade });
}

function scheduleRotation(rotation, ownerId) {
  clearRotationTimer();
  const normalized = normalizeThemeRotation(rotation);
  if (!normalized.enabled || normalized.steps.length < MIN_THEME_ROTATION_STEPS) return;

  rotationOwner = ownerId;
  applyRotationStep(normalized);

  const tick = () => {
    if (rotationOwner !== ownerId) return;
    applyRotationStep(normalized);
    const delay = msUntilNextThemeRotation(normalized) ?? normalized.intervalMinutes * 60 * 1000;
    rotationTimer = setTimeout(tick, Math.max(500, delay));
  };

  const initialDelay = msUntilNextThemeRotation(normalized) ?? normalized.intervalMinutes * 60 * 1000;
  rotationTimer = setTimeout(tick, Math.max(500, initialDelay));
}

/** Start or refresh automatic theme rotation (only one owner at a time). */
export function startThemeRotation(rotation, ownerId = 'default') {
  const normalized = normalizeThemeRotation(rotation);
  if (!normalized.enabled || normalized.steps.length < MIN_THEME_ROTATION_STEPS) {
    if (rotationOwner === ownerId) stopThemeRotation(ownerId);
    return false;
  }
  if (rotationOwner !== null && rotationOwner !== ownerId) return false;
  scheduleRotation(normalized, ownerId);
  return true;
}

export function stopThemeRotation(ownerId = 'default', { notify = true } = {}) {
  if (rotationOwner !== null && rotationOwner !== ownerId) return;
  const wasRunning = rotationTimer !== null;
  clearRotationTimer();
  rotationOwner = null;
  document.documentElement.classList.remove('theme-rotating');
  if (notify && wasRunning) rotationStoppedHandler?.();
}

export function isThemeRotationRunning() {
  return rotationTimer !== null;
}
