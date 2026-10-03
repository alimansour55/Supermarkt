import EmptyState from '../EmptyState';
import ProductGridCard from './ProductGridCard';

function GridSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
      {Array.from({ length: 14 }, (_, i) => (
        <div key={i} className="animate-pulse overflow-hidden rounded-xl border border-border bg-white shadow-sm">
          <div className="aspect-square w-full bg-slate-200/80" />
          <div className="space-y-1.5 p-2">
            <div className="h-2.5 w-3/4 rounded bg-slate-200/80" />
            <div className="h-2.5 w-1/2 rounded bg-slate-200/80" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ProductsGrid({
  data,
  loading,
  isAr,
  selectedIds,
  onToggleSelect,
  rowActions,
  stockThreshold,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  emptyAction,
}) {
  if (loading) return <GridSkeleton />;

  if (!data.length) {
    return (
      <div className="rounded-2xl border border-border bg-white shadow-sm">
        <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} action={emptyAction} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
      {data.map((product) => (
        <ProductGridCard
          key={product._id}
          product={product}
          isAr={isAr}
          selected={selectedIds.includes(product._id)}
          onToggleSelect={onToggleSelect}
          actions={rowActions(product)}
          stockThreshold={stockThreshold}
        />
      ))}
    </div>
  );
}
