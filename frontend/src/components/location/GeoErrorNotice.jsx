import { useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, ExternalLink, RefreshCw, Settings } from 'lucide-react';
import { isNativeApp, onAppResume, openAppSettings } from '../../utils/nativeLocation';
import { getLocationPermissionSections } from '../../utils/geoPermissionHelp';

// Port of the dev HTTPS proxy started by `npm run dev:mobile-https` (scripts/mobile-https-proxy.mjs).
const MOBILE_HTTPS_PORT = 5174;

/** Same page on the dev HTTPS proxy, so a phone on the LAN http:// link can switch in one tap. */
/** Render «Label» segments of a step bold, without the guillemets. */
function StepText({ text }) {
  return text.split(/(«[^»]+»)/).map((part, i) => (
    part.startsWith('«') && part.endsWith('»')
      ? <strong key={`${i}-${part}`} className="font-bold text-red-800">{part.slice(1, -1)}</strong>
      : <span key={`${i}-${part}`}>{part}</span>
  ));
}

function getSecureDevUrl() {
  if (typeof window === 'undefined' || window.location.protocol !== 'http:') return null;
  const { hostname, pathname, search, hash } = window.location;
  return `https://${hostname}:${MOBILE_HTTPS_PORT}${pathname}${search}${hash}`;
}

/**
 * Geolocation error with a way forward instead of a dead end: a retry button, and — for
 * permission-denied — numbered steps to re-enable it. Websites can't open OS Settings
 * directly, so this points the customer to where the toggle actually lives.
 */
export default function GeoErrorNotice({
  message, code, isAr, onRetry, retrying = false, canReprompt = false, stillBlocked = false,
}) {
  const isPermissionDenied = code === 1 || code === 'PERMISSION_DENIED';
  const secureUrl = code === 'INSECURE_CONTEXT' ? getSecureDevUrl() : null;
  // Steps are the only way forward on a hard denial, so show them without an extra tap. When
  // retrying brings the browser prompt back (canReprompt), keep them tucked away instead.
  const stepsByDefault = isPermissionDenied && !canReprompt;
  const [stepsToggled, setStepsToggled] = useState(null);
  const showSteps = stepsToggled ?? stepsByDefault;
  const setShowSteps = (update) => setStepsToggled(update(showSteps));
  const native = isNativeApp();

  // Native app: after the user flips the Location toggle in Settings and returns, retry for them.
  useEffect(() => {
    if (!native || !isPermissionDenied || !onRetry) return undefined;
    let off = () => {};
    let active = true;
    onAppResume(onRetry).then((remove) => {
      if (active) off = remove; else remove();
    });
    return () => { active = false; off(); };
  }, [native, isPermissionDenied, onRetry]);

  if (!message) return null;

  const sections = isPermissionDenied ? getLocationPermissionSections(isAr) : [];

  return (
    <div className="space-y-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p className="flex-1">{message}</p>
      </div>
      {stillBlocked && (
        <p role="status" className="ms-6 rounded-md bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
          <StepText
            text={isAr
              ? 'ما زال الموقع محظوراً — نفّذ الخطوات بالأسفل أولاً، ثم اضغط «حاول مرة أخرى».'
              : 'Location is still blocked — do the steps below first, then tap «Try again».'}
          />
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3 ps-6">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            disabled={retrying}
            className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${retrying ? 'animate-spin' : ''}`} aria-hidden />
            {canReprompt
              ? (isAr ? 'اطلب الإذن مرة أخرى' : 'Ask again')
              : (isAr ? 'حاول مرة أخرى' : 'Try again')}
          </button>
        )}
        {secureUrl && (
          <a
            href={secureUrl}
            dir="ltr"
            className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-700"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            {isAr ? 'افتح الرابط الآمن (https)' : 'Open secure link (https)'}
          </a>
        )}
        {native && isPermissionDenied && (
          <button
            type="button"
            onClick={() => openAppSettings()}
            className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-700"
          >
            <Settings className="h-3.5 w-3.5" aria-hidden />
            {isAr ? 'فتح الإعدادات' : 'Open Settings'}
          </button>
        )}
        {isPermissionDenied && !native && (
          <button
            type="button"
            onClick={() => setShowSteps((v) => !v)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 underline underline-offset-2 hover:text-red-800"
          >
            {isAr ? 'كيف أفعّل الموقع؟' : 'How do I enable location?'}
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showSteps ? 'rotate-180' : ''}`} aria-hidden />
          </button>
        )}
      </div>
      {isPermissionDenied && !native && showSteps && (
        <div className="space-y-3 rounded-lg bg-white/70 p-3 text-xs text-red-800">
          {sections.map((section) => (
            <div key={section.title || 'steps'} className="space-y-1.5">
              {section.title && <p className="font-bold">{section.title}</p>}
              <ol className="space-y-1.5">
                {section.steps.map((step, i) => (
                  <li key={step} className="flex items-start gap-2 leading-5">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
                      {i + 1}
                    </span>
                    <span className="flex-1"><StepText text={step} /></span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
