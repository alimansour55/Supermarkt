export function Skeleton({ className = '' }) {
  return (
    <div
      className={['animate-pulse rounded-lg bg-slate-200/80', className].join(' ')}
      aria-hidden
    />
  );
}

export function SkeletonText({ lines = 1, className = '' }) {
  return (
    <div className={['space-y-2', className].join(' ')}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          className={['h-4', i === lines - 1 && lines > 1 ? 'w-3/4' : 'w-full'].join(' ')}
        />
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5, columns = 4 }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
      <div className="border-b border-border bg-slate-50 px-4 py-3">
        <div className="flex gap-4">
          {Array.from({ length: columns }, (_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: rows }, (_, row) => (
          <div key={row} className="flex items-center gap-4 px-4 py-4">
            {Array.from({ length: columns }, (_, col) => (
              <Skeleton key={col} className={['h-4 flex-1', col === 0 ? 'max-w-[40%]' : ''].join(' ')} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardSkeleton({ className = '' }) {
  return (
    <div className={['rounded-2xl border border-border bg-white p-6 shadow-sm', className].join(' ')}>
      <Skeleton className="mb-4 h-6 w-1/3" />
      <SkeletonText lines={3} />
    </div>
  );
}

export function StatCardsSkeleton({ count = 4 }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
          <Skeleton className="h-24 w-full rounded-none" />
          <div className="px-5 py-3">
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default Skeleton;
