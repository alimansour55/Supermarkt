import { Link } from '../../app/router';
import { ExternalLink, LogOut, X } from 'lucide-react';
import { APP_NAME, APP_NAME_EN } from '../../utils/constants';
import { useAdminStats } from '../context/AdminStatsContext';
import { useStoreSettings } from '../../context/StoreSettingsContext';
import { roleLabel } from '../adminPermissions';
import { itemScreens } from '../adminNavGroups';
import useAdminNav from '../hooks/useAdminNav';

const BADGE_STATS = {
  pendingOrders: 'pendingOrdersCount',
  pendingReturns: 'pendingReturnsCount',
  unreadOrderMessages: 'ordersUnreadMessagesCount',
  pendingLiveChats: 'pendingLiveChatsCount',
  pendingCallbackRequests: 'pendingCallbackRequestsCount',
  outOfStockCount: 'outOfStockCount',
  pendingReviews: 'pendingReviewsCount',
  pendingSellers: 'pendingSellersCount',
  pendingListings: 'pendingListingsCount',
};

export function badgeCount(entry, stats) {
  if (!entry.badgeKey) return 0;
  return Number(stats[BADGE_STATS[entry.badgeKey]]) || 0;
}

/** Total waiting across all of an item's screens. */
export function itemBadgeCount(item, stats) {
  return itemScreens(item).reduce((sum, screen) => sum + badgeCount(screen, stats), 0);
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
  const stats = useAdminStats();
  const { settings } = useStoreSettings();
  const { nav, current } = useAdminNav();

  const storeName = isAr
    ? (settings?.storeNameAr || APP_NAME)
    : (settings?.storeNameEn || APP_NAME_EN);

  const activeId = current?.item?.id;
  const pinned = nav.filter((group) => group.id === 'settings');
  const scrolling = nav.filter((group) => group.id !== 'settings');

  const renderItem = (item) => {
    const Icon = item.Icon;
    const isActive = item.id === activeId;
    const count = itemBadgeCount(item, stats);
    return (
      <li key={item.id}>
        <Link
          to={item.path}
          onClick={onNavigate}
          aria-current={isActive ? 'page' : undefined}
          className={[
            'flex items-center gap-3 rounded-md px-3 py-[7px] text-sm transition-colors',
            isActive
              ? 'bg-slate-800 font-semibold text-white'
              : 'hover:bg-slate-800/60 hover:text-white',
          ].join(' ')}
        >
          <Icon
            className={['h-[18px] w-[18px] shrink-0', isActive ? 'text-primary-400' : 'text-slate-500'].join(' ')}
            strokeWidth={1.75}
          />
          <span className="flex-1 truncate">{isAr ? item.labelAr : item.labelEn}</span>
          {count > 0 && (
            <span className="min-w-[1.25rem] rounded-full bg-primary-500/90 px-1.5 text-center text-[11px] font-semibold leading-5 text-white">
              {count > 99 ? '99+' : count}
            </span>
          )}
        </Link>
      </li>
    );
  };

  return (
    <>
      <button
        type="button"
        aria-label={isAr ? 'إغلاق القائمة' : 'Close menu'}
        className={[
          'fixed inset-0 z-40 bg-slate-900/50 transition-opacity lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        ].join(' ')}
        onClick={onClose}
      />

      <aside
        className={[
          'fixed inset-y-0 start-0 z-50 flex w-64 flex-col border-e border-slate-800 bg-slate-900 text-slate-300 transition-transform duration-200 lg:z-30 lg:translate-x-0',
          open
            ? 'translate-x-0'
            : 'max-lg:-translate-x-full max-lg:rtl:translate-x-full',
        ].join(' ')}
      >
        <div className="flex h-16 items-center justify-between px-5">
          <Link to="/admin" onClick={onNavigate} className="truncate text-base font-bold text-white">
            {storeName}
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
            aria-label={isAr ? 'إغلاق' : 'Close'}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4 scrollbar-thin">
          {scrolling.map((group) => (
            <div key={group.id} className="mt-4 first:mt-1">
              {(isAr ? group.labelAr : group.labelEn) && (
                <p className="mb-1 px-3 text-[11px] font-medium text-slate-500">
                  {isAr ? group.labelAr : group.labelEn}
                </p>
              )}
              <ul className="space-y-px">{group.items.map(renderItem)}</ul>
            </div>
          ))}
        </nav>

        {pinned.length > 0 && (
          <ul className="border-t border-slate-800 px-3 py-2">
            {pinned.flatMap((group) => group.items).map(renderItem)}
          </ul>
        )}

        <div className="border-t border-slate-800 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-700 text-sm font-semibold text-white">
              {(user?.name || '?').trim().charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{user?.name}</p>
              {user?.role && (
                <p className="truncate text-xs text-slate-500">{roleLabel(user.role, isAr)}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onStore}
              title={isAr ? 'فتح المتجر' : 'Open store'}
              aria-label={isAr ? 'فتح المتجر' : 'Open store'}
              className="rounded-md p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <ExternalLink className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onLogout}
              title={isAr ? 'تسجيل الخروج' : 'Log out'}
              aria-label={isAr ? 'تسجيل الخروج' : 'Log out'}
              className="rounded-md p-2 text-slate-400 hover:bg-slate-800 hover:text-red-400"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
