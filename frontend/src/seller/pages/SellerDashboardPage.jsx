import { useEffect, useState } from 'react';
import { Link, useOutletContext } from '../../app/router';
import { AlertTriangle, Banknote, Bell, CheckCircle2, ClipboardList, Clock, FileEdit, PackageX, Plus, Truck } from 'lucide-react';
import { formatPrice } from '../../utils/formatters';
import Loader from '../../components/ui/Loader';
import { sellerApi } from '../../services/sellerApi';

function Stat({ icon: Icon, label, value, tone, to }) {
  const body = (
    <article className="h-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Icon className={`h-5 w-5 ${tone}`} aria-hidden />
        {label}
      </div>
      <p className="mt-3 text-3xl font-extrabold">{Number(value || 0).toLocaleString()}</p>
    </article>
  );
  return to ? <Link to={to} className="block">{body}</Link> : body;
}

function Notifications({ isAr }) {
  const [items, setItems] = useState(null);
  useEffect(() => {
    sellerApi.getNotifications({ limit: 6 }).then(({ data }) => {
      setItems(data.data || []);
      if (data.unreadCount) sellerApi.markNotificationsRead().catch(() => {});
    }).catch(() => setItems([]));
  }, []);
  if (!items?.length) return null;
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <h2 className="flex items-center gap-2 border-b border-slate-100 px-5 py-3 font-bold"><Bell className="h-4 w-4 text-slate-500" />{isAr ? 'آخر التنبيهات' : 'Latest updates'}</h2>
      <ul className="divide-y divide-slate-100">
        {items.map((n) => (
          <li key={n._id}>
            <Link to={n.link?.startsWith('/seller-center') ? n.link : '/seller-center'} className={`block px-5 py-3 text-sm hover:bg-slate-50 ${n.readAt ? '' : 'bg-indigo-50/40'}`}>
              <p className="font-semibold">{isAr ? n.titleAr : n.titleEn}</p>
              <p className="text-slate-600">{isAr ? n.messageAr : n.messageEn}</p>
              <p className="mt-0.5 text-xs text-slate-400">{new Date(n.createdAt).toLocaleString(isAr ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function SellerDashboardPage() {
  const { seller, me, isAr } = useOutletContext();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    sellerApi.getDashboard().then(({ data }) => setStats(data.data)).catch(() => setStats({}));
  }, []);

  if (!stats) return <div className="flex min-h-[30vh] items-center justify-center"><Loader size="lg" /></div>;

  const listings = stats.listings || {};
  const missingDocs = !(seller.documents || []).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{isAr ? `أهلاً، ${me.user.name}` : `Welcome, ${me.user.name}`}</h1>
          <p className="text-sm text-slate-500">
            {isAr
              ? `العمولة الافتراضية ${me.marketplace.defaultCommissionRate}% · تُتاح الأرباح للسحب بعد ${me.marketplace.payoutHoldDays} يوماً من التسليم`
              : `Default commission ${me.marketplace.defaultCommissionRate}% · earnings become payable ${me.marketplace.payoutHoldDays} days after delivery`}
          </p>
        </div>
        <Link
          to="/seller-center/products/new"
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" aria-hidden />
          {isAr ? 'إضافة منتج' : 'Add product'}
        </Link>
      </div>

      {seller.status !== 'active' && missingDocs && (
        <Link to="/seller-center/store" className="flex items-center gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900 hover:bg-indigo-100">
          <FileEdit className="h-5 w-5 shrink-0" aria-hidden />
          {isAr ? 'ارفع السجل التجاري والبطاقة الضريبية لتسريع مراجعة طلبك ←' : 'Upload your commercial register and tax card to speed up your review →'}
        </Link>
      )}

      {stats.orders && (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat icon={ClipboardList} tone="text-amber-600" label={isAr ? 'طلبات بانتظار التأكيد' : 'Orders to confirm'} value={stats.orders.toConfirm} to="/seller-center/orders?status=pending" />
          <Stat icon={Truck} tone="text-indigo-600" label={isAr ? 'جاهزة للشحن' : 'Ready to ship'} value={stats.orders.toShip} to="/seller-center/orders?status=confirmed" />
          <Stat icon={Truck} tone="text-violet-600" label={isAr ? 'في الطريق' : 'In transit'} value={stats.orders.inTransit} to="/seller-center/orders?status=shipped" />
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Banknote className="h-5 w-5 text-emerald-600" aria-hidden />
              {isAr ? 'مبيعات آخر 30 يوماً' : 'Sales, last 30 days'}
            </div>
            <p className="mt-3 text-2xl font-extrabold">{formatPrice(stats.last30Days?.gross || 0)}</p>
            <p className="text-xs text-slate-500">
              {isAr ? `صافي ${formatPrice(stats.last30Days?.net || 0)} · ${stats.last30Days?.orders || 0} طلب` : `net ${formatPrice(stats.last30Days?.net || 0)} · ${stats.last30Days?.orders || 0} orders`}
            </p>
          </article>
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={CheckCircle2} tone="text-emerald-600" label={isAr ? 'منتجات معروضة' : 'Live products'} value={listings.approved} to="/seller-center/products?listingStatus=approved" />
        <Stat icon={Clock} tone="text-amber-600" label={isAr ? 'بانتظار المراجعة' : 'Waiting for review'} value={(listings.pending_review || 0) + (stats.pendingEdits || 0)} to="/seller-center/products?listingStatus=pending_review" />
        <Stat icon={AlertTriangle} tone="text-red-600" label={isAr ? 'مرفوضة — تحتاج تعديل' : 'Rejected — needs changes'} value={listings.rejected} to="/seller-center/products?listingStatus=rejected" />
        <Stat icon={PackageX} tone="text-orange-600" label={isAr ? 'نفد المخزون' : 'Out of stock'} value={stats.outOfStock} />
      </section>

      <Notifications isAr={isAr} />

      <section className="grid gap-4 sm:grid-cols-3">
        <Stat icon={FileEdit} tone="text-slate-500" label={isAr ? 'مسودات' : 'Drafts'} value={listings.draft} to="/seller-center/products?listingStatus=draft" />
        <Stat icon={PackageX} tone="text-amber-500" label={isAr ? 'مخزون منخفض (≤ 5)' : 'Low stock (≤ 5)'} value={stats.lowStock} />
        <Stat icon={Clock} tone="text-slate-500" label={isAr ? 'متوقفة مؤقتاً' : 'Paused'} value={listings.paused} to="/seller-center/products?listingStatus=paused" />
      </section>
    </div>
  );
}
