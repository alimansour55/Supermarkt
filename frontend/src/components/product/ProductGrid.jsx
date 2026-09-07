import ProductCard from './ProductCard';
import ProductGridSkeleton from './ProductGridSkeleton';
import { tileGridClass } from '../../utils/tileGridShared';

/**
 * @param {'scroll'|'grid'|'cards'} layout
 *   - scroll: horizontal strip (compact product cards)
 *   - grid: normal product cards in a responsive grid
 *   - cards: same as grid (used on listing pages)
 */
export default function ProductGrid({
  products,
  layout = 'scroll',
  loading = false,
  skeletonCount = 8,
  columns = 4,
}) {
  if (loading) {
    return <ProductGridSkeleton count={skeletonCount} layout={layout} columns={columns} />;
  }

  if (!products?.length) {
    return null;
  }

  if (layout === 'scroll') {
    return (
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
        {products.map((product) => (
          <ProductCard key={String(product._id || product.slug)} product={product} compact />
        ))}
      </div>
    );
  }

  const gridCols = layout === 'grid' ? columns : Math.min(columns, 4);

  return (
    <div className={`grid gap-2 sm:gap-3 ${tileGridClass(gridCols)}`}>
      {products.map((product) => (
        <ProductCard key={String(product._id || product.slug)} product={product} />
      ))}
    </div>
  );
}
