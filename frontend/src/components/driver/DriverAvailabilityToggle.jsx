import { Loader2, Power } from 'lucide-react';

/**
 * Online / offline switch for a delivery driver.
 * `variant="header"` renders a compact pill for the dark app header;
 * `variant="panel"` renders a full-width control for the account screen.
 */
export default function DriverAvailabilityToggle({
  available,
  busy = false,
  onChange,
  variant = 'header',
  isAr = false,
}) {
  const label = available
    ? (isAr ? 'متصل' : 'Online')
    : (isAr ? 'غير متصل' : 'Offline');

  if (variant === 'header') {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={() => onChange(!available)}
        aria-pressed={available}
        className={[
          'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ring-1 transition disabled:opacity-60',
          available
            ? 'bg-emerald-400/20 text-emerald-50 ring-emerald-300/40'
            : 'bg-white/10 text-white/80 ring-white/20',
        ].join(' ')}
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <span className="relative flex h-2.5 w-2.5">
            {available && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
            )}
            <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${available ? 'bg-emerald-300' : 'bg-white/50'}`} />
          </span>
        )}
        {label}
      </button>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${
            available ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'
          }`}
        >
          <Power className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <p className="text-sm font-bold text-slate-900">{label}</p>
          <p className="text-xs text-slate-500">
            {available
              ? (isAr ? 'تستلم الطلبات الجديدة تلقائياً' : 'New orders can be routed to you')
              : (isAr ? 'لن تصلك طلبات جديدة' : "New orders won't be routed to you")}
          </p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={available}
        disabled={busy}
        onClick={() => onChange(!available)}
        className={[
          'relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-60',
          available ? 'bg-emerald-500' : 'bg-slate-300',
        ].join(' ')}
      >
        <span
          className={[
            'absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all',
            available ? 'start-[22px]' : 'start-0.5',
            busy ? 'animate-pulse' : '',
          ].join(' ')}
        />
      </button>
    </div>
  );
}
