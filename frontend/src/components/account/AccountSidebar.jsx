import { Link, Outlet, useLocation } from '../../app/router';
import { Heart, LayoutGrid, LogOut, MapPin, RefreshCw, Settings, Sparkles, ShoppingBag, Wallet } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';

const NAV_ITEMS = [
  { to: '/profile', Icon: LayoutGrid, labelAr: 'حسابي', labelEn: 'My account', exact: ['/profile', '/account'] },
  { to: '/orders', Icon: ShoppingBag, labelAr: 'طلباتي', labelEn: 'My orders' },
  { to: '/my-points', Icon: Sparkles, labelAr: 'نقاطي', labelEn: 'My points' },
  { to: '/my-wallet', Icon: Wallet, labelAr: 'المحفظة', labelEn: 'My wallet' },
  { to: '/favorites', Icon: Heart, labelAr: 'المفضلة', labelEn: 'Favorites' },
  { to: '/recurring-deliveries', Icon: RefreshCw, labelAr: 'التوصيل الدوري', labelEn: 'Recurring delivery' },
  { to: '/my-addresses', Icon: MapPin, labelAr: 'عناويني', labelEn: 'My addresses' },
  { to: '/account/settings', Icon: Settings, labelAr: 'الإعدادات', labelEn: 'Settings' },
];

function isActive(pathname, item) {
  // Items with `exact` match only those literal paths (so /account/settings does
  // not also light up "حسابي").
  if (item.exact) return item.exact.includes(pathname);
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

export default function AccountSidebar() {
  const { language, t } = useLanguage();
  const isAr = language === 'ar';
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const firstName = user?.name?.trim().split(/\s+/)[0] || (isAr ? 'بك' : 'there');

  return (
    <aside className="lg:sticky lg:top-24 lg:self-start">
      <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-border bg-primary-50/70 p-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-600 text-lg font-bold text-white">
            {user?.name?.charAt(0)?.toUpperCase() || '?'}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-text">
              {isAr ? `مرحباً، ${firstName}` : `Hi, ${firstName}`} <span aria-hidden>👋</span>
            </p>
            <p className="truncate text-xs text-text-muted" dir="ltr">
              {user?.phoneDisplay || user?.phone}
            </p>
          </div>
        </div>

        <nav className="p-2">
          {NAV_ITEMS.map(({ to, Icon, labelAr, labelEn, exact }) => {
            const active = isActive(pathname, { to, exact });
            return (
              <Link
                key={to}
                to={to}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  active ? 'bg-primary-600 text-white shadow-sm' : 'text-text hover:bg-primary-50'
                }`}
              >
                <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? 'text-white' : 'text-primary-600'}`} aria-hidden />
                {isAr ? labelAr : labelEn}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={logout}
            className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start text-sm font-medium text-red-600 hover:bg-red-50"
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" aria-hidden />
            {t.nav.logout}
          </button>
        </nav>
      </div>
    </aside>
  );
}

/**
 * Layout route for the whole account area — keeps ONE persistent sidebar mounted
 * while the child page swaps in the <Outlet />. Guests (e.g. on /favorites) get
 * the plain container with no sidebar.
 */
export function AccountLayout() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return (
      <div className="container-app py-6 md:py-8">
        <Outlet />
      </div>
    );
  }

  return (
    <div className="container-app py-6 md:py-8">
      <div className="grid items-start gap-6 lg:grid-cols-[260px_1fr] lg:gap-8">
        <AccountSidebar />
        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

/** Per-page wrapper: just the heading block above the page content. */
export function AccountPageLayout({ title, subtitle, children }) {
  return (
    <div className="min-w-0">
      {(title || subtitle) && (
        <header className="mb-5">
          {title && <h1 className="text-2xl font-bold text-text md:text-3xl">{title}</h1>}
          {subtitle && <p className="mt-1 text-sm text-text-muted">{subtitle}</p>}
        </header>
      )}
      {children}
    </div>
  );
}
