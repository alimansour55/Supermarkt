import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, ShoppingBag } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useStoreSettings } from '../../context/StoreSettingsContext';
import { useAuth } from '../../context/AuthContext';
import { APP_NAME, APP_NAME_EN } from '../../utils/constants';
import SearchBar from '../search/SearchBar';
import LocationSelector from './LocationSelector';
import HeaderToolbar from './HeaderToolbar';
import MobileMenu from './MobileMenu';
import MobileHeaderSearch from './MobileHeaderSearch';
import NavMenu from './NavMenu';
import DeliverySlotStrip from './DeliverySlotStrip';
import UserNotificationBell from './UserNotificationBell';

export default function Header() {
  const { language, toggleLanguage, t } = useLanguage();
  const { settings } = useStoreSettings();
  const { isAuthenticated } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const storeName = language === 'ar'
    ? (settings?.storeNameAr || APP_NAME)
    : (settings?.storeNameEn || APP_NAME_EN);

  const renderLogo = ({ compact = false } = {}) => (
    <Link
      to="/"
      className={`flex min-w-0 items-center ${compact ? 'gap-2' : 'gap-2.5'} ${compact ? '' : 'shrink-0'}`}
      aria-label={storeName}
    >
      {settings?.logoUrl ? (
        <img
          src={settings.logoUrl}
          alt={storeName}
          className={`w-auto max-w-full object-contain ${compact ? 'h-9' : 'h-11'}`}
        />
      ) : (
        <>
          <span
            className={`flex shrink-0 items-center justify-center rounded-2xl bg-primary-600 text-white shadow-sm ${
              compact ? 'h-9 w-9' : 'h-11 w-11'
            }`}
          >
            <ShoppingBag className={compact ? 'h-5 w-5' : 'h-6 w-6'} aria-hidden />
          </span>
          <span
            className={`min-w-0 truncate py-0.5 font-black leading-[1.75] tracking-tight text-primary-700 ${
              compact ? 'text-lg' : 'text-[26px]'
            }`}
          >
            {storeName}
          </span>
        </>
      )}
    </Link>
  );

  return (
    <>
      {/* Tier 1 — utility bar (desktop only, scrolls away on scroll) */}
      <div className="hidden bg-primary-800 text-white md:block">
        <div className="container-app flex h-9 items-center justify-between text-xs">
          <LocationSelector />
          <div className="flex items-center gap-3">
            <Link to="/contact" className="text-white/85 transition-colors hover:text-white">
              {t.nav.customerService}
            </Link>
            <span className="h-3.5 w-px bg-white/25" aria-hidden />
            <button
              type="button"
              onClick={toggleLanguage}
              className="font-semibold text-white/85 transition-colors hover:text-white"
            >
              {t.nav.switchLanguage}
            </button>
          </div>
        </div>
      </div>

      {/* Sticky cluster — tiers 2 + 3 stay pinned */}
      <header className="sticky top-0 z-50 bg-white shadow-card">
        <div>
          {/* Tier 2 — main header (desktop). Grid keeps the wordmark dead-centre
              with symmetric breathing room on both sides. */}
          <div className="container-app hidden py-3.5 md:block">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <div className="flex w-full min-w-0 justify-self-start">
                <SearchBar className="w-full max-w-[340px] lg:max-w-[460px] xl:max-w-[560px]" />
              </div>
              <div className="justify-self-center px-4 lg:px-10">
                {renderLogo()}
              </div>
              <div className="flex min-w-0 items-center justify-self-end gap-0.5">
                {isAuthenticated && <UserNotificationBell />}
                <HeaderToolbar zone="end" />
              </div>
            </div>
          </div>

          {/* Tier 3 — category nav (desktop) */}
          <div className="hidden md:block">
            <NavMenu />
          </div>

          {/* Mobile header — two rows */}
          <div className="md:hidden">
            <div className="container-app py-2.5">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setMenuOpen(true)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-field text-primary-700 transition-colors hover:bg-primary-50"
                  aria-label={language === 'ar' ? 'القائمة' : 'Menu'}
                >
                  <Menu className="h-6 w-6" aria-hidden />
                </button>

                <div className="min-w-0 flex-1">{renderLogo({ compact: true })}</div>

                {isAuthenticated && <UserNotificationBell />}
                <LocationSelector variant="mobile" />
              </div>
              <div className="mt-2.5">
                <MobileHeaderSearch />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ETA strip — below the sticky header, scrolls away on scroll */}
      <DeliverySlotStrip />

      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}
