import { haversineKm } from './geoDistance';

const FAST_ACCEPT_ACCURACY_M = 40;
const GOOD_ACCEPT_ACCURACY_M = 100;
const MAX_WAIT_MS = 12000;
const MIN_WAIT_MS = 800;
const STABLE_READINGS = 2;
const STABLE_RADIUS_M = 35;
const MIN_READINGS_BEFORE_ACCEPT = 3;
const NETWORK_FALLBACK_ACCEPT_ACCURACY_M = 1800;
const NETWORK_FAST_ACCEPT_ACCURACY_M = 650;
const NETWORK_FAST_ACCEPT_AFTER_MS = 2500;

function haversineMeters(lat1, lng1, lat2, lng2) {
  return haversineKm(lat1, lng1, lat2, lng2) * 1000;
}

function readPosition(position, source = 'browser') {
  const accuracy = Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : Infinity;
  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    accuracy,
    altitude: position.coords.altitude,
    altitudeAccuracy: position.coords.altitudeAccuracy,
    speed: position.coords.speed,
    timestamp: position.timestamp,
    source,
  };
}

/** Wi-Fi / cell fixes often omit altitude and report optimistic accuracy (e.g. 65 m). */
function hasGpsHardwareSignal(candidate) {
  if (!candidate) return false;
  if (Number.isFinite(candidate.altitude)) return true;
  if (Number.isFinite(candidate.altitudeAccuracy)) return true;
  if (Number.isFinite(candidate.speed)) return true;
  return false;
}

function isLikelyNetworkLocation(candidate) {
  if (!candidate) return true;
  if (hasGpsHardwareSignal(candidate)) return false;
  // Without a GPS chip signal, only trust very tight fixes.
  return candidate.accuracy > 25;
}

function hasImprovedOverTime(readings = []) {
  if (readings.length < MIN_READINGS_BEFORE_ACCEPT) return false;
  const first = readings[0].accuracy;
  const last = readings[readings.length - 1].accuracy;
  if (!Number.isFinite(first) || !Number.isFinite(last)) return false;
  return last <= first * 0.55;
}

function isStuckNetworkFix(readings = []) {
  if (readings.length < 4) return false;
  if (readings.some((point) => hasGpsHardwareSignal(point))) return false;

  const anchor = readings[readings.length - 1];
  const sameSpot = readings.every(
    (point) => haversineMeters(point.lat, point.lng, anchor.lat, anchor.lng) <= 60,
  );
  if (!sameSpot) return false;

  const firstAccuracy = readings[0].accuracy;
  const lastAccuracy = readings[readings.length - 1].accuracy;
  return lastAccuracy >= firstAccuracy * 0.85;
}

function pickBestBrowserCandidate(candidates = []) {
  return candidates
    .filter((item) => (
      item
      && item.source === 'browser'
      && Number.isFinite(item.lat)
      && Number.isFinite(item.lng)
      && Number.isFinite(item.accuracy)
    ))
    .sort((a, b) => {
      const aNetwork = isLikelyNetworkLocation(a);
      const bNetwork = isLikelyNetworkLocation(b);
      if (aNetwork !== bNetwork) return aNetwork ? 1 : -1;
      return a.accuracy - b.accuracy;
    })[0] || null;
}

function classifyQuality(accuracyM) {
  if (accuracyM <= 50) return 'high';
  if (accuracyM <= 120) return 'good';
  if (accuracyM <= 350) return 'fair';
  return 'low';
}

function finalizeCandidate(candidate, elapsedMs) {
  const quality = classifyQuality(candidate.accuracy);
  return {
    ...candidate,
    quality,
    approximate: quality !== 'high' && quality !== 'good',
    elapsedMs,
  };
}

function shouldAcceptNetworkFallback(candidate, browserReadings = []) {
  if (!candidate || candidate.source !== 'browser') return false;
  if (!isLikelyNetworkLocation(candidate)) return false;
  if (!Number.isFinite(candidate.accuracy)) return false;
  if (candidate.accuracy > NETWORK_FALLBACK_ACCEPT_ACCURACY_M) return false;

  if (browserReadings.length < 2) return false;
  const anchor = browserReadings[browserReadings.length - 1];
  const stableEnough = browserReadings
    .slice(-3)
    .every((point) => haversineMeters(point.lat, point.lng, anchor.lat, anchor.lng) <= 120);

  return stableEnough;
}

function shouldAcceptFastNetworkCandidate(candidate, browserReadings = [], elapsed = 0) {
  if (elapsed < NETWORK_FAST_ACCEPT_AFTER_MS) return false;
  if (!candidate || candidate.source !== 'browser') return false;
  if (!isLikelyNetworkLocation(candidate)) return false;
  if (!Number.isFinite(candidate.accuracy)) return false;
  if (candidate.accuracy > NETWORK_FAST_ACCEPT_ACCURACY_M) return false;
  if (browserReadings.length < 2) return false;

  const anchor = browserReadings[browserReadings.length - 1];
  return browserReadings
    .slice(-2)
    .every((point) => haversineMeters(point.lat, point.lng, anchor.lat, anchor.lng) <= 90);
}

