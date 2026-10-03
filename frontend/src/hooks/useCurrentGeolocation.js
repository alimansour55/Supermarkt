import { useCallback, useRef, useState } from 'react';
import { locateDevicePosition } from '../utils/deviceLocate';

export function getGeolocationErrorMessage(error, isAr = false) {
  const code = error?.code ?? error?.name;
  if (code === 'INSECURE_CONTEXT') {
    return isAr
      ? 'تحديد الموقع يعمل فقط عبر اتصال آمن (HTTPS). هذا الرابط للاختبار عبر شبكة محلية غير آمن — استخدم رابط https المخصص للموبايل.'
      : 'Location only works over a secure (HTTPS) connection. This LAN test link is not secure — use the mobile https test link instead.';
  }
  if (code === 1 || code === 'PERMISSION_DENIED') {
    return isAr
      ? 'تم رفض إذن الموقع. فعّل الموقع من إعدادات المتصفح ثم حاول مرة أخرى.'
      : 'Location permission denied. Enable location in your browser settings and try again.';
  }
  if (code === 2 || code === 'POSITION_UNAVAILABLE') {
    return isAr
      ? 'تعذر تحديد موقعك. تأكد من تفعيل GPS على الجهاز.'
      : 'Could not determine your location. Check that GPS is enabled.';
  }
  if (code === 3 || code === 'TIMEOUT') {
    return isAr
      ? 'انتهت مهلة تحديد الموقع. حاول مرة أخرى.'
      : 'Location request timed out. Please try again.';
  }
  if (code === 'LOW_ACCURACY') {
    return isAr
      ? 'تعذر تحديد موقعك بدقة. فعّل «الموقع الدقيق» على الهاتف، أو افتح الموقع من المتصفح على الهاتف (وليس الكمبيوتر)، أو ابحث عن عنوانك وحرّك الدبوس على الخريطة.'
      : 'Could not get a precise location. Enable Precise Location on your phone, use your phone browser (not desktop), or search for your address and drag the pin on the map.';
  }
  if (error?.message === 'unsupported') {
    return isAr
      ? 'المتصفح لا يدعم تحديد الموقع.'
      : 'Geolocation is not supported on this device.';
  }
  return isAr ? 'تعذر تحديد موقعك.' : 'Could not get your location.';
}

export function getGeolocationProgressMessage(progress, isAr = false) {
  if (!progress) {
    return isAr ? 'جاري تحديد موقعك…' : 'Finding your location…';
  }
  if (progress.phase === 'refining') {
    const meters = Math.round(progress.accuracy);
    if (Number.isFinite(meters) && meters < 5000) {
      return isAr
        ? `جاري تحديد موقع GPS… (±${meters} م)`
        : `Getting GPS fix… (±${meters} m)`;
    }
    return isAr ? 'جاري تحديد موقع GPS…' : 'Getting GPS fix…';
  }
  return isAr ? 'جاري طلب إذن الموقع…' : 'Requesting location access…';
}

export function getGeolocationAccuracyWarning(result, isAr = false) {
  if (!result?.approximate) return '';

  const meters = Math.round(result.accuracy);
  if (result.quality === 'low') {
    return isAr
      ? `الموقع تقريبي (±${meters} م). تأكد من موضع الدبوس، أو ابحث عن عنوانك، أو استخدم الهاتف مع GPS.`
      : `Location is approximate (±${meters} m). Confirm the pin, search your address, or use a phone with GPS.`;
  }

  return isAr
    ? `تم تحديد موقعك بدقة متوسطة (±${meters} م). تأكد من موضع الدبوس على الخريطة.`
    : `Location found with moderate accuracy (±${meters} m). Confirm the pin position on the map.`;
}

/** @deprecated use locateDevicePosition */
export function getAccurateCurrentPosition(options = {}) {
  return locateDevicePosition(options);
}

/**
 * Read the device's current GPS position with progressive accuracy refinement.
 */
export function useCurrentGeolocation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(null);
  const activeRef = useRef(false);

  const locate = useCallback((options = {}) => {
    if (activeRef.current) {
      return Promise.reject(Object.assign(new Error('busy'), { code: 'BUSY' }));
    }

    activeRef.current = true;
    setLoading(true);
    setError('');
    setProgress({ phase: 'starting' });

    return locateDevicePosition({
      onProgress: (next) => {
        setProgress(next);
        options.onProgress?.(next);
      },
    }).finally(() => {
      activeRef.current = false;
      setLoading(false);
      setProgress(null);
    });
  }, []);

  const clearError = useCallback(() => setError(''), []);
  const setLocateError = useCallback((message) => setError(message), []);

  return {
    locate,
    loading,
    error,
    progress,
    setError: setLocateError,
    clearError,
  };
}
