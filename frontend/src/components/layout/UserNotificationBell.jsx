import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from '../../app/router';
import { Bell, ChevronLeft, MapPin, Package, Truck } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { notificationService } from '../../services/apiServices';
import { formatRelativeTime } from '../../utils/formatters';
import {
  getUserNotificationActionLabel,
  getUserNotificationHref,
  notificationShowsOrderNumber,
} from '../../utils/userNotification';

const TYPE_ICONS = {
  order_status: Package,
  order_driver_assigned: Truck,
  order_tracking_live: MapPin,
  order_driver_location: MapPin,
  order_eta_update: Truck,
};

function notificationIconClass(type) {
  if (type === 'order_eta_update') return 'bg-emerald-100 text-emerald-700';
  if (type === 'order_tracking_live' || type === 'order_driver_location') return 'bg-indigo-100 text-indigo-700';
  if (type === 'order_driver_assigned') return 'bg-sky-100 text-sky-700';
  return 'bg-primary-100 text-primary-700';
}

export default function UserNotificationBell() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { isAuthenticated } = useAuth();
  const isAr = language === 'ar';
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef(null);

  const load = useCallback(() => {
    if (!isAuthenticated) return;
    notificationService.getAll({ limit: 15 })
      .then(({ data }) => {
        setItems(data.data || []);
        setUnreadCount(data.unreadCount ?? 0);
      })
      .catch(() => {});
  }, [isAuthenticated]);

  useEffect(() => {
    load();
    if (!isAuthenticated) return undefined;
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [load, isAuthenticated]);

  useEffect(() => {
    if (!open) return undefined;
    const onClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  if (!isAuthenticated) return null;

  const handleMarkAllRead = async () => {
    setLoading(true);
    try {
      await notificationService.markAllRead();
      load();
    } finally {
      setLoading(false);
    }
  };

  const handleOpenNotification = async (notification) => {
    const href = getUserNotificationHref(notification);
    if (!notification.isRead) {
      try {
        await notificationService.markRead(notification._id);
        setUnreadCount((c) => Math.max(0, c - 1));
        setItems((prev) => prev.map((n) => (
          n._id === notification._id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
        )));
      } catch {
        /* navigation should still work */
      }
    }
    setOpen(false);
    navigate(href);
  };

  const title = (n) => (isAr ? n.titleAr : n.titleEn);
  const message = (n) => (isAr ? n.messageAr : n.messageEn);

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-11 w-11 items-center justify-center rounded-xl text-text transition-colors hover:bg-surface"
        aria-label={isAr ? 'إشعارات الطلبات' : 'Order notifications'}
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -start-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute end-0 top-full z-[60] mt-2 w-80 overflow-hidden rounded-xl border border-border bg-white shadow-xl sm:w-96">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-text">
              {isAr ? 'إشعارات الطلبات' : 'Order updates'}
            </h2>
            {unreadCount > 0 && (
              <button
                type="button"
                disabled={loading}
                onClick={handleMarkAllRead}
                className="text-xs font-medium text-primary-600 hover:underline disabled:opacity-50"
              >
                {isAr ? 'تعليم الكل كمقروء' : 'Mark all read'}
              </button>
            )}
          </div>

          <ul className="max-h-80 overflow-y-auto" role="list">
            {items.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-text-muted">
                {isAr ? 'لا توجد إشعارات' : 'No notifications'}
              </li>
            ) : (
              items.map((n) => {
                const Icon = TYPE_ICONS[n.type] || Bell;
                const actionLabel = getUserNotificationActionLabel(n, isAr);
                const showOrderNumber = notificationShowsOrderNumber(n);

                return (
                  <li key={n._id} className="border-b border-border last:border-0">
                    <button
                      type="button"
                      onClick={() => handleOpenNotification(n)}
                      className={`group flex w-full gap-3 px-4 py-3 text-start transition-colors hover:bg-primary-50/80 focus-visible:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-300 ${!n.isRead ? 'bg-primary-50/40' : ''}`}
                    >
                      <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${notificationIconClass(n.type)}`}>
                        <Icon className="h-4 w-4" />
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className={`text-sm font-semibold ${n.isRead ? 'text-text-muted' : 'text-text'}`}>
                            {title(n)}
                          </p>
                          {showOrderNumber && (
                            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-600">
                              #{n.data.orderNumber}
                            </span>
                          )}
                          {!n.isRead && (
                            <span className="h-2 w-2 shrink-0 rounded-full bg-primary-500" aria-hidden />
                          )}
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-text-muted">
                          {message(n)}
                        </p>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <p className="text-[10px] text-text-muted">
                            {formatRelativeTime(n.createdAt, isAr)}
                          </p>
                          <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-primary-600 group-hover:text-primary-700">
                            {actionLabel}
                            <ChevronLeft
                              className={`h-3.5 w-3.5 transition-transform group-hover:translate-x-[-2px] ${isAr ? '' : 'rotate-180'}`}
                              aria-hidden
                            />
                          </span>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
