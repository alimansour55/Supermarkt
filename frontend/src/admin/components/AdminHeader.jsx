import { Menu, Languages } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import AdminBreadcrumbs from './AdminBreadcrumbs';
import NotificationBell from './NotificationBell';
import AdminSearchBox from './AdminSearchBox';
import { hasPermission } from '../adminPermissions';
import { useAuth } from '../../context/AuthContext';

export default function AdminHeader({ title, breadcrumbs, onMenuClick, menuOpen = false }) {
  const { language, toggleLanguage } = useLanguage();
  const { user } = useAuth();
  const isAr = language === 'ar';
  const showNotifications = hasPermission(user, 'notifications:read');

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-white shadow-sm">
      <div className="flex items-start gap-3 px-4 py-3 lg:px-8 lg:py-4">
        <button
          type="button"
          onClick={onMenuClick}
          className="mt-0.5 shrink-0 rounded-lg border border-border p-2 text-text-muted transition-colors hover:bg-slate-50 hover:text-text lg:hidden"
          aria-label={isAr ? 'فتح القائمة' : 'Open menu'}
          aria-expanded={menuOpen}
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="min-w-0 shrink-0 sm:max-w-[40%] lg:max-w-[30%]">
          <AdminBreadcrumbs items={breadcrumbs} className="mb-1 hidden sm:flex" />
          <h1 className="truncate text-lg font-semibold text-text sm:text-xl">{title}</h1>
          <AdminBreadcrumbs items={breadcrumbs} className="mt-1 sm:hidden" />
        </div>

        <div className="min-w-0 flex-1 self-center">
          <AdminSearchBox isAr={isAr} className="mx-auto w-full max-w-2xl" />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {showNotifications && <NotificationBell isAr={isAr} />}

          <button
            type="button"
            onClick={toggleLanguage}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-slate-50 hover:text-text"
            aria-label={isAr ? 'Switch to English' : 'التبديل إلى العربية'}
          >
            <Languages className="h-4 w-4" />
            <span className="hidden sm:inline">{isAr ? 'English' : 'العربية'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
