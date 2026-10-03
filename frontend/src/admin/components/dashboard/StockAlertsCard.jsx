import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PackageOpen } from 'lucide-react';
import { formatPrice } from '../../../utils/formatters';
import { EmptyState } from '../index';

function ProductRow({ product, isAr, badgeClass, badgeValue }) {
  return (
    <li>
      <Link
        to={`/admin/products/${product._id}/edit`}
        className="-mx-2 flex items-center justify-between rounded-lg px-2 py-3 transition-colors hover:bg-slate-50"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="text-xl">{product.emoji || '📦'}</span>
          <div className="min-w-0">
            <p className="truncate font-medium text-primary-700 hover:underline">
              {isAr ? product.nameAr : product.nameEn}
            </p>
            <p className="text-xs text-text-muted">{formatPrice(product.price)}</p>
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${badgeClass}`}>
          {badgeValue}
        </span>
      </Link>
    </li>
  );
}

export default function StockAlertsCard({ outOfStockProducts, outOfStockCount, lowStockProducts, isAr }) {
  const [tab, setTab] = useState(outOfStockCount > 0 ? 'out' : 'low');

  const tabs = [
    { key: 'out', labelAr: 'نفد من المخزون', labelEn: 'Out of stock', count: outOfStockCount ?? 0 },
    { key: 'low', labelAr: 'مخزون منخفض', labelEn: 'Low stock', count: lowStockProducts?.length ?? 0 },
  ];

  const activeProducts = tab === 'out' ? outOfStockProducts : lowStockProducts;

  return (
    <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={[
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors',
                tab === t.key ? 'bg-white text-text shadow-sm' : 'text-text-muted hover:text-text',
              ].join(' ')}
            >
              {isAr ? t.labelAr : t.labelEn}
              {t.count > 0 && (
                <span className={[
                  'rounded-full px-1.5 py-0.5 text-[11px] font-bold',
                  tab === t.key ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-text-muted',
                ].join(' ')}
                >
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
        <Link to="/admin/stock-alerts" className="text-sm font-medium text-primary-600 hover:underline">
          {isAr ? 'عرض الكل' : 'View all'}
        </Link>
      </div>

      {activeProducts?.length ? (
        <ul className="divide-y divide-border">
          {activeProducts.map((p) => (
            <ProductRow
              key={p._id}
              product={p}
              isAr={isAr}
              badgeClass="bg-red-100 text-red-700"
              badgeValue={tab === 'out' ? 0 : p.stock}
            />
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={PackageOpen}
          title={tab === 'out'
            ? (isAr ? 'لا يوجد منتج نافد' : 'Nothing out of stock')
            : (isAr ? 'لا يوجد مخزون منخفض' : 'All stocked up')}
          description={tab === 'out'
            ? (isAr ? 'جميع المنتجات النشطة متوفرة حالياً' : 'All active products are currently available')
            : (isAr ? 'جميع المنتجات بمستوى مخزون كافٍ' : 'All products have sufficient stock')}
          className="py-8"
        />
      )}
    </section>
  );
}
