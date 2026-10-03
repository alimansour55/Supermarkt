import { Link } from 'react-router-dom';
import { BarChart3, ImagePlus, ShoppingCart, SquarePlus } from 'lucide-react';

const ACTIONS = [
  { to: '/admin/products/new', Icon: SquarePlus, labelAr: 'منتج جديد', labelEn: 'New product' },
  { to: '/admin/orders', Icon: ShoppingCart, labelAr: 'الطلبات', labelEn: 'Orders' },
  { to: '/admin/banners', Icon: ImagePlus, labelAr: 'بانر جديد', labelEn: 'New banner' },
  { to: '/admin/reports', Icon: BarChart3, labelAr: 'التقارير', labelEn: 'Reports' },
];

export default function QuickActions({ isAr }) {
  return (
    <div className="flex flex-wrap gap-2">
      {ACTIONS.map(({ to, Icon, labelAr, labelEn }) => (
        <Link
          key={to}
          to={to}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-3.5 py-2 text-sm font-medium text-text shadow-sm transition-colors hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700"
        >
          <Icon className="h-4 w-4" />
          {isAr ? labelAr : labelEn}
        </Link>
      ))}
    </div>
  );
}
