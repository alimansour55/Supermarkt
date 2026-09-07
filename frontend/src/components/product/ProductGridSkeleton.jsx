import { Skeleton } from '../ui/Skeleton';
import { tileGridClass } from '../../utils/tileGridShared';

export default function ProductGridSkeleton({ count = 8, layout = 'scroll', columns = 4 }) {
  const items = Array.from({ length: count }, (_, i) => i);

  if (layout === 'scroll') {
    return (
      <div className="flex gap-3 overflow-hidden pb-2">
        {items.map((i) => (
          <div key={i} className="min-w-[156px] max-w-[176px] shrink-0 overflow-hidden rounded-[7px] border border-[#bed0e4] bg-white">
            <Skeleton className="h-[132px] rounded-none sm:h-[156px]" />
            <div className="space-y-2 p-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-2.5 w-14" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const gridCols = layout === 'grid' ? columns : Math.min(columns, 4);

  return (
    <div className={`grid gap-3 ${tileGridClass(gridCols)}`}>
      {items.map((i) => (
        <div key={i} className="overflow-hidden rounded-[7px] border border-[#bed0e4] bg-white">
          <Skeleton className="h-[132px] rounded-none sm:h-[156px] lg:h-[176px]" />
          <div className="space-y-2 p-2.5">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-5 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}
