import { isNativeApp } from './nativeLocation';
import { detectMobilePlatform } from './geoPermissionHelp';

/**
 * iOS browsers (all WebKit) show the location prompt at most once per page load: after
 * "Don't Allow", every further request on that page is refused instantly, with no prompt —
 * so a plain "Try again" looks like it does nothing. Only a fresh page load can ask again.
 *
 * So on iOS web, retrying after a denial reloads the page and reopens the popup with a
 * "tap to allow" button. That tap is the first request of the new page load, made from a
 * real user gesture, so it's a clean test:
 *   - the prompt appears → the customer chooses (a "Don't Allow" takes human time), or
 *   - it's refused instantly → no prompt was shown, location is blocked in Settings, and
 *     the only way forward is the settings steps.
 */
const RETRY_KEY = 'geo_retry_after_reload_v2';
const INSTANT_DENIAL_MS = 600;

let requestedThisPageLoad = false;

export function isPermissionDeniedCode(code) {
  return code === 1 || code === 'PERMISSION_DENIED';
}

export function isIOSWeb() {
  return !isNativeApp() && detectMobilePlatform() === 'ios';
}

/** Call right before each location request; true only for the first one this page load. */
export function claimFirstRequestThisPageLoad() {
  const first = !requestedThisPageLoad;
  requestedThisPageLoad = true;
  return first;
}

/** A denial this fast means the browser never showed a prompt. */
export function wasInstantDenial(elapsedMs) {
  return elapsedMs < INSTANT_DENIAL_MS;
}

export function reloadToRetryLocation() {
  try {
    window.sessionStorage.setItem(RETRY_KEY, '1');
  } catch {
    // ignore — private mode / storage disabled; the reload still gives a fresh prompt
  }
  window.location.reload();
}

/** Whether this page load was started by reloadToRetryLocation (does not clear it). */
export function hasPendingReloadRetry() {
  try {
    return window.sessionStorage.getItem(RETRY_KEY) === '1';
  } catch {
    return false;
  }
}

export function consumeReloadRetry() {
  const pending = hasPendingReloadRetry();
  try {
    window.sessionStorage.removeItem(RETRY_KEY);
  } catch {
    // ignore
  }
  return pending;
}
