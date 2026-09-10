export function Skeleton({ className = '' }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

export function SkeletonText({ lines = 3, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`h-3 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} />
      ))}
    </div>
  );
}

export function HeroSkeleton() {
  return (
    <section className="bg-surface-muted py-3 md:py-4">
      <div className="container-app">
        <div className="relative overflow-hidden rounded-2xl">
          <Skeleton className="h-[190px] w-full rounded-none sm:h-[260px] md:h-[330px] lg:h-[390px]" />
          <div className="absolute bottom-4 start-1/2 flex -translate-x-1/2 gap-2 rtl:translate-x-1/2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className={`h-2 rounded-full ${i === 1 ? 'w-8' : 'w-2'}`} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function CategoryGridSkeleton({ count = 6 }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-white p-5">
          <Skeleton className="h-14 w-14 rounded-2xl" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

export function OrderListSkeleton({ count = 4 }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-2xl border border-border bg-white">
          <div className="flex gap-4 p-5">
            <div className="flex -space-x-2 rtl:space-x-reverse">
              {[1, 2, 3].map((j) => (
                <Skeleton key={j} className="h-12 w-12 rounded-xl border-2 border-white" />
              ))}
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex justify-between gap-2">
                <Skeleton className="h-7 w-20" />
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
              <Skeleton className="h-3 w-full max-w-xs" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
          <div className="border-t border-border bg-slate-50/60 px-5 py-4">
            <Skeleton className="mx-auto mb-3 h-3 w-24" />
            <div className="flex justify-between gap-2">
              {[1, 2, 3, 4].map((j) => (
                <div key={j} className="flex flex-1 flex-col items-center gap-2">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <Skeleton className="h-2 w-full max-w-[3.5rem]" />
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-between border-t border-border bg-slate-50/80 px-5 py-3">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PageContentSkeleton() {
  return (
    <div className="container-app max-w-3xl py-8 space-y-6">
      <Skeleton className="h-8 w-48" />
      {[1, 2].map((i) => (
        <div key={i} className="rounded-2xl border border-border bg-white p-6 space-y-3">
          <Skeleton className="h-5 w-32" />
          <SkeletonText lines={4} />
        </div>
      ))}
    </div>
  );
}

export function HomePageSkeleton() {
  return (
    <div className="pb-10">
      <HeroSkeleton />
      <div className="container-app py-6 space-y-8">
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-20 shrink-0 rounded-2xl" />
          ))}
        </div>
        <div>
          <Skeleton className="mb-4 h-6 w-40" />
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="min-w-[168px] shrink-0 rounded-xl border border-border bg-white p-3">
                <Skeleton className="aspect-square rounded-lg" />
                <Skeleton className="mt-3 h-4 w-full" />
                <Skeleton className="mt-2 h-5 w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
