import ProductCard from './ProductCard';
import ProductGridSkeleton from './ProductGridSkeleton';

export default function ProductGrid({ products, compact = false, loading = false, skeletonCount = 8 }) {
  if (loading) {
    return <ProductGridSkeleton count={skeletonCount} compact={compact} />;
  }

  if (!products?.length) {
    return null;
  }

  return (
    <div
      className={
        compact
          ? 'flex gap-4 overflow-x-auto pb-2 scrollbar-thin'
          : 'grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
      }
    >
      {products.map((product) => (
        <ProductCard key={product._id} product={product} compact={compact} />
      ))}
    </div>
  );
}
