/** Google Maps browser API key (Maps JavaScript API). */
export const GOOGLE_MAPS_API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();

/** Only set when you created a Map ID in Google Cloud (Map Management). */
export const GOOGLE_MAPS_MAP_ID = (import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || '').trim();

export const isGoogleMapsEnabled = () => Boolean(GOOGLE_MAPS_API_KEY);

/** Use OpenStreetMap tiles instead of Google Maps JS (no billing required). */
export const preferOsmMap = () => {
  const flag = (import.meta.env.VITE_USE_OSM_MAP || '').trim().toLowerCase();
  if (flag === 'true' || flag === '1' || flag === 'yes') return true;
  if (flag === 'false' || flag === '0' || flag === 'no') return false;
  return false;
};

/** Vector map + AdvancedMarker when a real Map ID is configured. */
export const useAdvancedMapMarkers = () => Boolean(GOOGLE_MAPS_MAP_ID);

export function getCurrentMapOrigin() {
  if (typeof window === 'undefined') return 'http://localhost:5173';
  return window.location.origin;
}

export function getGoogleMapsSetupSteps(isAr) {
  const origin = getCurrentMapOrigin();
  if (isAr) {
    return {
      title: 'إعداد خرائط Google مطلوب',
      intro: 'الخريطة الرمادية مع «For development purposes only» تعني أن مفتاح الواجهة الأمامية أو إعدادات Google Cloud غير مكتملة.',
      steps: [
        'افتح Google Cloud Console → نفس المشروع الذي أنشأت فيه مفتاح الواجهة (Frontend).',
        'فعّل الفوترة Billing (مطلوب حتى للاستخدام المجاني ~200$ شهرياً).',
        'من APIs & Services → Library فعّل: Maps JavaScript API و Places API (New).',
        'من Credentials → مفتاح المتصفح: في API restrictions أضف Maps JavaScript API و Places API (New).',
        `أضف هذه القيم: http://localhost:5173/* و http://127.0.0.1:5173/* و ${origin}/*`,
        'في frontend/.env ضع المفتاح في VITE_GOOGLE_MAPS_API_KEY (ليس مفتاح backend).',
        'أعد تشغيل npm run dev بعد حفظ .env.',
      ],
      retry: 'إعادة المحاولة',
      consoleLink: 'فتح Google Cloud Console',
    };
  }
  return {
    title: 'Google Maps setup required',
    intro: 'The gray “For development purposes only” map means your browser API key or Google Cloud settings are incomplete.',
    steps: [
      'Open Google Cloud Console → the project where you created the Frontend API key.',
      'Enable Billing (required even for the free ~$200/month credit).',
      'APIs & Services → Library: enable Maps JavaScript API and Places API (New).',
      'Credentials → Browser key → API restrictions: add Maps JavaScript API and Places API (New).',
      `Add: http://localhost:5173/*, http://127.0.0.1:5173/*, and ${origin}/*`,
      'In frontend/.env set VITE_GOOGLE_MAPS_API_KEY (not the backend GOOGLE_MAPS_API_KEY).',
      'Restart npm run dev after saving .env.',
    ],
    retry: 'Retry',
    consoleLink: 'Open Google Cloud Console',
  };
}
