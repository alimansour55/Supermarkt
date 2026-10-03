import { ChevronUp, Phone, Mail, Clock, Apple, Play } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { useStoreSettings } from '../../context/StoreSettingsContext';
import { APP_NAME, APP_NAME_EN } from '../../utils/constants';
import { isStaffRole } from '../../admin/adminPermissions';
import { scrollToTop } from '../../utils/scrollToTop';
import { SOCIAL_PATHS, PAYMENT_META } from './regions/socialPaths';
import {
  DEFAULT_FOOTER_LEGAL_LINKS,
  DEFAULT_FOOTER_PAYMENT_METHODS,
  footerSectionEnabled,
} from '../../utils/footerConfig';

function BrandIcon({ path, className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden focusable="false">
      <path d={path} />
    </svg>
  );
}

/** A payment badge — Visa / Mastercard keep their bespoke glyphs, the rest are
 *  neutral white chips so an admin can add more without a design change. */
function PaymentBadge({ method, isAr }) {
  if (method === 'visa') {
    return <span className="flex h-8 items-center rounded-lg bg-white px-2.5 text-sm font-black italic tracking-tight text-[#1a1f71] shadow-sm">VISA</span>;
  }
  if (method === 'mastercard') {
    return (
      <span className="flex h-8 items-center gap-1 rounded-lg bg-white px-2.5 shadow-sm">
        <span className="h-4 w-4 rounded-full bg-[#eb001b]" />
        <span className="-ms-2.5 h-4 w-4 rounded-full bg-[#f79e1b] mix-blend-multiply" />
      </span>
    );
  }
  const meta = PAYMENT_META[method] || { labelEn: method, labelAr: method };
  return (
    <span className="flex h-8 items-center rounded-lg bg-white px-2.5 text-xs font-bold text-slate-700 shadow-sm">
      {isAr ? meta.labelAr : meta.labelEn}
    </span>
  );
}

