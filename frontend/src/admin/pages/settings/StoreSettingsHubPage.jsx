import { Link } from 'react-router-dom';
import {
  Settings,
  Phone,
  Truck,
  Sparkles,
  FileText,
  LayoutDashboard,
  ChevronLeft,
} from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext';
import { PageHeader } from '../../components';

const SECTIONS = [
  {
    path: '/admin/settings/identity',
    Icon: Settings,
    color: 'bg-primary-50 text-primary-700',
    titleAr: 'هوية المتجر',
    titleEn: 'Store identity',
    descAr: 'الاسم والشعار والعملة',
    descEn: 'Name, logo, and currency',
  },
  {
    path: '/admin/settings/contact',
    Icon: Phone,
    color: 'bg-sky-50 text-sky-700',
    titleAr: 'التواصل والروابط',
    titleEn: 'Contact & links',
    descAr: 'الدعم ووسائل التواصل وتطبيقات الجوال',
    descEn: 'Support, social media, and app links',
  },
  {
    path: '/admin/settings/delivery',
    Icon: Truck,
    color: 'bg-emerald-50 text-emerald-700',
    titleAr: 'التوصيل',
    titleEn: 'Delivery',
    descAr: 'التوصيل المجاني، الخريطة، والمهلة',
    descEn: 'Free delivery, map pin, and lead times',
  },
  {
    path: '/admin/settings/experience',
    Icon: Sparkles,
    color: 'bg-violet-50 text-violet-700',
    titleAr: 'تجربة العميل',
    titleEn: 'Customer experience',
    descAr: 'المخزون والتقييمات والمساعد الذكي',
    descEn: 'Stock alerts, reviews, and AI chat',
  },
  {
    path: '/admin/settings/invoice',
    Icon: FileText,
    color: 'bg-amber-50 text-amber-700',
    titleAr: 'الفاتورة',
    titleEn: 'Invoice',
    descAr: 'نصوص وخيارات فاتورة PDF',
    descEn: 'PDF invoice text and display options',
  },
  {
    path: '/admin/settings/admin',
    Icon: LayoutDashboard,
    color: 'bg-slate-100 text-slate-700',
    titleAr: 'لوحة التحكم',
    titleEn: 'Admin panel',
    descAr: 'ما يظهر للمسؤولين في اللوحة',
    descEn: 'What admins see in the dashboard',
  },
];

export default function StoreSettingsHubPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';

  return (
    <div className="space-y-6">
      <PageHeader />

      <p className="text-sm text-text-muted">
        {isAr
          ? 'اختر قسماً لتعديله — كل قسم يحتوي على خيارات عامة بسيطة مع تفاصيل إضافية عند الحاجة.'
          : 'Pick a section to edit — each has a few general toggles with optional advanced details.'}
      </p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {SECTIONS.map(({ path, Icon, color, titleAr, titleEn, descAr, descEn }) => (
          <Link
            key={path}
            to={path}
            className="group flex flex-col rounded-2xl border border-border bg-white p-5 shadow-sm transition hover:border-primary-200 hover:shadow-md"
          >
            <span className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${color}`}>
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <span className="font-bold text-text group-hover:text-primary-700">
              {isAr ? titleAr : titleEn}
            </span>
            <span className="mt-1 text-sm text-text-muted">
              {isAr ? descAr : descEn}
            </span>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary-600">
              {isAr ? 'فتح' : 'Open'}
              <ChevronLeft className={`h-4 w-4 ${isAr ? '' : 'rotate-180'}`} aria-hidden />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
