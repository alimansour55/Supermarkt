import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from '../../app/router';
import {
  Bell, ChevronDown, ClipboardList, HelpCircle, Keyboard, Languages, LogOut, Menu, Package, Plus, Search, Settings, Users,
} from 'lucide-react';
import { sellerApi } from '../../services/sellerApi';
import { formatPrice } from '../../utils/formatters';
import { LISTING_STATUS, SELLER_STATUS, SHIPMENT_STATUS } from '../sellerLabels';
import StatusBadge from '../StatusBadge';

/** Close a popover on outside click or Escape. */
function useDismiss(open, setOpen) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open, setOpen]);
  return ref;
}

/** Search products (name, SKU, barcode) and orders (number) from anywhere. "/" focuses it. */
function QuickSearch({ isAr }) {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState(null);
  const ref = useDismiss(open, setOpen);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setResult(null); return undefined; }
    const timer = setTimeout(() => {
      sellerApi.search(term).then(({ data }) => setResult(data.data)).catch(() => setResult(null));
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);

  const go = (to) => { setOpen(false); setQ(''); navigate(to); };
  const empty = result && !result.products.length && !result.orders.length;

  return (
    <div ref={ref} className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && q.trim()) go(`/seller-center/products?q=${encodeURIComponent(q.trim())}`);
        }}
        placeholder={isAr ? 'ابحث عن منتج، SKU، أو رقم طلب…' : 'Search products, SKU or order number…'}
        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pe-10 ps-9 text-sm focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
        aria-label={isAr ? 'بحث' : 'Search'}
      />
      <kbd className="pointer-events-none absolute end-3 top-1/2 hidden -translate-y-1/2 rounded border border-slate-200 bg-white px-1.5 text-[10px] text-slate-400 sm:block">/</kbd>
      {open && result && (
        <div className="absolute inset-x-0 top-full z-50 mt-2 max-h-[70vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
          {empty && <p className="px-3 py-4 text-center text-sm text-slate-500">{isAr ? 'لا توجد نتائج' : 'No results'}</p>}
          {result.products.length > 0 && (
            <>
              <p className="flex items-center gap-1.5 px-3 pb-1 pt-2 text-[11px] font-bold uppercase text-slate-400"><Package className="h-3.5 w-3.5" />{isAr ? 'المنتجات' : 'Products'}</p>
              {result.products.map((p) => (
                <button key={p._id} type="button" onClick={() => go(`/seller-center/products/${p._id}`)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-start hover:bg-slate-50">
                  {p.image ? <img src={p.image} alt="" className="h-9 w-9 rounded-lg object-cover" /> : <span className="h-9 w-9 rounded-lg bg-slate-100" />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{isAr ? p.nameAr : p.nameEn}</span>
                    <span className="block text-xs text-slate-500" dir="ltr">{p.sku} · {formatPrice(p.price)}</span>
                  </span>
                  <StatusBadge map={LISTING_STATUS} value={p.listingStatus} isAr={isAr} />
                </button>
              ))}
            </>
          )}
          {result.orders.length > 0 && (
            <>
              <p className="flex items-center gap-1.5 px-3 pb-1 pt-2 text-[11px] font-bold uppercase text-slate-400"><ClipboardList className="h-3.5 w-3.5" />{isAr ? 'الطلبات' : 'Orders'}</p>
              {result.orders.map((o) => (
                <button key={o._id} type="button" onClick={() => go(`/seller-center/orders/${o._id}`)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-start hover:bg-slate-50">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium" dir="ltr">{o.shipmentNumber}</span>
                    <span className="block text-xs text-slate-500">{formatPrice(o.subtotal)}</span>
                  </span>
                  <StatusBadge map={SHIPMENT_STATUS} value={o.status} isAr={isAr} />
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function NotificationsMenu({ isAr, unread, onRead }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(null);
  const ref = useDismiss(open, setOpen);

  useEffect(() => {
    if (!open) return;
    sellerApi.getNotifications({ limit: 8 }).then(({ data }) => setItems(data.data || [])).catch(() => setItems([]));
  }, [open]);

  const markAll = async () => {
    await sellerApi.markNotificationsRead().catch(() => {});
    setItems((prev) => (prev || []).map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })));
    onRead();
  };

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} className="relative rounded-xl p-2 text-slate-600 hover:bg-slate-100" aria-label={isAr ? 'الإشعارات' : 'Notifications'} aria-expanded={open}>
        <Bell className="h-5 w-5" />
        {unread > 0 && <span className="absolute end-1 top-1 min-w-[1.1rem] rounded-full bg-red-500 px-1 text-center text-[10px] font-bold leading-[1.1rem] text-white">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="absolute end-0 top-full z-50 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="font-bold">{isAr ? 'الإشعارات' : 'Notifications'}</p>
            {unread > 0 && <button type="button" onClick={markAll} className="text-xs font-semibold text-indigo-700 hover:underline">{isAr ? 'تحديد الكل كمقروء' : 'Mark all read'}</button>}
          </div>
          <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
            {items === null && <li className="px-4 py-6 text-center text-sm text-slate-400">…</li>}
            {items?.length === 0 && <li className="px-4 py-8 text-center text-sm text-slate-500">{isAr ? 'لا توجد إشعارات' : 'No notifications yet'}</li>}
            {items?.map((n) => (
              <li key={n._id}>
                <Link
                  to={n.link?.startsWith('/seller-center') ? n.link : '/seller-center/notifications'}
                  onClick={() => { setOpen(false); if (!n.readAt) sellerApi.markNotificationRead(n._id).then(onRead).catch(() => {}); }}
                  className={`flex gap-3 px-4 py-3 text-sm hover:bg-slate-50 ${n.readAt ? '' : 'bg-indigo-50/50'}`}
                >
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.readAt ? 'bg-transparent' : 'bg-indigo-500'}`} aria-hidden />
                  <span className="min-w-0">
                    <span className="block font-semibold">{isAr ? n.titleAr : n.titleEn}</span>
                    <span className="line-clamp-2 block text-slate-600">{isAr ? n.messageAr : n.messageEn}</span>
                    <span className="mt-0.5 block text-[11px] text-slate-400">{new Date(n.createdAt).toLocaleString(isAr ? 'ar-EG-u-nu-latn' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Link to="/seller-center/notifications" onClick={() => setOpen(false)} className="block border-t border-slate-100 py-2.5 text-center text-sm font-semibold text-indigo-700 hover:bg-slate-50">
            {isAr ? 'عرض كل الإشعارات' : 'See all notifications'}
          </Link>
        </div>
      )}
    </div>
  );
}

function AccountMenu({ me, seller, isAr, onSignOut, onToggleLanguage }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, setOpen);
  const isOwner = me.user.role === 'seller_owner';
  const initials = (me.user.name || '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const item = 'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-slate-50';
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 rounded-xl p-1 pe-2 hover:bg-slate-100" aria-expanded={open}>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">{initials}</span>
        <span className="hidden text-start md:block">
          <span className="block max-w-[9rem] truncate text-sm font-semibold leading-tight">{me.user.name}</span>
          <span className="block text-[11px] leading-tight text-slate-500">{isOwner ? (isAr ? 'مالك المتجر' : 'Store owner') : (isAr ? 'موظف' : 'Staff')}</span>
        </span>
        <ChevronDown className="hidden h-4 w-4 text-slate-400 md:block" aria-hidden />
      </button>
      {open && (
        <div className="absolute end-0 top-full z-50 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
          <div className="border-b border-slate-100 px-3 pb-3 pt-1">
            <p className="truncate text-sm font-bold">{me.user.name}</p>
            <p className="truncate text-xs text-slate-500" dir="ltr">{me.user.email}</p>
            {seller && <div className="mt-2"><StatusBadge map={SELLER_STATUS} value={seller.status} isAr={isAr} /></div>}
          </div>
          <div className="py-1">
            <Link to="/seller-center/store" onClick={() => setOpen(false)} className={item}><Settings className="h-4 w-4 text-slate-400" />{isAr ? 'إعدادات المتجر' : 'Store settings'}</Link>
            {isOwner && <Link to="/seller-center/store/team" onClick={() => setOpen(false)} className={item}><Users className="h-4 w-4 text-slate-400" />{isAr ? 'فريق العمل' : 'Team & logins'}</Link>}
            <Link to="/seller-center/help" onClick={() => setOpen(false)} className={item}><HelpCircle className="h-4 w-4 text-slate-400" />{isAr ? 'مركز المساعدة' : 'Help center'}</Link>
            <button type="button" onClick={() => { setOpen(false); window.dispatchEvent(new KeyboardEvent('keydown', { key: '?' })); }} className={item}><Keyboard className="h-4 w-4 text-slate-400" />{isAr ? 'اختصارات لوحة المفاتيح' : 'Keyboard shortcuts'}<kbd className="ms-auto rounded border border-slate-200 px-1 text-[10px] text-slate-400">?</kbd></button>
            <button type="button" onClick={() => { setOpen(false); onToggleLanguage(); }} className={item}><Languages className="h-4 w-4 text-slate-400" />{isAr ? 'English' : 'العربية'}</button>
          </div>
          <div className="border-t border-slate-100 pt-1">
            <button type="button" onClick={onSignOut} className={`${item} text-red-600 hover:bg-red-50`}><LogOut className="h-4 w-4" />{isAr ? 'تسجيل الخروج' : 'Sign out'}</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SellerTopbar({ me, seller, isAr, summary, onOpenMenu, onSignOut, onToggleLanguage, refreshSummary }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-slate-200 bg-white/95 px-3 backdrop-blur sm:gap-3 sm:px-5">
      <button type="button" onClick={onOpenMenu} className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 lg:hidden" aria-label={isAr ? 'فتح القائمة' : 'Open menu'}>
        <Menu className="h-5 w-5" />
      </button>
      <QuickSearch isAr={isAr} />
      <div className="ms-auto flex items-center gap-1 sm:gap-2">
        <Link to="/seller-center/products/new" className="hidden items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 sm:inline-flex">
          <Plus className="h-4 w-4" aria-hidden />{isAr ? 'إضافة منتج' : 'Add product'}
        </Link>
        <button type="button" onClick={onToggleLanguage} className="hidden rounded-xl px-2.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 sm:block" aria-label={isAr ? 'English' : 'العربية'}>
          {isAr ? 'EN' : 'ع'}
        </button>
        <NotificationsMenu isAr={isAr} unread={summary?.unreadNotifications || 0} onRead={refreshSummary} />
        <AccountMenu me={me} seller={seller} isAr={isAr} onSignOut={onSignOut} onToggleLanguage={onToggleLanguage} />
      </div>
    </header>
  );
}

