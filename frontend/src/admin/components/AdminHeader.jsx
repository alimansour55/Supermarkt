import { ChevronLeft, ChevronRight, Menu } from 'lucide-react';
import { Link } from '../../app/router';
import { useLanguage } from '../../context/LanguageContext';
import NotificationBell from './NotificationBell';
import AdminSearchBox from './AdminSearchBox';
import AdminSectionTabs from './AdminSectionTabs';
import { hasPermission } from '../adminPermissions';
import { useAuth } from '../../context/AuthContext';

export default function AdminHeader({ title, breadcrumbs, tabs, activeTabPath, onMenuClick, menuOpen = false }) {
  const { language, toggleLanguage } = useLanguage();
  const { user } = useAuth();
  const isAr = language === 'ar';
  const showNotifications = hasPermission(user, 'notifications:read');
  const parent = breadcrumbs?.[breadcrumbs.length - 1];
  const Back = isAr ? ChevronRight : ChevronLeft;

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-white">
      <div className="flex h-16 items-center gap-3 px-4 lg:px-8">
        <button
          type="button"
          onClick={onMenuClick}
          className="shrink-0 rounded-md p-2 text-text-muted hover:bg-slate-100 hover:text-text lg:hidden"
          aria-label={isAr ? 'فتح القائمة' : 'Open menu'}
          aria-expanded={menuOpen}
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex min-w-0 shrink-0 items-center gap-1.5 sm:max-w-[40%]">
          {parent?.to && (
            <Link
              to={parent.to}
              className="flex shrink-0 items-center gap-0.5 text-sm text-text-muted hover:text-primary-600"
            >
              <Back className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">{parent.label}</span>
              <span className="hidden text-slate-300 sm:inline">/</span>
            </Link>
          )}
          <h1 className="truncate text-base font-semibold text-text sm:text-lg">{title}</h1>
        </div>

        <div className="min-w-0 flex-1">
          <AdminSearchBox isAr={isAr} className="ms-auto w-full max-w-md" />
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {showNotifications && <NotificationBell isAr={isAr} />}
          <button
            type="button"
            onClick={toggleLanguage}
            className="rounded-md px-2.5 py-2 text-sm font-medium text-text-muted hover:bg-slate-100 hover:text-text"
            aria-label={isAr ? 'Switch to English' : 'التبديل إلى العربية'}
          >
            {isAr ? 'EN' : 'ع'}
          </button>
        </div>
      </div>

      {tabs?.length > 1 && (
        <div className="px-4 lg:px-8">
          <AdminSectionTabs tabs={tabs} activePath={activeTabPath} isAr={isAr} />
        </div>
      )}
    </header>
  );
}
