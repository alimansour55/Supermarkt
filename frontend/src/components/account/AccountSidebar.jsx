import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';

const NAV_ITEMS = [
  { to: '/profile', labelAr: 'الملف الشخصي', labelEn: 'Profile', match: ['/profile', '/account'] },
  { to: '/orders', labelAr: 'طلباتي', labelEn: 'My Orders' },
  { to: '/my-points', labelAr: 'نقاطي', labelEn: 'My Points' },
  { to: '/recurring-deliveries', labelAr: 'التوصيل الدوري', labelEn: 'Recurring delivery' },
  { to: '/my-addresses', labelAr: 'العناوين', labelEn: 'Addresses' },
  { to: '/account/settings', labelAr: 'الإعدادات', labelEn: 'Settings' },
];

function isActive(pathname, item) {
  if (item.match) {
    return item.match.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  }
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

export default function AccountSidebar() {
  const { language, t } = useLanguage();
  const isAr = language === 'ar';
  const { pathname } = useLocation();
  const { logout } = useAuth();

  return (
    <aside className="space-y-1">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item);
        return (
          <Link
            key={item.to}
            to={item.to}
            className={`block rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
              active
                ? 'bg-white text-primary-700 shadow-sm'
                : 'text-text hover:bg-white'
            }`}
          >
            {isAr ? item.labelAr : item.labelEn}
          </Link>
        );
      })}
      <button
        type="button"
        onClick={logout}
        className="block w-full rounded-xl px-4 py-2.5 text-start text-sm font-medium text-red-600 hover:bg-red-50"
      >
        {t.nav.logout}
      </button>
    </aside>
  );
}

export function AccountPageLayout({ title, children }) {
  const { t } = useLanguage();

  return (
    <div className="container-app py-8">
      <h1 className="mb-8 text-2xl font-bold md:text-3xl">{title || t.nav.account}</h1>
      <div className="grid gap-8 lg:grid-cols-4">
        <AccountSidebar />
        <div className="lg:col-span-3">{children}</div>
      </div>
    </div>
  );
}
