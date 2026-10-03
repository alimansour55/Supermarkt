/**
 * Websites cannot open the device's OS Settings app directly — there is no browser API
 * for it on iOS Safari or Android Chrome. The best we can do is tell the customer exactly
 * where to look, tailored to their platform, instead of leaving them stuck on a bare error.
 */
export function detectMobilePlatform() {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua)
    || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
  if (isIOS) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'other';
}

export function getLocationPermissionSteps(isAr) {
  const platform = detectMobilePlatform();

  if (platform === 'ios') {
    return isAr
      ? [
        'اضغط على أيقونة "aA" أو معلومات الموقع بجانب شريط العنوان في المتصفح.',
        'افتح "إعدادات الموقع الإلكتروني" واضبط الموقع الجغرافي على "السماح" (أو "اسأل").',
        'إذا كان الخيار "رفض" لكل المواقع: افتح إعدادات الآيفون ← التطبيقات ← Safari ← الموقع، واختر "اسأل" أو "السماح".',
        'إذا لم يظهر الخيار: افتح إعدادات الآيفون ← الخصوصية والأمان ← خدمات الموقع، تأكد أنها مفعّلة، ثم مرّر لأسفل واختر المتصفح واضبطه على "أثناء استخدام التطبيق".',
      ]
      : [
        'Tap the "aA" or site-info icon next to the browser’s address bar.',
        'Open "Website Settings" and set Location to "Allow" (or "Ask").',
        'If it’s set to "Deny" for all websites: open iPhone Settings → Apps → Safari → Location and choose "Ask" or "Allow".',
        'If that option isn’t there: open iPhone Settings → Privacy & Security → Location Services, make sure it’s on, then scroll down, pick your browser, and set it to "While Using the App".',
      ];
  }

  if (platform === 'android') {
    return isAr
      ? [
        'اضغط على أيقونة القفل أو (ⓘ) بجانب شريط العنوان.',
        'افتح "الأذونات" ← "الموقع الجغرافي" ← اختر "السماح".',
        'إذا لم يظهر الخيار: افتح إعدادات الهاتف ← الموقع ← أذونات التطبيقات، وفعّل الموقع لهذا المتصفح.',
      ]
      : [
        'Tap the lock or (ⓘ) icon next to the address bar.',
        'Open "Permissions" → "Location" → choose "Allow".',
        'If that option isn’t there: open phone Settings → Location → app permissions, and enable location for this browser.',
      ];
  }

  return isAr
    ? [
      'اضغط على أيقونة القفل بجانب شريط العنوان في المتصفح.',
      'ابحث عن إذن "الموقع الجغرافي" واضبطه على "السماح"، ثم أعد تحميل الصفحة.',
    ]
    : [
      'Click the lock icon next to your browser’s address bar.',
      'Find the "Location" permission, set it to "Allow", then reload the page.',
    ];
}
