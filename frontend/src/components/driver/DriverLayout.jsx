import { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { ListChecks, Navigation, NavigationOff, UserRound } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../ui/Toast';
import { orderService } from '../../services/apiServices';
import DriverAvailabilityToggle from './DriverAvailabilityToggle';
import UserNotificationBell from '../layout/UserNotificationBell';
import { useDriverShiftLocation } from '../../hooks/useDriverShiftLocation';
import { useWakeLock } from '../../hooks/useWakeLock';
import { DRIVER_DELIVERIES_CHANGED } from './driverEvents';

const CONFIG_REFRESH_MS = 60000;

function initialsOf(name) {
  return (name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase() || '?';
}

function NavTab({ to, end, label, icon: Icon }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => [
        'flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition',
        isActive ? 'text-teal-700' : 'text-slate-400 hover:text-slate-600',
      ].join(' ')}
    >
      {({ isActive }) => (
        <>
          <span
            className={`flex h-8 w-14 items-center justify-center rounded-full transition ${
              isActive ? 'bg-teal-50' : ''
            }`}
          >
            <Icon className="h-5 w-5" aria-hidden />
          </span>
          {label}
        </>
      )}
    </NavLink>
  );
}

export default function DriverLayout() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const toast = useToast();
  const isAr = language === 'ar';

  const [config, setConfig] = useState(null);
  const [availabilityBusy, setAvailabilityBusy] = useState(false);
  // Bumped when a new assignment notice arrives so the deliveries list refetches.
  const [assignmentsVersion, setAssignmentsVersion] = useState(0);

  const loadConfig = useCallback(() => orderService.getDriverConfig()
    .then(({ data }) => setConfig(data.data))
    .catch(() => setConfig((prev) => prev || { availabilityEnabled: false })), []);

  const handleNewNotifications = useCallback((items) => {
    const fresh = items.find((n) => !n.isRead && (n.type === 'driver_assignment' || n.type === 'driver_unassigned'));
    if (!fresh) return;
    setAssignmentsVersion((v) => v + 1);
    loadConfig();
    if (fresh.type === 'driver_assignment') {
      navigator.vibrate?.([200, 100, 200]);
      toast.success(isAr ? fresh.titleAr : fresh.titleEn);
    } else {
      toast.info(isAr ? fresh.titleAr : fresh.titleEn);
    }
  }, [isAr, toast, loadConfig]);

  useEffect(() => {
    loadConfig();
    const iv = setInterval(loadConfig, CONFIG_REFRESH_MS);
    const onChanged = () => loadConfig();
    window.addEventListener(DRIVER_DELIVERIES_CHANGED, onChanged);
    return () => {
      clearInterval(iv);
      window.removeEventListener(DRIVER_DELIVERIES_CHANGED, onChanged);
    };
  }, [loadConfig]);

  // GPS runs for the whole shift while the driver has orders on the road.
  const gpsActive = config?.gpsDeliveryEnabled !== false && (config?.activeDeliveries || 0) > 0;
  const geo = useDriverShiftLocation({ enabled: gpsActive });
  const wakeLockSupported = useWakeLock(gpsActive);

  useEffect(() => {
    if (!gpsActive) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [gpsActive]);

  const setAvailability = useCallback(async (next) => {
    setAvailabilityBusy(true);
    setConfig((prev) => (prev ? { ...prev, driverAvailable: next } : prev));
    try {
      await orderService.setDriverAvailability(next);
      toast.success(
        next
          ? (isAr ? 'أنت متصل الآن' : "You're online")
          : (isAr ? 'أنت غير متصل الآن' : "You're offline"),
      );
    } catch (err) {
      setConfig((prev) => (prev ? { ...prev, driverAvailable: !next } : prev));
      toast.info(err.response?.data?.message || (isAr ? 'تعذّر تحديث الحالة' : 'Could not update status'));
    } finally {
      setAvailabilityBusy(false);
    }
  }, [isAr, toast]);

  const availabilityEnabled = config?.availabilityEnabled === true;
  const isOffline = availabilityEnabled && config?.driverAvailable === false;

  return (
    <div className="flex min-h-screen flex-col bg-slate-100 text-slate-900">
      <header className="sticky top-0 z-30 bg-gradient-to-r from-teal-800 via-teal-700 to-emerald-700 text-white shadow-lg">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-sm font-bold ring-1 ring-white/20">
              {initialsOf(user?.name || user?.username)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold leading-tight">
                {user?.name || user?.username}
              </p>
              <p className="truncate text-xs text-teal-100/90">
                {isAr ? 'مندوب توصيل' : 'Delivery driver'}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <UserNotificationBell
              buttonClassName="text-white hover:bg-white/15"
              panelClassName="fixed inset-x-4 top-[4.5rem] sm:absolute sm:inset-x-auto sm:end-0 sm:top-full sm:mt-2 sm:w-96"
              onNewUnread={handleNewNotifications}
            />
            {availabilityEnabled && (
              <DriverAvailabilityToggle
                available={config?.driverAvailable !== false}
                busy={availabilityBusy}
                onChange={setAvailability}
                isAr={isAr}
                variant="header"
              />
            )}
          </div>
        </div>

        {gpsActive && (
          <div
            className={`flex items-center justify-center gap-1.5 px-4 py-1.5 text-center text-[11px] font-semibold ${
              geo.error ? 'bg-red-500/95 text-white' : 'bg-emerald-900/40 text-emerald-50'
            }`}
            role="status"
          >
            {geo.error ? <NavigationOff className="h-3.5 w-3.5" aria-hidden /> : <Navigation className="h-3.5 w-3.5" aria-hidden />}
            {geo.error
              ? (geo.error === 'denied'
                ? (isAr ? 'الموقع مرفوض — فعّل إذن الموقع للمتصفح' : 'Location blocked — allow location for this app')
                : (isAr ? 'تعذّر إرسال الموقع — جاري المحاولة' : 'Location not sending — retrying'))
              : (isAr
                ? `موقعك يُشارك مع ${config.activeDeliveries} ${config.activeDeliveries === 1 ? 'طلب' : 'طلبات'}`
                : `Sharing location for ${config.activeDeliveries} ${config.activeDeliveries === 1 ? 'delivery' : 'deliveries'}`)}
            {geo.error && (
              <button type="button" onClick={geo.restart} className="ms-1 underline">
                {isAr ? 'إعادة المحاولة' : 'Retry'}
              </button>
            )}
          </div>
        )}

        {isOffline && (
          <div className="bg-amber-400/95 px-4 py-2 text-center text-xs font-semibold text-amber-950">
            {isAr
              ? 'أنت غير متصل — لن تصلك طلبات جديدة حتى تعود متصلاً'
              : "You're offline — new orders won't reach you until you go online"}
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-5 pb-28">
        <Outlet context={{
          config, setAvailability, availabilityBusy, isOffline, assignmentsVersion,
          geo: { ...geo, active: gpsActive, wakeLockSupported },
          refreshConfig: loadConfig,
        }}
        />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl">
          <NavTab to="/driver" end label={isAr ? 'طلباتي' : 'Deliveries'} icon={ListChecks} />
          <NavTab to="/driver/account" label={isAr ? 'حسابي' : 'Account'} icon={UserRound} />
        </div>
        <div className="h-[env(safe-area-inset-bottom,0px)]" />
      </nav>
    </div>
  );
}
