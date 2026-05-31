import { NavLink } from 'react-router-dom';
import { ExternalLink, LogOut, X } from 'lucide-react';
import { ADMIN_NAV } from '../adminConstants';
import { APP_NAME, APP_NAME_EN } from '../../utils/constants';
import { useAdminStats } from '../context/AdminStatsContext';
import { hasPermission, roleLabel } from '../adminPermissions';

export default function AdminSidebar({
  isAr,
  user,
  open,
  onClose,
  onNavigate,
  onLogout,
  onStore,
}) {
  const { pendingOrdersCount } = useAdminStats();

  return (
    <>
      <button
        type="button"
        aria-label={isAr ? 'إغلاق القائمة' : 'Close menu'}
        className={[
          'fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm transition-opacity lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        ].join(' ')}
        onClick={onClose}
      />

      <aside
        className={[
          'fixed inset-y-0 start-0 z-50 flex w-64 flex-col bg-slate-900 text-white shadow-xl transition-transform duration-300 ease-out lg:z-30 lg:translate-x-0',
          open
            ? 'translate-x-0'
            : 'max-lg:-translate-x-full max-lg:rtl:translate-x-full',
        ].join(' ')}
      >
        <div className="flex items-center justify-between border-b border-slate-700 px-5 py-5">
          <div>
            <p className="text-lg font-bold text-primary-400">{isAr ? APP_NAME : APP_NAME_EN}</p>
            <p className="text-xs text-slate-400">{isAr ? 'لوحة الإدارة' : 'Admin Panel'}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
            aria-label={isAr ? 'إغلاق' : 'Close'}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-4 scrollbar-thin">
          {ADMIN_NAV.filter((item) => hasPermission(user?.role, item.permission)).map((item) => {
            const Icon = item.Icon;
            const badge =
              item.badgeKey === 'pendingOrders' && pendingOrdersCount > 0
                ? pendingOrdersCount
                : null;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/admin'}
                onClick={onNavigate}
                className={({ isActive }) => [
                  'flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                ].join(' ')}
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={['h-5 w-5 shrink-0', isActive ? 'text-white' : 'text-slate-400'].join(' ')}
                      strokeWidth={isActive ? 2.25 : 2}
                    />
                    <span className="flex-1">{isAr ? item.labelAr : item.labelEn}</span>
                    {badge != null && (
                      <span
                        className={[
                          'min-w-[1.25rem] rounded-full px-1.5 py-0.5 text-center text-xs font-bold',
                          isActive ? 'bg-white/20 text-white' : 'bg-amber-500 text-white',
                        ].join(' ')}
                      >
                        {badge > 99 ? '99+' : badge}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-slate-700 p-4">
          <p className="truncate text-sm font-medium">{user?.name}</p>
          <p className="truncate text-xs text-slate-400">{user?.email || user?.phone}</p>
          {user?.role && (
            <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-primary-400">
              {roleLabel(user.role, isAr)}
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={onStore}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-slate-800 px-3 py-2 text-xs font-medium hover:bg-slate-700"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {isAr ? 'المتجر' : 'Store'}
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-600/90 px-3 py-2 text-xs font-medium hover:bg-red-600"
            >
              <LogOut className="h-3.5 w-3.5" />
              {isAr ? 'خروج' : 'Logout'}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
