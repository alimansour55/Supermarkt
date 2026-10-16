import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, Outlet, useLocation, useNavigate } from '../app/router';
import { AlertTriangle, Clock, Palmtree } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import Loader from '../components/ui/Loader';
import { sellerApi } from '../services/sellerApi';
import { visibleNav } from './sellerNav';
import SellerSidebar from './layout/SellerSidebar';
import SellerTopbar from './layout/SellerTopbar';
import SellerShortcuts from './layout/SellerShortcuts';
import { PageSkeleton } from './ui';
import ForcePasswordChange from './settings/ForcePasswordChange';

const SELLER_ROLES = ['seller_owner', 'seller_staff'];
const COLLAPSE_KEY = 'sellerCenter.sidebarCollapsed';

function VacationBanner({ seller, isAr }) {
  if (!seller?.vacation?.enabled) return null;
  return (
    <Link to="/seller-center/store/vacation" className="mb-5 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950 hover:bg-emerald-100">
      <Palmtree className="h-5 w-5 shrink-0" aria-hidden />
      <span className="flex-1">{isAr ? 'متجرك في وضع الإجازة — منتجاتك مخفية عن العملاء.' : 'Your store is on vacation — your products are hidden from customers.'}</span>
      <span className="font-semibold">{isAr ? 'إدارة' : 'Manage'}</span>
    </Link>
  );
}

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
  const [summary, setSummary] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; }
  });
  const lastSummaryAt = useRef(0);
  // <Navigate> re-runs whenever `state` changes identity — keep it stable or it loops.
  const loginState = useMemo(() => ({ from: location.pathname }), [location.pathname]);

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

  /** Menu badges — refreshed on navigation (at most every 20 s) and every 2 minutes. */
  const refreshSummary = useCallback(async ({ force = true } = {}) => {
    if (!force && Date.now() - lastSummaryAt.current < 20_000) return;
    lastSummaryAt.current = Date.now();
    try {
      const { data } = await sellerApi.getSummary();
      setSummary(data.data);
    } catch { /* badges are optional */ }
  }, []);

  useEffect(() => {
    if (isSeller) reload();
  }, [isSeller, reload]);

  useEffect(() => {
    if (!isSeller) return undefined;
    refreshSummary({ force: false });
    return undefined;
  }, [isSeller, refreshSummary, location.pathname]);

  useEffect(() => {
    if (!isSeller) return undefined;
    const timer = setInterval(() => { if (!document.hidden) refreshSummary(); }, 120_000);
    return () => clearInterval(timer);
  }, [isSeller, refreshSummary]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((v) => {
      try { localStorage.setItem(COLLAPSE_KEY, v ? '0' : '1'); } catch { /* private mode */ }
      return !v;
    });
  }, []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50"><Loader size="lg" /></div>;
  }
  if (!isAuthenticated) {
    return <Navigate to="/seller-center/login" state={loginState} replace />;
  }
  if (!isSeller) {
    return <Navigate to="/seller-center/login" replace />;
  }

  const seller = me?.seller;
  const nav = visibleNav({
    isOwner: me?.user?.role === 'seller_owner',
    storeFulfillment: Boolean(seller?.allowedFulfillment?.includes('store')),
    permissions: me?.user?.permissions || [],
  });

  const signOut = async () => {
    await logout();
    navigate('/seller-center/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900" dir={isAr ? 'rtl' : 'ltr'}>
      {me && <SellerShortcuts isAr={isAr} />}
      {me && (
        <SellerSidebar
          nav={nav}
          summary={summary}
          isAr={isAr}
          seller={seller}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
          mobileOpen={mobileOpen}
          onCloseMobile={closeMobile}
        />
      )}
      <div className={`flex min-h-screen min-w-0 flex-col transition-[padding] duration-200 ${me ? (collapsed ? 'lg:ps-[4.5rem]' : 'lg:ps-64') : ''}`}>
        {me && (
          <SellerTopbar
            me={me}
            seller={seller}
            isAr={isAr}
            summary={summary}
            onOpenMenu={() => setMobileOpen(true)}
            onSignOut={signOut}
            onToggleLanguage={toggleLanguage}
            refreshSummary={refreshSummary}
          />
        )}
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
          {loadError && !me ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{loadError}</div>
          ) : !me ? (
            <PageSkeleton />
          ) : me.user?.mustChangePassword ? (
            <ForcePasswordChange isAr={isAr} onDone={reload} />
          ) : (
            <>
              <StatusBanner seller={seller} isAr={isAr} />
              <VacationBanner seller={seller} isAr={isAr} />
              <Outlet context={{ me, seller, reload, isAr, summary, refreshSummary }} />
            </>
          )}
        </main>
      </div>
    </div>
  );
}
