import { useEffect, useState } from 'react';
import { BellRing, BellOff } from 'lucide-react';
import { disableDriverPush, enableDriverPush, getDriverPushState } from '../../utils/driverPush';

/**
 * Phone notifications for new assignments (Web Push). Hidden when the browser can't do
 * push or the store hasn't configured it. `variant="banner"` is the compact nudge for
 * the deliveries list, shown only while notifications are off.
 */
export default function DriverPushToggle({ isAr, variant = 'card' }) {
  const [state, setState] = useState('loading');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    getDriverPushState()
      .then((s) => { if (alive) setState(s); })
      .catch(() => { if (alive) setState('unsupported'); });
    return () => { alive = false; };
  }, []);

  if (['loading', 'unsupported', 'disabled'].includes(state)) return null;
  if (variant === 'banner' && state !== 'off') return null;

  const toggle = async () => {
    setBusy(true);
    try {
      setState(state === 'on' ? await disableDriverPush() : await enableDriverPush());
    } catch {
      setState('off');
    } finally {
      setBusy(false);
    }
  };

  if (variant === 'banner') {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className="flex w-full items-center gap-3 rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-start text-sm text-teal-900 disabled:opacity-60"
      >
        <BellRing className="h-5 w-5 shrink-0 text-teal-700" aria-hidden />
        <span className="flex-1">
          {isAr ? 'فعّل إشعارات الهاتف لتصلك الطلبات الجديدة حتى والتطبيق مغلق.' : 'Turn on phone notifications so new orders reach you even when the app is closed.'}
        </span>
        <span className="font-semibold underline">{isAr ? 'تفعيل' : 'Turn on'}</span>
      </button>
    );
  }

  const on = state === 'on';
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm">
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${on ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-500'}`}>
        {on ? <BellRing className="h-5 w-5" aria-hidden /> : <BellOff className="h-5 w-5" aria-hidden />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900">{isAr ? 'إشعارات الهاتف' : 'Phone notifications'}</p>
        <p className="text-xs text-slate-500">
          {state === 'denied'
            ? (isAr ? 'مرفوضة من المتصفح — فعّلها من إعدادات الموقع.' : 'Blocked by the browser — allow them in site settings.')
            : on
              ? (isAr ? 'مفعّلة على هذا الجهاز' : 'On for this device')
              : (isAr ? 'تنبيه فوري بالطلبات الجديدة' : 'Instant alerts for new orders')}
        </p>
      </div>
      {state !== 'denied' && (
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          className={`rounded-xl px-3 py-2 text-xs font-semibold disabled:opacity-60 ${on ? 'bg-slate-100 text-slate-700' : 'bg-teal-600 text-white'}`}
        >
          {on ? (isAr ? 'إيقاف' : 'Turn off') : (isAr ? 'تفعيل' : 'Turn on')}
        </button>
      )}
    </div>
  );
}
