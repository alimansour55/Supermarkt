import { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { ListChecks, UserRound } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../ui/Toast';
import { orderService } from '../../services/apiServices';
import DriverAvailabilityToggle from './DriverAvailabilityToggle';

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

  useEffect(() => {
    let mounted = true;
    orderService.getDriverConfig()
      .then(({ data }) => { if (mounted) setConfig(data.data); })
      .catch(() => { if (mounted) setConfig({ availabilityEnabled: false }); });
    return () => { mounted = false; };
  }, []);

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

        {isOffline && (
          <div className="bg-amber-400/95 px-4 py-2 text-center text-xs font-semibold text-amber-950">
            {isAr
              ? 'أنت غير متصل — لن تصلك طلبات جديدة حتى تعود متصلاً'
              : "You're offline — new orders won't reach you until you go online"}
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-5 pb-28">
        <Outlet context={{ config, setAvailability, availabilityBusy, isOffline }} />
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