export default function Footer({ className = '' }) {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { settings } = useStoreSettings();
  const year = new Date().getFullYear();
  const isAr = language === 'ar';
  const showAdminLink = isStaffRole(user?.role);

  const storeName = isAr ? (settings?.storeNameAr || APP_NAME) : (settings?.storeNameEn || APP_NAME_EN);
  const storeSubtitle = isAr ? (settings?.storeNameEn || APP_NAME_EN) : (settings?.storeNameAr || APP_NAME);
  const tagline = isAr ? (settings?.taglineAr || t.footer.tagline) : (settings?.taglineEn || t.footer.tagline);

  const footerCfg = settings?.navigation?.footer || {};
  const on = (section) => footerSectionEnabled(footerCfg, section);

  const footerColumns = (settings?.navigation?.footerColumns || [])
    .slice()
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  const fallbackColumns = [
    {
      titleAr: 'خدمة العملاء',
      titleEn: 'Customer Service',
      links: [
        { labelAr: 'اتصل بنا', labelEn: 'Contact Us', href: '/contact' },
        { labelAr: 'الأسئلة الشائعة', labelEn: 'FAQ', href: '/faq' },
        { labelAr: 'الاسترجاع والاستبدال', labelEn: 'Returns & Exchange', href: '/returns' },
        { labelAr: 'تتبع الطلب', labelEn: 'Track Order', href: '/track-order' },
      ],
    },
    {
      titleAr: 'عن المتجر',
      titleEn: 'About',
      links: [
        { labelAr: 'من نحن', labelEn: 'About Us', href: '/about' },
        { labelAr: 'سياسة الخصوصية', labelEn: 'Privacy Policy', href: '/privacy' },
        { labelAr: 'الشروط والأحكام', labelEn: 'Terms & Conditions', href: '/terms' },
        { labelAr: 'الوظائف', labelEn: 'Careers', href: '/careers' },
      ],
    },
  ];

  const columns = footerColumns.length ? footerColumns : fallbackColumns;
  const socialEntries = Object.entries(settings?.socialLinks || {}).filter(([, href]) => href);
  const appStore = settings?.appLinks?.appStore;
  const googlePlay = settings?.appLinks?.googlePlay;

  const legalLinks = footerCfg.legalLinks?.length ? footerCfg.legalLinks : DEFAULT_FOOTER_LEGAL_LINKS;
  const paymentMethods = footerCfg.paymentMethods?.length ? footerCfg.paymentMethods : DEFAULT_FOOTER_PAYMENT_METHODS;

  return (
    <footer className={`mt-auto ${className}`}>
      <div className="relative isolate overflow-hidden rounded-t-[2rem] bg-primary-600 text-white shadow-[0_-20px_60px_-30px_rgba(11,26,54,0.55)] sm:rounded-t-[2.75rem]">
        {/* decorative glow */}
        <div aria-hidden className="pointer-events-none absolute -top-24 start-1/3 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 end-0 h-72 w-72 rounded-full bg-primary-400/20 blur-3xl" />

        {/* back to top */}
        {on('backToTop') && (
          <div className="relative flex justify-center pt-8">
            <button
              type="button"
              onClick={() => scrollToTop('smooth')}
              className="group inline-flex items-center gap-2 rounded-full bg-white/10 px-6 py-3 text-sm font-semibold text-white ring-1 ring-white/20 backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/20"
            >
              <ChevronUp className="h-4 w-4 transition-transform group-hover:-translate-y-0.5" aria-hidden />
              {isAr ? 'العودة إلى الأعلى' : 'Back to top'}
            </button>
          </div>
        )}

        <div className="container-app relative pb-14 pt-12">
          <div className="grid gap-12 lg:grid-cols-12">
            {/* brand + tagline + socials */}
            <div className="lg:col-span-4">
              <div className="flex items-center gap-2 text-sm font-medium text-white/70">
                <span className="h-1.5 w-1.5 rounded-full bg-white/80" aria-hidden />
                {storeSubtitle}
              </div>
              <h2 className="mt-4 max-w-sm text-2xl font-extrabold leading-snug sm:text-[1.75rem] lg:text-[2rem] lg:leading-tight">
                {tagline}
              </h2>
              {on('social') && socialEntries.length > 0 && (
                <div className="mt-7 flex flex-wrap gap-2.5">
                  {socialEntries.map(([key, href]) => {
                    const path = SOCIAL_PATHS[key] || SOCIAL_PATHS.linkedin;
                    return (
                      <a
                        key={key}
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={key}
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/15 transition hover:bg-white hover:text-primary-700"
                      >
                        <BrandIcon path={path} className="h-[18px] w-[18px]" />
                      </a>
                    );
                  })}
                </div>
              )}
            </div>

            {/* link columns */}
            <div className="grid gap-8 sm:grid-cols-2 lg:col-span-5 lg:grid-cols-2 lg:border-s lg:border-white/10 lg:ps-8">
              {columns.map((column, index) => (
                <div key={column._id || index}>
                  <h3 className="text-sm font-bold uppercase tracking-wide text-white/60">
                    {isAr ? column.titleAr : column.titleEn}
                  </h3>
                  <ul className="mt-4 space-y-3 text-sm">
                    {(column.links || []).filter((link) => link.isActive !== false).map((link, linkIndex) => (
                      <li key={link._id || linkIndex}>
                        {link.isExternal ? (
                          <a href={link.href} target="_blank" rel="noreferrer" className="text-white/80 transition hover:text-white">
                            {isAr ? link.labelAr : link.labelEn}
                          </a>
                        ) : (
                          <Link to={link.href || '/'} className="text-white/80 transition hover:text-white">
                            {isAr ? link.labelAr : link.labelEn}
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* contact + apps */}
            {(on('contact') || on('apps')) && (
              <div className="lg:col-span-3">
                {on('contact') && (
                  <>
                    <h3 className="text-sm font-bold uppercase tracking-wide text-white/60">
                      {isAr ? 'تواصل معنا' : 'Get in Touch'}
                    </h3>
                    <ul className="mt-4 space-y-3 text-sm text-white/80">
                      <li className="flex items-center gap-2.5">
                        <Phone className="h-4 w-4 shrink-0 text-white/50" aria-hidden />
                        <span dir="ltr">{settings?.supportPhone || '16XXX'}</span>
                      </li>
                      <li className="flex items-center gap-2.5">
                        <Mail className="h-4 w-4 shrink-0 text-white/50" aria-hidden />
                        {settings?.supportEmail || 'support@marketplus.com'}
                      </li>
                      <li className="flex items-center gap-2.5">
                        <Clock className="h-4 w-4 shrink-0 text-white/50" aria-hidden />
                        {isAr ? 'دعم على مدار الساعة 24/7' : '24/7 Support'}
                      </li>
                    </ul>
                  </>
                )}

                {on('apps') && (appStore || googlePlay) && (
                  <div className="mt-6">
                    <p className="text-sm font-bold uppercase tracking-wide text-white/60">
                      {isAr ? 'حمّل التطبيق' : 'Get the App'}
                    </p>
                    <div className="mt-3 flex flex-col gap-2.5 sm:flex-row lg:flex-col">
                      {appStore && (
                        <a href={appStore} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold ring-1 ring-white/15 transition hover:bg-white hover:text-primary-700">
                          <Apple className="h-4 w-4" aria-hidden />
                          App Store
                        </a>
                      )}
                      {googlePlay && (
                        <a href={googlePlay} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold ring-1 ring-white/15 transition hover:bg-white hover:text-primary-700">
                          <Play className="h-4 w-4" aria-hidden />
                          Google Play
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* bottom bar */}
          <div className="mt-14 flex flex-col gap-6 border-t border-white/10 pt-8 lg:flex-row-reverse lg:items-center lg:justify-between">
            {on('payment') && (
              <div className="flex flex-wrap items-center gap-2.5">
                {paymentMethods.map((method) => (
                  <PaymentBadge key={method} method={method} isAr={isAr} />
                ))}
              </div>
            )}

            {on('legal') && (
              <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-white/70">
                {legalLinks.map((link, i) => (
                  link.isExternal ? (
                    <a key={link.href || i} href={link.href} target="_blank" rel="noreferrer" className="transition hover:text-white">
                      {isAr ? (link.labelAr || link.labelEn) : (link.labelEn || link.labelAr)}
                    </a>
                  ) : (
                    <Link key={link.href || i} to={link.href || '/'} className="transition hover:text-white">
                      {isAr ? (link.labelAr || link.labelEn) : (link.labelEn || link.labelAr)}
                    </Link>
                  )
                ))}
              </nav>
            )}

            <p className="text-sm text-white/60">
              © {year} {storeName} — {t.footer.rights}
              {showAdminLink && (
                <>
                  {' · '}
                  <Link to="/admin" className="text-white/50 transition hover:text-white">
                    {isAr ? 'لوحة الإدارة' : 'Admin'}
                  </Link>
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
