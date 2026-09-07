import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, MessageCircle, Package, ShoppingCart } from 'lucide-react';
import { adminApi } from '../adminApi';
import { formatRelativeTime } from '../../utils/formatters';

const TYPE_ICONS = {
  new_order: ShoppingCart,
  low_stock: Package,
  order_customer_message: MessageCircle,
};

function notificationIconClass(type) {
  if (type === 'low_stock') return 'bg-amber-100 text-amber-700';
  if (type === 'order_customer_message') return 'bg-rose-100 text-rose-700';
  return 'bg-primary-100 text-primary-700';
}

export default function NotificationBell({ isAr, onUnreadChange }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef(null);

  const load = useCallback(() => {
    adminApi.getNotifications({ limit: 15 })
      .then(({ data }) => {
        setItems(data.data || []);
        setUnreadCount(data.unreadCount ?? 0);
        onUnreadChange?.(data.unreadCount ?? 0);
      })
      .catch(() => {});
  }, [onUnreadChange]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 45_000);
    return () => clearInterval(interval);
  }, [load]);

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

  const handleMarkAllRead = async () => {
    setLoading(true);
    try {
      await adminApi.markAllNotificationsRead();
      load();
    } finally {
      setLoading(false);
    }
  };

  const handleMarkRead = async (id) => {
    await adminApi.markNotificationRead(id);
    load();
  };

  const title = (n) => (isAr ? n.titleAr : n.titleEn);
  const message = (n) => (isAr ? n.messageAr : n.messageEn);

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-lg border border-border p-2 text-text-muted transition-colors hover:bg-slate-50 hover:text-text"
        aria-label={isAr ? 'الإشعارات' : 'Notifications'}
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -end-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute end-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-border bg-white shadow-xl sm:w-96">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-text">
              {isAr ? 'الإشعارات' : 'Notifications'}
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

          <ul className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-text-muted">
                {isAr ? 'لا توجد إشعارات' : 'No notifications'}
              </li>
            ) : (
              items.map((n) => {
                const Icon = TYPE_ICONS[n.type] || Bell;
                const content = (
                  <div className="flex gap-3">
                    <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${notificationIconClass(n.type)}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium ${n.isRead ? 'text-text-muted' : 'text-text'}`}>
                        {title(n)}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-text-muted">{message(n)}</p>
                      <p className="mt-1 text-[10px] text-text-muted">
                        {formatRelativeTime(n.createdAt, isAr)}
                      </p>
                    </div>
                    {!n.isRead && (
                      <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary-500" />
                    )}
                  </div>
                );

                return (
                  <li key={n._id} className="border-b border-border last:border-0">
                    {n.link ? (
                      <Link
                        to={n.link}
                        onClick={() => {
                          if (!n.isRead) handleMarkRead(n._id);
                          setOpen(false);
                        }}
                        className="block px-4 py-3 transition-colors hover:bg-slate-50"
                      >
                        {content}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => !n.isRead && handleMarkRead(n._id)}
                        className="block w-full px-4 py-3 text-start transition-colors hover:bg-slate-50"
                      >
                        {content}
                      </button>
                    )}
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
