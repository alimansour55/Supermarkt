/**
 * Websites cannot open the device's OS Settings app directly — there is no browser API
 * for it on iOS Safari or Android Chrome. The best we can do is tell the customer exactly
 * where to look, tailored to their platform and browser, instead of leaving them stuck.
 *
 * Text inside «…» is a button/menu label the customer has to find; the UI renders it bold.
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

/** iOS browsers other than Safari get their location permission per app in iOS Settings. */
function detectIOSBrowser() {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent || '';
  if (/CriOS/.test(ua)) return 'Chrome';
  if (/FxiOS/.test(ua)) return 'Firefox';
  if (/EdgiOS/.test(ua)) return 'Edge';
  return 'Safari';
}

function iosSafariSections(isAr) {
  return isAr
    ? [
      {
        title: 'الطريقة الأسرع — من Safari نفسه',
        steps: [
          'اضغط على زر «aA» (أو أيقونة الصفحة) بجوار رابط الموقع في شريط العنوان.',
          'اختر «إعدادات موقع الويب».',
          'اضغط «الموقع» واختر «سماح»، ثم اضغط «تم».',
          'ارجع هنا واضغط «حاول مرة أخرى».',
        ],
      },
      {
        title: 'لم تجد الخيار أو ما زال محظوراً؟',
        steps: [
          'افتح تطبيق «الإعدادات» ← «التطبيقات» ← «Safari» ← «الموقع» واختر «اسأل» أو «سماح».',
          'ثم «الإعدادات» ← «الخصوصية والأمن» ← «خدمات الموقع»: تأكد أنها مفعّلة.',
          'في نفس الصفحة اختر «مواقع Safari على الويب» ← «أثناء استخدام التطبيق».',
        ],
      },
    ]
    : [
      {
        title: 'Quickest — from Safari itself',
        steps: [
          'Tap the «aA» button (or the page icon) next to the site address in the address bar.',
          'Choose «Website Settings».',
          'Tap «Location», choose «Allow», then tap «Done».',
          'Come back here and tap «Try again».',
        ],
      },
      {
        title: 'Can’t find it, or still blocked?',
        steps: [
          'Open the «Settings» app → «Apps» → «Safari» → «Location» and choose «Ask» or «Allow».',
          'Then «Settings» → «Privacy & Security» → «Location Services»: make sure it’s on.',
          'On that same screen open «Safari Websites» → «While Using the App».',
        ],
      },
    ];
}

function iosAppBrowserSections(isAr, browser) {
  return isAr
    ? [
      {
        title: `فعّل الموقع لتطبيق ${browser}`,
        steps: [
          `افتح تطبيق «الإعدادات» ← «التطبيقات» ← «${browser}» ← «الموقع».`,
          'اختر «أثناء استخدام التطبيق»، وفعّل «الموقع الدقيق».',
          `ارجع إلى ${browser} واضغط «حاول مرة أخرى»، ثم اختر «سماح».`,
        ],
      },
      {
        title: 'ما زال محظوراً؟',
        steps: [
          '«الإعدادات» ← «الخصوصية والأمن» ← «خدمات الموقع»: تأكد أنها مفعّلة.',
        ],
      },
    ]
    : [
      {
        title: `Turn on location for ${browser}`,
        steps: [
          `Open the «Settings» app → «Apps» → «${browser}» → «Location».`,
          'Choose «While Using the App» and turn on «Precise Location».',
          `Go back to ${browser}, tap «Try again», then choose «Allow».`,
        ],
      },
      {
        title: 'Still blocked?',
        steps: [
          '«Settings» → «Privacy & Security» → «Location Services»: make sure it’s on.',
        ],
      },
    ];
}

function androidSections(isAr) {
  return isAr
    ? [
      {
        title: 'الطريقة الأسرع',
        steps: [
          'اضغط على الأيقونة الموجودة بجوار رابط الموقع في شريط العنوان (🔒 أو ⚙).',
          'اختر «الأذونات» ثم «الموقع»، وشغّله أو اختر «سماح».',
          'ارجع هنا واضغط «حاول مرة أخرى».',
        ],
      },
      {
        title: 'لم يظهر الخيار؟',
        steps: [
          'في Chrome اضغط «⋮» ← «الإعدادات» ← «إعدادات الموقع الإلكتروني» ← «الموقع الجغرافي».',
          'ابحث عن هذا الموقع تحت «محظور»، اضغط عليه واختر «سماح».',
          'تأكد أن «الموقع» مفعّل في الهاتف: اسحب شريط الإشعارات لأسفل واضغط أيقونة الموقع.',
        ],
      },
    ]
    : [
      {
        title: 'Quickest',
        steps: [
          'Tap the icon next to the site address in the address bar (🔒 or ⚙).',
          'Choose «Permissions» → «Location» and turn it on or choose «Allow».',
          'Come back here and tap «Try again».',
        ],
      },
      {
        title: 'Option not there?',
        steps: [
          'In Chrome tap «⋮» → «Settings» → «Site settings» → «Location».',
          'Find this site under «Blocked», tap it and choose «Allow».',
          'Make sure «Location» is on for the phone: swipe down the notification shade and tap the location icon.',
        ],
      },
    ];
}

function desktopSections(isAr) {
  return isAr
    ? [{
      title: '',
      steps: [
        'اضغط على أيقونة القفل بجانب شريط العنوان في المتصفح.',
        'ابحث عن إذن «الموقع الجغرافي» واضبطه على «السماح»، ثم أعد تحميل الصفحة.',
      ],
    }]
    : [{
      title: '',
      steps: [
        'Click the lock icon next to your browser’s address bar.',
        'Find the «Location» permission, set it to «Allow», then reload the page.',
      ],
    }];
}

/** Grouped steps: `[{ title, steps: string[] }]`, most likely fix first. */
export function getLocationPermissionSections(isAr) {
  const platform = detectMobilePlatform();
  if (platform === 'ios') {
    const browser = detectIOSBrowser();
    return browser === 'Safari' ? iosSafariSections(isAr) : iosAppBrowserSections(isAr, browser);
  }
  if (platform === 'android') return androidSections(isAr);
  return desktopSections(isAr);
}

/** Flat list of every step (older callers). */
export function getLocationPermissionSteps(isAr) {
  return getLocationPermissionSections(isAr).flatMap((section) => section.steps);
}
