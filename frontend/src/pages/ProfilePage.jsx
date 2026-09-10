import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, MapPin, Package, Pencil, ShoppingBag } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { orderService, loyaltyService, walletService } from '../services/apiServices';
import { AccountPageLayout } from '../components/account/AccountSidebar';
import { formatPrice, formatDate } from '../utils/formatters';
import { formatOrderNumber } from '../utils/orderNumber';
import { getOrderStatusLabel, getOrderStatusColor } from '../utils/orderStatus';

const ADDRESS_LABELS = {
  Home: { ar: 'المنزل', en: 'Home' },
  Work: { ar: 'العمل', en: 'Work' },
  Other: { ar: 'أخرى', en: 'Other' },
};

function addressLabelText(address, isAr) {
  const preset = ADDRESS_LABELS[address.label];
  if (preset) return isAr ? preset.ar : preset.en;
  return address.label || (isAr ? 'عنوان' : 'Address');
}

function formatAddressLine(address, isAr) {
  return [address.street, address.building, address.floor, address.area || address.city, address.governorate]
    .filter(Boolean)
    .join(isAr ? '، ' : ', ');
}

function SectionCard({ title, action, children }) {
  return (
    <section className="rounded-2xl border border-border bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-bold text-text sm:text-lg">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function InfoRow({ label, value, ltr }) {
  return (
    <div>
      <dt className="text-xs font-medium text-text-muted">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-text" dir={ltr ? 'ltr' : undefined}>
        {value}
      </dd>
    </div>
  );
}

export default function ProfilePage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { user } = useAuth();
  const [orders, setOrders] = useState(null);
  const [loyalty, setLoyalty] = useState(null);
  const [wallet, setWallet] = useState(null);
  const locale = isAr ? 'ar-EG' : 'en-US';

  useEffect(() => {
    let active = true;
    orderService
      .getMyOrders()
      .then(({ data }) => {
        if (active) setOrders(data.orders || []);
      })
      .catch(() => {
        if (active) setOrders([]);
      });
    loyaltyService
      .getMe(language)
      .then(({ data }) => {
        if (active) setLoyalty(data);
      })
      .catch(() => {});
    walletService
      .getMe(language)
      .then(({ data }) => {
        if (active) setWallet(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [language]);

  const latestOrder = useMemo(() => {
    if (!orders?.length) return null;
    return [...orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
  }, [orders]);

  const addresses = user?.addresses || [];
  const primaryAddress = addresses.find((a) => a.isDefault) || addresses[0];

  return (
    <AccountPageLayout
      title={isAr ? 'نظرة عامة' : 'Overview'}
      subtitle={isAr ? `مرحباً، ${user?.name || ''} 👋` : `Welcome back, ${user?.name || ''} 👋`}
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          <Link
            to="/orders"
            className="rounded-2xl border border-border bg-white p-4 shadow-sm transition-colors hover:border-primary-300"
          >
            <p className="text-xs text-text-muted">{isAr ? 'الطلبات' : 'Orders'}</p>
            <p className="mt-1 text-2xl font-bold text-text tabular-nums">{orders ? orders.length : '—'}</p>
          </Link>
          <Link
            to="/my-points"
            className="rounded-2xl border border-border bg-white p-4 shadow-sm transition-colors hover:border-primary-300"
          >
            <p className="text-xs text-text-muted">{isAr ? 'نقاطي' : 'My points'}</p>
            <p className="mt-1 text-2xl font-bold text-text tabular-nums">
              {loyalty?.pointsBalance ?? user?.pointsBalance ?? 0}
            </p>
          </Link>
          {(wallet?.settings?.enabled ?? true) !== false && (
            <Link
              to="/my-wallet"
              className="rounded-2xl border border-border bg-white p-4 shadow-sm transition-colors hover:border-primary-300"
            >
              <p className="text-xs text-text-muted">{isAr ? 'المحفظة' : 'Wallet'}</p>
              <p className="mt-1 text-2xl font-bold text-text tabular-nums" dir="ltr">
                {formatPrice(wallet?.walletBalance ?? user?.walletBalance ?? 0)}
              </p>
            </Link>
          )}
        </div>

        <SectionCard
          title={isAr ? 'المعلومات الشخصية' : 'Personal information'}
          action={
            <Link
              to="/account/settings"
              className="inline-flex items-center gap-1 text-sm font-semibold text-primary-700 hover:text-primary-800"
            >
              <Pencil className="h-4 w-4" aria-hidden />
              {isAr ? 'تحرير المعلومات' : 'Edit info'}
            </Link>
          }
        >
          <dl className="grid gap-4 sm:grid-cols-3">
            <InfoRow label={isAr ? 'الاسم الكامل' : 'Full name'} value={user?.name || '—'} />
            <InfoRow
              label={isAr ? 'البريد الإلكتروني' : 'Email'}
              value={user?.email || (isAr ? 'غير مضاف' : 'Not added')}
              ltr={Boolean(user?.email)}
            />
            <InfoRow
              label={isAr ? 'رقم الهاتف' : 'Phone number'}
              value={user?.phoneDisplay || user?.phone || '—'}
              ltr
            />
          </dl>
        </SectionCard>

        <SectionCard
          title={isAr ? 'أحدث طلب' : 'Latest order'}
          action={
            orders?.length ? (
              <Link to="/orders" className="text-sm font-semibold text-primary-700 hover:text-primary-800">
                {isAr ? 'كل الطلبات' : 'All orders'}
              </Link>
            ) : null
          }
        >
          {orders === null ? (
            <div className="h-20 animate-pulse rounded-xl bg-slate-100" />
          ) : latestOrder ? (
            <Link
              to={`/orders/${latestOrder._id}`}
              className="flex items-center gap-4 rounded-xl border border-border p-4 transition-colors hover:border-primary-300 hover:bg-primary-50/40"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                <Package className="h-6 w-6" strokeWidth={1.5} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-bold text-text">
                    {formatOrderNumber(latestOrder.orderNumber)}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${getOrderStatusColor(
                      latestOrder.orderStatus || latestOrder.status,
                    )}`}
                  >
                    {getOrderStatusLabel(latestOrder.orderStatus || latestOrder.status, isAr)}
                  </span>
                </span>
                <span className="mt-1 block text-xs text-text-muted">
                  {formatDate(latestOrder.createdAt, locale)}
                </span>
              </span>
              <span className="shrink-0 text-end">
                <span className="block text-sm font-bold text-primary-800">{formatPrice(latestOrder.total)}</span>
                <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-primary-700">
                  {isAr ? 'التفاصيل' : 'Details'}
                  <ChevronLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
                </span>
              </span>
            </Link>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-slate-50 px-4 py-8 text-center">
              <p className="text-sm text-text-muted">
                {isAr
                  ? 'لا توجد طلبات حتى الآن! ابدأ التسوق الآن وقدّم طلبك الأول.'
                  : 'No orders yet! Start shopping and place your first order.'}
              </p>
              <Link
                to="/products"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-800"
              >
                <ShoppingBag className="h-4 w-4" aria-hidden />
                {isAr ? 'تصفح المنتجات' : 'Browse products'}
              </Link>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title={isAr ? 'العناوين المحفوظة' : 'Saved addresses'}
          action={
            <Link
              to="/my-addresses"
              className="inline-flex items-center gap-1 text-sm font-semibold text-primary-700 hover:text-primary-800"
            >
              <MapPin className="h-4 w-4" aria-hidden />
              {isAr ? 'إدارة العناوين' : 'Manage addresses'}
            </Link>
          }
        >
          {primaryAddress ? (
            <div className="rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-text">{addressLabelText(primaryAddress, isAr)}</p>
                {primaryAddress.isDefault && (
                  <span className="rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-bold text-primary-700">
                    {isAr ? 'افتراضي' : 'Default'}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-text-muted">{formatAddressLine(primaryAddress, isAr)}</p>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-slate-50 px-4 py-8 text-center">
              <p className="text-sm text-text-muted">{isAr ? 'لا توجد عناوين محفوظة' : 'No saved addresses'}</p>
              <Link
                to="/my-addresses"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-800"
              >
                {isAr ? 'إضافة عنوان' : 'Add address'}
              </Link>
            </div>
          )}
        </SectionCard>
      </div>
    </AccountPageLayout>
  );
}
