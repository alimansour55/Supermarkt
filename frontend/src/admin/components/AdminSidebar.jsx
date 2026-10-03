import { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation } from '../../app/router';
import { ChevronDown, ExternalLink, LogOut, X } from 'lucide-react';
import { ADMIN_NAV_GROUPS } from '../adminNavGroups';
import { APP_NAME, APP_NAME_EN } from '../../utils/constants';
import { useAdminStats } from '../context/AdminStatsContext';
import { useAdminPanel } from '../context/AdminPanelContext';
import { useStoreSettings } from '../../context/StoreSettingsContext';
import { hasPermission, roleLabel } from '../adminPermissions';

function resolveBadge(item, stats) {
  const {
    pendingOrdersCount,
    pendingReviewsCount,
    ordersUnreadMessagesCount,
    pendingReturnsCount,
    pendingCallbackRequestsCount,
    pendingLiveChatsCount,
    outOfStockCount,
  } = stats;

  if (item.badgeKey === 'pendingOrders' && pendingOrdersCount > 0) {
    return { value: pendingOrdersCount, variant: 'default' };
  }
  if (item.badgeKey === 'outOfStockCount' && outOfStockCount > 0) {
    return { value: outOfStockCount, variant: 'danger' };
  }
  if (item.badgeKey === 'unreadOrderMessages' && ordersUnreadMessagesCount > 0) {
    return { value: ordersUnreadMessagesCount, variant: 'message' };
  }
  if (item.badgeKey === 'pendingReturns' && pendingReturnsCount > 0) {
    return { value: pendingReturnsCount, variant: 'message' };
  }
  if (item.badgeKey === 'pendingCallbackRequests' && pendingCallbackRequestsCount > 0) {
    return { value: pendingCallbackRequestsCount, variant: 'message' };
  }
  if (item.badgeKey === 'pendingLiveChats' && pendingLiveChatsCount > 0) {
    return { value: pendingLiveChatsCount, variant: 'message' };
  }
  if (item.badgeKey === 'pendingReviews' && pendingReviewsCount > 0) {
    return { value: pendingReviewsCount, variant: 'default' };
  }
  return null;
}

function isPathActive(pathname, itemPath) {
  if (itemPath === '/admin') return pathname === '/admin' || pathname === '/admin/';
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}

function Badge({ badge, isActive, isAr }) {
  if (!badge) return null;
  return (
    <span
      className={[
        'min-w-[1.25rem] rounded-full px-1.5 py-0.5 text-center text-xs font-bold',
        isActive
          ? 'bg-white/20 text-white'
          : badge.variant === 'message'
            ? 'bg-rose-500 text-white'
            : badge.variant === 'danger'
              ? 'bg-red-500 text-white'
              : 'bg-amber-500 text-white',
      ].join(' ')}
      title={
        badge.variant === 'message'
          ? (isAr ? 'يتطلب انتباهاً' : 'Needs attention')
          : undefined
      }
    >
      {badge.value > 99 ? '99+' : badge.value}
    </span>
  );
}

