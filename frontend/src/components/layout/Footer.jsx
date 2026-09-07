import { Globe, Camera, MessageCircle, Play, Smartphone, Phone, Mail, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { useStoreSettings } from '../../context/StoreSettingsContext';
import { APP_NAME, APP_NAME_EN } from '../../utils/constants';
import { isStaffRole } from '../../admin/adminPermissions';
import FooterShopDirectory from './FooterShopDirectory';

const SOCIAL_ICONS = {
  facebook: Globe,
  instagram: Camera,
  x: MessageCircle,
  youtube: Play,
};

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
      titleAr: 'المساعدة',
      titleEn: 'Help',
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

  return (
    <footer className={`mt-auto border-t border-border bg-slate-900 text-slate-300 ${className}`}>
      <FooterShopDirectory />

      <div className="border-b border-slate-700 bg-slate-800">
        <div className="container-app flex flex-col items-center justify-between gap-4 py-6 sm:flex-row">
          <div>
            <h3 className="text-lg font-bold text-white">
              {isAr ? `حمّل تطبيق ${storeName}` : `Download ${storeName} App`}
            </h3>
            <p className="mt-1 text-sm text-slate-400">
              {isAr ? 'تسوق أسرع وتابع عروضك الحصرية' : 'Shop faster and get exclusive deals'}
            </p>
          </div>
          <div className="flex gap-3">
            {appStore && (
              <a href={appStore} className="flex items-center gap-2 rounded-xl bg-black px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-950 transition-colors">
                <Smartphone className="h-4 w-4" aria-hidden />
                App Store
              </a>
            )}
            {googlePlay && (
              <a href={googlePlay} className="flex items-center gap-2 rounded-xl bg-black px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-950 transition-colors">
                <Smartphone className="h-4 w-4" aria-hidden />
                Google Play
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="container-app py-12">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-1">
            <div className="mb-4 flex items-center gap-2">
              {settings?.logoUrl ? (
                <img src={settings.logoUrl} alt="" className="h-10 w-10 rounded-xl object-contain bg-white p-1" />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600 text-lg font-bold text-white">+</span>
              )}
              <div>
                <span className="block text-lg font-bold text-white">{storeName}</span>
                <span className="block text-xs text-slate-400">{storeSubtitle}</span>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-slate-400">{tagline}</p>
            <div className="mt-4 flex gap-2">
              {socialEntries.map(([key, href]) => {
                const Icon = SOCIAL_ICONS[key] || Globe;
                return (
                  <a
                    key={key}
                    href={href}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-slate-300 hover:bg-primary-600 hover:text-white transition-colors"
                    aria-label={key}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Icon className="h-5 w-5" aria-hidden />
                  </a>
                );
              })}
            </div>
          </div>

          {columns.map((column, index) => (
            <div key={column._id || index}>
              <h3 className="mb-4 font-bold text-white">{isAr ? column.titleAr : column.titleEn}</h3>
              <ul className="space-y-2.5 text-sm">
                {(column.links || []).filter((link) => link.isActive !== false).map((link, linkIndex) => (
                  <li key={link._id || linkIndex}>
                    {link.isExternal ? (
                      <a href={link.href} className="hover:text-primary-400 transition-colors" target="_blank" rel="noreferrer">
                        {isAr ? link.labelAr : link.labelEn}
                      </a>
                    ) : (
                      <Link to={link.href || '/'} className="hover:text-primary-400 transition-colors">
                        {isAr ? link.labelAr : link.labelEn}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <h3 className="mb-4 font-bold text-white">
              {isAr ? 'تواصل معنا' : 'Get in Touch'}
            </h3>
            <ul className="space-y-3 text-sm text-slate-400">
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                {settings?.supportPhone || '16XXX'}
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                {settings?.supportEmail || 'support@marketplus.com'}
              </li>
              <li className="flex items-center gap-2">
                <Clock className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                {isAr ? '24/7 على مدار الساعة' : '24/7 Available'}
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-slate-700 pt-6 text-center text-sm text-slate-500">
          © {year} {storeName} ({storeSubtitle}). {t.footer.rights}
          {showAdminLink && (
            <span className="mt-2 block">
              <Link to="/admin" className="text-slate-600 hover:text-primary-400 transition-colors">
                {isAr ? 'لوحة الإدارة' : 'Admin panel'}
              </Link>
            </span>
          )}
        </div>
      </div>
    </footer>
  );
}
