import { isNativeApp } from './nativeLocation';
import { detectMobilePlatform } from './geoPermissionHelp';

/**
 * iOS Safari (and every iOS browser — they're all WebKit) only shows the location prompt
 * once per page load: after "Don't Allow", any further request on the same page is denied
 * instantly with no prompt. A reload gives a fresh prompt. So on iOS web, "Try again" after a
 * denial reloads the page and re-requests on the way back, which brings the Allow dialog back.
 *
 * If the request after that reload is denied *instantly* (no human taps "Don't Allow" that
 * fast), no prompt was shown — the site/browser is set to Deny — so we stop reloading and
 * fall back to the settings steps instead of looping.
 */
const RETRY_KEY = 'geo_retry_after_reload';
const HARD_BLOCK_KEY = 'geo_hard_blocked';
const INSTANT_DENIAL_MS = 600;

function read(key) {
  try {
    return window.sessionStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function write(key, on) {
  try {
    if (on) window.sessionStorage.setItem(key, '1');
    else window.sessionStorage.removeItem(key);
  } catch {
    // ignore — private mode / storage disabled
  }
}

export function isPermissionDeniedCode(code) {
  return code === 1 || code === 'PERMISSION_DENIED';
}

/** True when a denial on this device can be undone just by asking again after a reload. */
export function canReloadToReprompt() {
  return !isNativeApp() && detectMobilePlatform() === 'ios' && !read(HARD_BLOCK_KEY);
}

export function reloadToRetryLocation() {
  write(RETRY_KEY, true);
  window.location.reload();
}

/** Whether this page load was started by reloadToRetryLocation (does not clear it). */
export function hasPendingReloadRetry() {
  return read(RETRY_KEY);
}

export function consumeReloadRetry() {
  const pending = read(RETRY_KEY);
  write(RETRY_KEY, false);
  return pending;
}

/** Record the outcome of a locate attempt that followed a reload. */
export function noteReloadRetryResult(err, elapsedMs) {
  if (!err) {
    write(HARD_BLOCK_KEY, false);
    return;
  }
  if (isPermissionDeniedCode(err?.code) && elapsedMs < INSTANT_DENIAL_MS) {
    write(HARD_BLOCK_KEY, true);
  }
}
