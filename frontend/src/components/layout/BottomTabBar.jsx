import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { Home, Search, ShoppingCart, Heart, User } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';

const HIDDEN_PREFIXES = ['/admin', '/checkout', '/payment', '/login', '/register', '/verify-email', '/forgot-password', '/reset-password'];

export default function BottomTabBar() {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const { language } = useLanguage();
  const { totalItems, openDrawer } = useCart();
  const { isAuthenticated } = useAuth();
  const isAr = language === 'ar';

  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  const accountTo = isAuthenticated ? '/profile' : '/login';

  const tabs = [
    { key: 'home', to: '/', Icon: Home, labelAr: 'الرئيسية', labelEn: 'Home' },
    { key: 'search', to: '/search', Icon: Search, labelAr: 'بحث', labelEn: 'Search' },
    { key: 'cart', Icon: ShoppingCart, labelAr: 'السلة', labelEn: 'Cart', action: 'cart' },
    { key: 'favorites', to: '/favorites', Icon: Heart, labelAr: 'المفضلة', labelEn: 'Favorites' },
    { key: 'account', to: accountTo, Icon: User, labelAr: 'حسابي', labelEn: 'Account' },
  ];

  const isActive = (tab) => {
    if (tab.key === 'cart') return false;
    if (tab.key === 'home') return pathname === '/';
    if (tab.key === 'search') {
      return pathname === '/search' || pathname.startsWith('/search/results') || (pathname === '/products' && !!searchParams.get('q'));
    }
    if (tab.key === 'favorites') return pathname === '/favorites';
    if (tab.key === 'account') return pathname === '/profile' || pathname === '/account' || pathname.startsWith('/orders');
    return pathname.startsWith(tab.to);
  };

  const handleCart = (e) => {
    e.preventDefault();
    openDrawer();
  };

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-white/95 backdrop-blur-md md:hidden safe-bottom"
      aria-label={isAr ? 'التنقل السفلي' : 'Bottom navigation'}
    >
      <ul className="flex items-stretch justify-around px-1 pt-1">
        {tabs.map((tab) => {
          const active = isActive(tab);
          const Icon = tab.Icon;
          const label = isAr ? tab.labelAr : tab.labelEn;

          if (tab.action === 'cart') {
            return (
              <li key={tab.key} className="flex-1">
                <button
                  type="button"
                  onClick={handleCart}
                  className={`relative flex w-full flex-col items-center gap-0.5 py-2 min-h-[56px] ${
                    active ? 'text-primary-700' : 'text-text-muted'
                  }`}
                >
                  <span className="relative">
                    <Icon className={`h-6 w-6 ${active ? 'stroke-[2.5px]' : ''}`} aria-hidden />
                    {totalItems > 0 && (
                      <span className="absolute -top-1.5 -end-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-500 px-0.5 text-[9px] font-bold text-white">
                        {totalItems > 99 ? '99+' : totalItems}
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] font-semibold">{label}</span>
                </button>
              </li>
            );
          }

          return (
            <li key={tab.key} className="flex-1">
              <Link
                to={tab.to}
                onClick={(e) => {
                  if (tab.key === 'search' && pathname === '/search') {
                    e.preventDefault();
                  }
                }}
                className={`flex w-full flex-col items-center gap-0.5 py-2 min-h-[56px] ${
                  active ? 'text-primary-700' : 'text-text-muted'
                }`}
              >
                <Icon className={`h-6 w-6 ${active ? 'stroke-[2.5px]' : ''}`} aria-hidden />
                <span className="text-[10px] font-semibold">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
