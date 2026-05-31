import { Globe, Camera, MessageCircle, Play, Smartphone, Phone, Mail, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { APP_NAME, APP_NAME_EN } from '../../utils/constants';
import { CATEGORIES } from '../../data/mockData';
import { isStaffRole } from '../../admin/adminPermissions';

export default function Footer({ className = '' }) {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const year = new Date().getFullYear();
  const isAr = language === 'ar';
  const showAdminLink = isStaffRole(user?.role);

  const customerService = [
    { to: '/contact', labelAr: 'اتصل بنا', labelEn: 'Contact Us' },
    { to: '/faq', labelAr: 'الأسئلة الشائعة', labelEn: 'FAQ' },
    { to: '/returns', labelAr: 'الاسترجاع والاستبدال', labelEn: 'Returns & Exchange' },
    { to: '/track-order', labelAr: 'تتبع الطلب', labelEn: 'Track Order' },
  ];

  const helpLinks = [
    { to: '/about', labelAr: 'من نحن', labelEn: 'About Us' },
    { to: '/privacy', labelAr: 'سياسة الخصوصية', labelEn: 'Privacy Policy' },
    { to: '/terms', labelAr: 'الشروط والأحكام', labelEn: 'Terms & Conditions' },
    { to: '/careers', labelAr: 'الوظائف', labelEn: 'Careers' },
  ];

  const socials = [
    { name: 'Facebook', Icon: Globe, href: '#' },
    { name: 'Instagram', Icon: Camera, href: '#' },
    { name: 'Twitter', Icon: MessageCircle, href: '#' },
    { name: 'YouTube', Icon: Play, href: '#' },
  ];

  return (
    <footer className={`mt-auto border-t border-border bg-slate-900 text-slate-300 ${className}`}>
      <div className="border-b border-slate-700 bg-slate-800">
        <div className="container-app flex flex-col items-center justify-between gap-4 py-6 sm:flex-row">
          <div>
            <h3 className="text-lg font-bold text-white">
              {language === 'ar' ? 'حمّل تطبيق سوق+' : 'Download MarketPlus App'}
            </h3>
            <p className="mt-1 text-sm text-slate-400">
              {language === 'ar' ? 'تسوق أسرع وتابع عروضك الحصرية' : 'Shop faster and get exclusive deals'}
            </p>
          </div>
          <div className="flex gap-3">
            <a href="#" className="flex items-center gap-2 rounded-xl bg-black px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-950 transition-colors">
              <Smartphone className="h-4 w-4" aria-hidden />
              App Store
            </a>
            <a href="#" className="flex items-center gap-2 rounded-xl bg-black px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-950 transition-colors">
              <Smartphone className="h-4 w-4" aria-hidden />
              Google Play
            </a>
          </div>
        </div>
      </div>

      <div className="container-app py-12">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-1">
            <div className="mb-4 flex items-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600 text-lg font-bold text-white">+</span>
              <div>
                <span className="block text-lg font-bold text-white">{APP_NAME}</span>
                <span className="block text-xs text-slate-400">{APP_NAME_EN}</span>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-slate-400">{t.footer.tagline}</p>
            <div className="mt-4 flex gap-2">
              {socials.map(({ name, Icon, href }) => (
                <a
                  key={name}
                  href={href}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-slate-300 hover:bg-primary-600 hover:text-white transition-colors"
                  aria-label={name}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-4 font-bold text-white">
              {language === 'ar' ? 'خدمة العملاء' : 'Customer Service'}
            </h3>
            <ul className="space-y-2.5 text-sm">
              {customerService.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="hover:text-primary-400 transition-colors">
                    {language === 'ar' ? link.labelAr : link.labelEn}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-4 font-bold text-white">
              {language === 'ar' ? 'المساعدة' : 'Help'}
            </h3>
            <ul className="space-y-2.5 text-sm">
              {helpLinks.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="hover:text-primary-400 transition-colors">
                    {language === 'ar' ? link.labelAr : link.labelEn}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-4 font-bold text-white">{t.nav.categories}</h3>
            <ul className="space-y-2.5 text-sm">
              {CATEGORIES.slice(0, 6).map((cat) => (
                <li key={cat.slug}>
                  <Link to={`/categories/${cat.slug}`} className="hover:text-primary-400 transition-colors">
                    {language === 'ar' ? cat.nameAr : cat.nameEn}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-4 font-bold text-white">
              {language === 'ar' ? 'تواصل معنا' : 'Get in Touch'}
            </h3>
            <ul className="space-y-3 text-sm text-slate-400">
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                16XXX (مجاني)
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                support@marketplus.com
              </li>
              <li className="flex items-center gap-2">
                <Clock className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                {language === 'ar' ? '24/7 على مدار الساعة' : '24/7 Available'}
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-slate-700 pt-6 text-center text-sm text-slate-500">
          © {year} {APP_NAME} ({APP_NAME_EN}). {t.footer.rights}
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
