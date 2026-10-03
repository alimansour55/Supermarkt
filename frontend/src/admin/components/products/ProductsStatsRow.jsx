import { AlertTriangle, CheckCircle2, FolderX, PackageX, Percent, Wallet } from 'lucide-react';
import StatCard from '../StatCard';
import { StatCardsSkeleton } from '../Skeleton';
import { formatPrice } from '../../../utils/formatters';

export default function ProductsStatsRow({ stats, loading, isAr, onFilterShortcut }) {
  if (loading && !stats) {
    return <StatCardsSkeleton count={5} />;
  }
  if (!stats) return null;

  const cards = [
    {
      key: 'active',
      title: isAr ? 'منتجات نشطة' : 'Active products',
      value: stats.active,
      icon: CheckCircle2,
      accent: 'primary',
      onClick: () => onFilterShortcut?.({ isActive: 'true' }),
    },
    {
      key: 'outOfStock',
      title: isAr ? 'نفد المخزون' : 'Out of stock',
      value: stats.outOfStock,
      icon: PackageX,
      accent: 'red',
      onClick: () => onFilterShortcut?.({ stock: 'out' }),
    },
    {
      key: 'lowStock',
      title: isAr ? 'مخزون منخفض' : 'Low stock',
      value: stats.lowStock,
      icon: AlertTriangle,
      accent: 'amber',
      onClick: () => onFilterShortcut?.({ stock: 'low' }),
    },
    {
      key: 'noCategory',
      title: isAr ? 'بدون قسم صحيح' : 'No valid category',
      value: stats.noCategory,
      icon: FolderX,
      accent: 'amber',
      onClick: () => onFilterShortcut?.({ noCategory: 'true' }),
    },
    {
      key: 'retailValue',
      title: isAr ? 'قيمة المخزون (بيع)' : 'Inventory value (retail)',
      value: formatPrice(stats.retailValue),
      icon: Wallet,
      accent: 'blue',
    },
    {
      key: 'avgMargin',
      title: isAr ? 'متوسط هامش الربح' : 'Avg. margin',
      value: `${stats.avgMarginPct}%`,
      icon: Percent,
      accent: 'primary',
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {cards.map((card) => (
        <button
          key={card.key}
          type="button"
          onClick={card.onClick}
          disabled={!card.onClick}
          className={`text-start ${card.onClick ? 'cursor-pointer transition-transform hover:-translate-y-0.5' : 'cursor-default'}`}
        >
          <StatCard title={card.title} value={card.value} icon={card.icon} accent={card.accent} />
        </button>
      ))}
    </div>
  );
}
