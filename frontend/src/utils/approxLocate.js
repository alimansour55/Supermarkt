/**
 * Fast, low-precision geolocation for picking a delivery *area* (not a building).
 *
 * The checkout address picker needs metre-level GPS accuracy, so it runs a long
 * refinement loop (utils/deviceLocate.js) that times out after ~12s on a desktop
 * with no GPS chip and then reports "low accuracy". For choosing a delivery zone
 * (zones span many km) a single network/Wi-Fi fix is more than enough and comes
 * back in 1-3s — or instantly from cache on a repeat click.
 */
export function getApproximatePosition({ timeoutMs = 8000, maximumAge = 60_000 } = {}) {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(Object.assign(new Error('unsupported'), { code: 'unsupported', message: 'unsupported' }));
      return;
    }

    let settled = false;
    const done = (fn, value) => {
      if (settled) return;
      settled = true;
      fn(value);
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => done(resolve, {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
      }),
      (err) => done(reject, err),
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge },
    );

    // Safety net — some browsers never fire the error callback on a stalled request.
    setTimeout(() => {
      done(reject, Object.assign(new Error('TIMEOUT'), { code: 3 }));
    }, timeoutMs + 500);
  });
}
