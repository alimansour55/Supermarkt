import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  X, Truck, User, ClipboardList, Globe, RefreshCw, Gift, Headphones,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import LocationSelector from './LocationSelector';
import { useAuth } from '../../context/AuthContext';
import { useStoreSettings } from '../../context/StoreSettingsContext';
import MobileShopNav from './MobileShopNav';

export default function MobileMenu({ open, onClose }) {
  const { language, toggleLanguage } = useLanguage();
  const { isAuthenticated } = useAuth();
  const { settings } = useStoreSettings();
  const isAr = language === 'ar';

  const freeThreshold = settings?.freeDeliveryThreshold ?? 500;
  const announcement = isAr
    ? settings?.navigation?.announcementAr
    : settings?.navigation?.announcementEn;
  const deliveryBanner = announcement || (isAr
    ? `توصيل سريع · مجاني فوق ${freeThreshold} ج.م`
    : `Fast delivery · Free over ${freeThreshold} EGP`);

  const nav = settings?.navigation || {};
  const serviceLabel = isAr
    ? (nav.topBarServiceLabelAr || 'خدمة العملاء')
    : (nav.topBarServiceLabelEn || 'Customer service');
  const serviceHref = nav.topBarServiceHref || '/contact';

  const accountLinks = isAuthenticated
    ? [
      { to: '/profile', Icon: User, labelAr: 'حسابي', labelEn: 'My account' },
      { to: '/orders', Icon: ClipboardList, labelAr: 'طلباتي', labelEn: 'My orders' },
      { to: '/recurring-deliveries', Icon: RefreshCw, labelAr: 'التوصيل الدوري', labelEn: 'Recurring delivery' },
      { to: '/my-points', Icon: Gift, labelAr: 'نقاطي', labelEn: 'My points' },
    ]
    : [
      { to: '/login', Icon: User, labelAr: 'تسجيل الدخول', labelEn: 'Sign in' },
    ];

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] md:hidden" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-black/45"
        onClick={onClose}
        aria-label={isAr ? 'إغلاق' : 'Close'}
      />

      <div className="absolute inset-y-0 start-0 flex w-[min(100%,320px)] flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-4">
          <h2 className="text-lg font-bold text-text">
            {isAr ? 'القائمة' : 'Menu'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-surface"
            aria-label={isAr ? 'إغلاق' : 'Close'}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="mb-5 flex items-center gap-2 rounded-xl bg-primary-50 px-3 py-2.5 text-sm font-medium text-primary-800">
            <Truck className="h-4 w-4 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1">{deliveryBanner}</span>
          </div>

          <MobileShopNav onClose={onClose} />

          <section className="mb-6">
            <h3 className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-text-muted">
              {isAr ? 'حسابي' : 'Account'}
            </h3>
            <nav className="space-y-0.5">
              {accountLinks.map((link) => {
                const Icon = link.Icon;
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={onClose}
                    className="flex items-center gap-3 rounded-xl px-3 py-3 text-base font-semibold text-text transition-colors hover:bg-surface"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface text-primary-700">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    {isAr ? link.labelAr : link.labelEn}
                  </Link>
                );
              })}
            </nav>
          </section>

          <section className="mb-6">
            <LocationSelector variant="menu" onSelected={onClose} />
          </section>

          <section className="mb-6">
            <h3 className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-text-muted">
              {isAr ? 'الدعم' : 'Support'}
            </h3>
            <nav className="space-y-0.5">
              <Link
                to={serviceHref}
                onClick={onClose}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-base font-semibold text-text transition-colors hover:bg-surface"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface text-primary-700">
                  <Headphones className="h-5 w-5" aria-hidden />
                </span>
                {serviceLabel}
              </Link>
            </nav>
          </section>
        </div>

        <div className="border-t border-border p-4 safe-bottom">
          <button
            type="button"
            onClick={toggleLanguage}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm font-semibold text-text transition-colors hover:bg-surface"
          >
            <Globe className="h-4 w-4 text-primary-600" aria-hidden />
            {isAr ? 'English' : 'العربية'}
          </button>
        </div>
      </div>
    </div>
  );
}
