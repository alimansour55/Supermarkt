import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, ShoppingCart } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useCart } from '../../context/CartContext';
import { APP_NAME, APP_NAME_EN } from '../../utils/constants';
import SearchBar from '../search/SearchBar';
import LocationSelector from './LocationSelector';
import CategoriesDropdown from './CategoriesDropdown';
import AccountMenu from './AccountMenu';
import MobileMenu from './MobileMenu';
import NavMenu from './NavMenu';

export default function Header() {
  const { language, toggleLanguage } = useLanguage();
  const { totalItems, openDrawer } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-50 bg-white shadow-sm">
        <div className="hidden bg-primary-700 text-white md:block">
          <div className="container-app flex items-center justify-between py-2 text-xs">
            <span>
              {language === 'ar' ? 'توصيل خلال ساعتين · مجاني فوق 500 ج.م' : '2h delivery · Free over 500 EGP'}
            </span>
            <div className="flex items-center gap-3">
              <LocationSelector />
              <button
                type="button"
                onClick={toggleLanguage}
                className="rounded-md px-2 py-0.5 font-medium hover:bg-white/10 transition-colors"
              >
                {language === 'ar' ? 'English' : 'العربية'}
              </button>
            </div>
          </div>
        </div>

        <div className="container-app py-2.5 md:py-3">
          <div className="flex items-center gap-2 md:gap-4">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl hover:bg-surface md:hidden"
              aria-label={language === 'ar' ? 'القائمة' : 'Menu'}
            >
              <Menu className="h-6 w-6 text-text" />
            </button>

            <Link to="/" className="flex shrink-0 items-center gap-2">
              <span className="flex h-10 w-10 md:h-11 md:w-11 items-center justify-center rounded-xl bg-primary-600 text-lg font-bold text-white shadow-md">
                +
              </span>
              <div className="leading-tight hidden sm:block">
                <span className="block text-lg font-bold text-primary-700">{APP_NAME}</span>
                <span className="block text-[10px] text-text-muted">{APP_NAME_EN}</span>
              </div>
            </Link>

            <div className="hidden md:block">
              <CategoriesDropdown />
            </div>

            <div className="min-w-0 flex-1">
              <SearchBar />
            </div>

            <div className="hidden md:flex items-center gap-1 sm:gap-2 shrink-0">
              <AccountMenu />
              <button
                type="button"
                onClick={openDrawer}
                className="relative flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-text hover:bg-surface transition-colors min-h-[44px]"
              >
                <ShoppingCart className="h-5 w-5 shrink-0" aria-hidden />
                <span className="hidden sm:inline">{language === 'ar' ? 'السلة' : 'Cart'}</span>
                {totalItems > 0 && (
                  <span className="absolute -top-1 -start-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-500 px-1 text-[10px] font-bold text-white">
                    {totalItems > 99 ? '99+' : totalItems}
                  </span>
                )}
              </button>
            </div>
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
