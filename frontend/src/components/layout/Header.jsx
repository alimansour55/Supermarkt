import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, ShoppingBag } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useLocation } from '../../context/LocationContext';
import { useStoreSettings } from '../../context/StoreSettingsContext';
import { useAuth } from '../../context/AuthContext';
import { APP_NAME, APP_NAME_EN } from '../../utils/constants';
import SearchBar from '../search/SearchBar';
import LocationSelector from './LocationSelector';
import HeaderToolbar from './HeaderToolbar';
import MobileMenu from './MobileMenu';
import MobileHeaderSearch from './MobileHeaderSearch';
import NavMenu from './NavMenu';
import UserNotificationBell from './UserNotificationBell';

export default function Header() {
  const { language, toggleLanguage } = useLanguage();
  const { location } = useLocation();
  const { settings } = useStoreSettings();
  const { isAuthenticated } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const storeName = language === 'ar'
    ? (settings?.storeNameAr || APP_NAME)
    : (settings?.storeNameEn || APP_NAME_EN);
  const storeSubtitle = language === 'ar'
    ? (settings?.storeNameEn || APP_NAME_EN)
    : (settings?.storeNameAr || APP_NAME);
  const announcement = language === 'ar'
    ? settings?.navigation?.announcementAr
    : settings?.navigation?.announcementEn;
  const freeThreshold = settings?.freeDeliveryThreshold ?? location?.freeDeliveryThreshold ?? 500;
  const deliveryText = announcement || (language === 'ar'
    ? `${location?.estimatedExpress || location?.estimatedScheduled || 'توصيل سريع'} · مجاني فوق ${freeThreshold} ج.م`
    : `${location?.estimatedExpress || location?.estimatedScheduled || 'Fast delivery'} · Free over ${freeThreshold} EGP`);

  return (
    <>
      <header className="sticky top-0 z-50 bg-white shadow-sm">
        <div className="hidden bg-primary-700 text-white md:block">
          <div className="container-app flex items-center justify-between py-2 text-xs">
            <span>{deliveryText}</span>
            <div className="flex items-center gap-3">
              <LocationSelector />
              <button
                type="button"
                onClick={toggleLanguage}
                className="rounded-md px-2 py-0.5 font-medium transition-colors hover:bg-white/10"
              >
                {language === 'ar' ? 'English' : 'العربية'}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile: delivery strip + two-row header */}
        <div className="md:hidden">
          <div className="border-b border-primary-100 bg-primary-50 px-4 py-1.5">
            <p className="truncate text-center text-[11px] font-medium text-primary-800">
              {deliveryText}
            </p>
          </div>
          <div className="container-app py-2.5">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-text transition-colors hover:bg-surface"
                aria-label={language === 'ar' ? 'القائمة' : 'Menu'}
              >
                <Menu className="h-6 w-6" aria-hidden />
              </button>

              <Link to="/" className="flex min-w-0 flex-1 items-center gap-2.5">
                {settings?.logoUrl ? (
                  <img
                    src={settings.logoUrl}
                    alt={storeName}
                    className="h-10 w-10 shrink-0 rounded-xl object-contain"
                  />
                ) : (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-white shadow-md">
                    <ShoppingBag className="h-5 w-5" aria-hidden />
                  </span>
                )}
                <span className="min-w-0 truncate text-base font-bold leading-tight text-primary-700">
                  {storeName}
                </span>
              </Link>

              <LocationSelector variant="mobile" />
              {isAuthenticated && <UserNotificationBell />}
            </div>
            <div className="mt-2.5">
              <MobileHeaderSearch />
            </div>
          </div>
        </div>

        {/* Desktop: single-row header */}
        <div className="container-app hidden py-3 md:block">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex shrink-0 items-center gap-2">
              {settings?.logoUrl ? (
                <img src={settings.logoUrl} alt={storeName} className="h-11 w-11 rounded-xl object-contain" />
              ) : (
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-600 text-white shadow-md">
                  <ShoppingBag className="h-5 w-5" aria-hidden />
                </span>
              )}
              <div className="leading-tight">
                <span className="block text-lg font-bold text-primary-700">{storeName}</span>
                <span className="block text-[10px] text-text-muted">{storeSubtitle}</span>
              </div>
            </Link>

            <HeaderToolbar zone="start" />

            <div className="min-w-0 flex-1">
              <SearchBar />
            </div>

            {isAuthenticated && <UserNotificationBell />}
            <HeaderToolbar zone="end" />
          </div>
        </div>

        <div className="hidden md:block">
          <NavMenu />
        </div>
      </header>

      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}