export default function AdminSidebar({
  isAr,
  user,
  open,
  onClose,
  onNavigate,
  onLogout,
  onStore,
}) {
  const location = useLocation();
  const stats = useAdminStats();
  const { showRevenue } = useAdminPanel();
  const { settings } = useStoreSettings();
  const { pendingReviewsCount } = stats;

  const storeName = isAr
    ? (settings?.storeNameAr || APP_NAME)
    : (settings?.storeNameEn || APP_NAME_EN);

  const visibleGroups = useMemo(
    () => ADMIN_NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (!hasPermission(user, item.permission)) return false;
        if (item.requiresRevenue && !showRevenue) return false;
        return true;
      }),
    })).filter((group) => group.items.length > 0),
    [user, showRevenue],
  );

  const activeGroupId = useMemo(() => {
    const match = visibleGroups.find((group) => group.items.some(
      (item) => isPathActive(location.pathname, item.path),
    ));
    return match?.id || 'overview';
  }, [location.pathname, visibleGroups]);

  const [expanded, setExpanded] = useState(() => (
    Object.fromEntries(visibleGroups.map((group) => [group.id, true]))
  ));

  useEffect(() => {
    setExpanded((prev) => {
      const next = { ...prev };
      visibleGroups.forEach((group) => {
        if (group.items.some((item) => isPathActive(location.pathname, item.path))) {
          next[group.id] = true;
        }
      });
      return next;
    });
  }, [location.pathname, visibleGroups]);

  const toggleGroup = (groupId) => {
    setExpanded((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

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
          'fixed inset-y-0 start-0 z-50 flex w-72 flex-col bg-slate-900 text-white shadow-xl transition-transform duration-300 ease-out lg:z-30 lg:translate-x-0',
          open
            ? 'translate-x-0'
            : 'max-lg:-translate-x-full max-lg:rtl:translate-x-full',
        ].join(' ')}
      >
        <div className="flex items-center justify-between border-b border-slate-700 px-5 py-5">
          <div>
            <p className="text-lg font-bold text-primary-400">{storeName}</p>
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

        <nav className="flex-1 overflow-y-auto p-3 scrollbar-thin">
          <div className="space-y-2">
            {visibleGroups.map((group) => {
              const GroupIcon = group.Icon;
              const isOpen = expanded[group.id] ?? group.id === activeGroupId;
              const groupBadgeTotal = group.items.reduce((sum, item) => {
                const badge = resolveBadge(item, stats);
                return sum + (badge?.value || 0);
              }, 0);
              const groupActive = group.items.some(
                (item) => isPathActive(location.pathname, item.path),
              );

              return (
                <section
                  key={group.id}
                  className={[
                    'rounded-xl border transition-colors',
                    groupActive ? 'border-primary-500/30 bg-slate-800/60' : 'border-transparent',
                  ].join(' ')}
                >
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    className={[
                      'flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-start transition-colors',
                      groupActive ? 'text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                    ].join(' ')}
                    aria-expanded={isOpen}
                  >
                    <GroupIcon className="h-4 w-4 shrink-0 text-primary-400" aria-hidden />
                    <span className="flex-1 text-xs font-bold uppercase tracking-wide">
                      {isAr ? group.labelAr : group.labelEn}
                    </span>
                    {groupBadgeTotal > 0 && (
                      <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {groupBadgeTotal > 99 ? '99+' : groupBadgeTotal}
                      </span>
                    )}
                    <ChevronDown
                      className={[
                        'h-4 w-4 shrink-0 text-slate-400 transition-transform',
                        isOpen ? 'rotate-180' : '',
                      ].join(' ')}
                      aria-hidden
                    />
                  </button>

                  {isOpen && (
                    <ul className="space-y-0.5 px-2 pb-2">
                      {group.items.map((item) => {
                        const Icon = item.Icon;
                        const badge = resolveBadge(item, stats);

                        return (
                          <li key={item.path}>
                            <NavLink
                              to={item.path}
                              end={item.path === '/admin'}
                              onClick={onNavigate}
                              className={({ isActive }) => [
                                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                                isActive
                                  ? 'bg-primary-600 text-white shadow-sm'
                                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white',
                              ].join(' ')}
                            >
                              {({ isActive }) => (
                                <>
                                  <Icon
                                    className={['h-4 w-4 shrink-0', isActive ? 'text-white' : 'text-slate-500'].join(' ')}
                                    strokeWidth={isActive ? 2.25 : 2}
                                  />
                                  <span className="flex-1 leading-snug">
                                    {isAr ? item.labelAr : item.labelEn}
                                  </span>
                                  <Badge badge={badge} isActive={isActive} isAr={isAr} />
                                </>
                              )}
                            </NavLink>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-slate-700 p-4">
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-sm font-medium">{user?.name}</p>
            {pendingReviewsCount > 0 && (
              <span
                className="shrink-0 rounded-full bg-amber-500 px-2 py-0.5 text-center text-xs font-bold text-white"
                title={isAr ? 'تقييمات بانتظار الاعتماد' : 'Pending reviews'}
              >
                {pendingReviewsCount > 99 ? '99+' : pendingReviewsCount}
              </span>
            )}
          </div>
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
