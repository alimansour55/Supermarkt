import { Link, Outlet, useLocation } from 'react-router-dom';
import { List, LogOut, Truck } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';

function NavTab({ to, label, icon: Icon, active }) {
  return (
    <Link
      to={to}
      className={[
        'flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition',
        active ? 'text-teal-700' : 'text-slate-500 hover:text-slate-700',
      ].join(' ')}
    >
      <Icon className={`h-5 w-5 ${active ? 'text-teal-600' : ''}`} aria-hidden />
      {label}
    </Link>
  );
}

export default function DriverLayout() {
  const { language } = useLanguage();
  const { user, logout } = useAuth();
  const location = useLocation();
  const isAr = language === 'ar';
  const onList = location.pathname === '/driver' || location.pathname === '/driver/';

  return (
    <div className="flex min-h-screen flex-col bg-slate-100 text-text">
      <header className="sticky top-0 z-30 border-b border-teal-900/10 bg-gradient-to-r from-teal-800 via-teal-700 to-emerald-700 text-white shadow-lg">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20 backdrop-blur">
              <Truck className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">
                {isAr ? 'مندوب التوصيل' : 'Delivery driver'}
              </p>
              <p className="truncate text-xs text-teal-100/90">{user?.name || user?.username}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => logout()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-medium text-white ring-1 ring-white/15 hover:bg-white/20"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden />
            <span>{isAr ? 'خروج' : 'Logout'}</span>
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-4 pb-24">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] backdrop-blur-md">
        <div className="mx-auto flex max-w-lg">
          <NavTab
            to="/driver"
            label={isAr ? 'طلباتي' : 'Deliveries'}
            icon={List}
            active={onList}
          />
        </div>
        <div className="h-[env(safe-area-inset-bottom,0px)]" />
      </nav>
    </div>
  );
}
