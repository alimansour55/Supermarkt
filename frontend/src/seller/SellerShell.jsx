import { useCallback, useEffect, useState } from 'react';
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from '../app/router';
import { LayoutDashboard, LogOut, Package, Store, AlertTriangle, Clock, ClipboardList } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import Loader from '../components/ui/Loader';
import { sellerApi } from '../services/sellerApi';
import { SELLER_STATUS } from './sellerLabels';
import StatusBadge from './StatusBadge';

const SELLER_ROLES = ['seller_owner', 'seller_staff'];

const NAV = [
  { to: '/seller-center', end: true, ar: 'الرئيسية', en: 'Dashboard', Icon: LayoutDashboard },
  { to: '/seller-center/orders', ar: 'الطلبات', en: 'Orders', Icon: ClipboardList },
  { to: '/seller-center/products', ar: 'منتجاتي', en: 'Products', Icon: Package },
  { to: '/seller-center/store', ar: 'بيانات المتجر', en: 'Store profile', Icon: Store },
];

function StatusBanner({ seller, isAr }) {
  if (!seller || seller.status === 'active') return null;
  const copy = {
    applied: {
      ar: 'تم استلام طلبك. أكمل بيانات المتجر وارفع المستندات، وسيراجعها فريقنا قريباً. يمكنك تجهيز منتجاتك كمسودات الآن.',
      en: 'We received your application. Complete your store profile and upload your documents — our team will review them shortly. You can prepare products as drafts meanwhile.',
    },
    under_review: {
      ar: 'طلبك قيد المراجعة. سنُفعّل متجرك فور اعتماده، ويمكنك تجهيز منتجاتك الآن.',
      en: 'Your application is under review. Your store goes live once approved — keep preparing your products.',
    },
    rejected: {
      ar: 'لم يتم اعتماد طلبك. راجع السبب، عدّل بياناتك، ثم أعد الإرسال من صفحة بيانات المتجر.',
      en: 'Your application was not approved. Check the reason, update your details and resubmit from the Store profile page.',
    },
    suspended: {
      ar: 'تم إيقاف متجرك مؤقتاً ومنتجاتك مخفية عن العملاء. تواصل مع فريق الدعم.',
      en: 'Your store is suspended and your products are hidden from customers. Please contact support.',
    },
  }[seller.status];
  const danger = seller.status === 'suspended' || seller.status === 'rejected';
  const Icon = danger ? AlertTriangle : Clock;
  return (
    <div className={`mb-5 flex gap-3 rounded-2xl border p-4 text-sm ${danger ? 'border-red-200 bg-red-50 text-red-900' : 'border-amber-200 bg-amber-50 text-amber-950'}`}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <div>
        <p>{isAr ? copy?.ar : copy?.en}</p>
        {seller.statusReason && (
          <p className="mt-1 font-semibold">{isAr ? 'السبب: ' : 'Reason: '}{seller.statusReason}</p>
        )}
      </div>
    </div>
  );
}

/** Layout route for /seller-center: requires a signed-in seller, loads its profile once. */
export default function SellerShell() {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const { language, toggleLanguage } = useLanguage();
  const isAr = language === 'ar';
  const location = useLocation();
  const navigate = useNavigate();

  const [me, setMe] = useState(null);
  const [loadError, setLoadError] = useState('');

  const isSeller = SELLER_ROLES.includes(user?.role);

  const reload = useCallback(async () => {
    try {
      const { data } = await sellerApi.getMe();
      setMe(data.data);
      setLoadError('');
    } catch (err) {
      setLoadError(err.response?.data?.message || 'Could not load your store');
    }
  }, []);

  useEffect(() => {
    if (isSeller) reload();
  }, [isSeller, reload]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50"><Loader size="lg" /></div>;
  }
  if (!isAuthenticated) {
    return <Navigate to="/seller-center/login" state={{ from: location.pathname }} replace />;
  }
  if (!isSeller) {
    return <Navigate to="/seller-center/login" replace />;
  }

  const seller = me?.seller;

  const signOut = async () => {
    await logout();
    navigate('/seller-center/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900" dir={isAr ? 'rtl' : 'ltr'}>
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            {seller?.logoUrl ? (
              <img src={seller.logoUrl} alt="" className="h-10 w-10 rounded-xl object-cover ring-1 ring-slate-200" />
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white">
                <Store className="h-5 w-5" aria-hidden />
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">
                {seller ? (isAr ? seller.nameAr : seller.nameEn) : (isAr ? 'مركز البائعين' : 'Seller Center')}
              </p>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>{isAr ? 'مركز البائعين' : 'Seller Center'}</span>
                {seller && <StatusBadge map={SELLER_STATUS} value={seller.status} isAr={isAr} />}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleLanguage}
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold hover:bg-slate-50"
            >
              {isAr ? 'EN' : 'ع'}
            </button>
            <button
              type="button"
              onClick={signOut}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold hover:bg-slate-50"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">{isAr ? 'خروج' : 'Sign out'}</span>
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2">
          {NAV.map(({ to, end, ar, en, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => [
                'flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition',
                isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100',
              ].join(' ')}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {isAr ? ar : en}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {loadError && !me ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{loadError}</div>
        ) : !me ? (
          <div className="flex min-h-[40vh] items-center justify-center"><Loader size="lg" /></div>
        ) : (
          <>
            <StatusBanner seller={seller} isAr={isAr} />
            <Outlet context={{ me, seller, reload, isAr }} />
          </>
        )}
      </main>
    </div>
  );
}