function shouldReportProgress(candidate) {
  if (candidate?.source !== 'browser') return false;
  if (isLikelyNetworkLocation(candidate)) return false;
  if (candidate.accuracy <= GOOD_ACCEPT_ACCURACY_M) return true;
  return hasGpsHardwareSignal(candidate) && candidate.accuracy <= 200;
}

function canAcceptCandidate(winner, browserReadings, elapsed) {
  if (!winner || elapsed < MIN_WAIT_MS) return false;

  const networkLike = isLikelyNetworkLocation(winner);
  const stable = browserReadings.length >= STABLE_READINGS
    && browserReadings.slice(-STABLE_READINGS).every((point, index, list) => {
      const anchor = list[list.length - 1];
      return haversineMeters(point.lat, point.lng, anchor.lat, anchor.lng) <= STABLE_RADIUS_M;
    });

  if (!networkLike && winner.accuracy <= FAST_ACCEPT_ACCURACY_M && stable) {
    return true;
  }

  if (hasGpsHardwareSignal(winner) && winner.accuracy <= GOOD_ACCEPT_ACCURACY_M && stable) {
    return true;
  }

  if (
    hasImprovedOverTime(browserReadings)
    && winner.accuracy <= GOOD_ACCEPT_ACCURACY_M
    && stable
    && elapsed >= 2500
  ) {
    return true;
  }

  if (elapsed >= MAX_WAIT_MS) {
    if (isStuckNetworkFix(browserReadings)) return false;
    if (networkLike || winner.accuracy > GOOD_ACCEPT_ACCURACY_M) return false;
    return stable;
  }

  return false;
}

/**
 * Read the device GPS position via the browser Geolocation API.
 * Ignores Wi-Fi / cell guesses that lack a real GPS signal.
 */
export function locateDevicePosition({ onProgress } = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(Object.assign(new Error('unsupported'), { code: 'unsupported' }));
      return;
    }

    let settled = false;
    let best = null;
    const browserReadings = [];
    let watchId = null;
    let hardTimeout = null;
    let checkTimer = null;
    const startedAt = Date.now();

    const geoOptions = {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: MAX_WAIT_MS,
    };

    const cleanup = () => {
      if (watchId != null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
      if (hardTimeout != null) clearTimeout(hardTimeout);
      if (checkTimer != null) clearInterval(checkTimer);
    };

    const finish = (payload, error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve(payload);
    };

    const reportProgress = (candidate) => {
      if (!shouldReportProgress(candidate)) return;
      onProgress?.({
        phase: 'refining',
        lat: candidate.lat,
        lng: candidate.lng,
        accuracy: candidate.accuracy,
        source: candidate.source,
        elapsedMs: Date.now() - startedAt,
      });
    };

    const consider = (candidate) => {
      if (!candidate || candidate.source !== 'browser') return;

      browserReadings.push(candidate);
      if (browserReadings.length > 10) browserReadings.shift();

      const nextBest = pickBestBrowserCandidate([best, candidate]);
      if (nextBest && nextBest !== best) {
        best = nextBest;
        reportProgress(best);
      } else if (!best) {
        best = candidate;
      }
    };

    const tryFinish = () => {
      const elapsed = Date.now() - startedAt;
      const winner = pickBestBrowserCandidate([best]);

      if (!winner) {
        if (elapsed >= MAX_WAIT_MS) {
          finish(null, Object.assign(new Error('TIMEOUT'), { code: 3 }));
        }
        return;
      }

      if (canAcceptCandidate(winner, browserReadings, elapsed)) {
        finish(finalizeCandidate(winner, elapsed));
        return;
      }

      if (shouldAcceptFastNetworkCandidate(winner, browserReadings, elapsed)) {
        finish(finalizeCandidate(winner, elapsed));
        return;
      }

      if (elapsed >= 5000 && shouldAcceptNetworkFallback(winner, browserReadings)) {
        finish(finalizeCandidate(winner, elapsed));
        return;
      }

      if (isStuckNetworkFix(browserReadings) && elapsed >= 8000) {
        if (shouldAcceptNetworkFallback(winner, browserReadings)) {
          finish(finalizeCandidate(winner, elapsed));
          return;
        }
        finish(null, Object.assign(new Error('LOW_ACCURACY'), {
          code: 'LOW_ACCURACY',
          accuracy: winner.accuracy,
          reason: 'network',
        }));
        return;
      }

      if (elapsed >= MAX_WAIT_MS) {
        if (shouldAcceptNetworkFallback(winner, browserReadings)) {
          finish(finalizeCandidate(winner, elapsed));
          return;
        }
        finish(null, Object.assign(new Error('LOW_ACCURACY'), {
          code: 'LOW_ACCURACY',
          accuracy: winner.accuracy,
        }));
      }
    };

    onProgress?.({ phase: 'starting' });

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        consider(readPosition(position, 'browser'));
        tryFinish();
      },
      (geoError) => {
        if (!best) finish(null, geoError);
      },
      geoOptions,
    );

    hardTimeout = setTimeout(tryFinish, MAX_WAIT_MS);
    checkTimer = setInterval(tryFinish, 300);
  });
}
