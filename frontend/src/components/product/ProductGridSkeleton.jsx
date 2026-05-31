export default function ProductGridSkeleton({ count = 8, compact = false }) {
  const items = Array.from({ length: count }, (_, i) => i);

  if (compact) {
    return (
      <div className="flex gap-4 overflow-hidden pb-2">
        {items.map((i) => (
          <div key={i} className="min-w-[168px] shrink-0 animate-pulse rounded-xl border border-border bg-white p-3">
            <div className="aspect-square rounded-lg bg-slate-200" />
            <div className="mt-3 h-4 w-full rounded bg-slate-200" />
            <div className="mt-2 h-3 w-2/3 rounded bg-slate-100" />
            <div className="mt-3 h-9 w-full rounded-lg bg-slate-200" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {items.map((i) => (
        <div key={i} className="animate-pulse overflow-hidden rounded-xl border border-border bg-white">
          <div className="aspect-square bg-slate-200" />
          <div className="space-y-2 p-3">
            <div className="h-4 w-full rounded bg-slate-200" />
            <div className="h-3 w-4/5 rounded bg-slate-100" />
            <div className="mt-2 h-3 w-1/2 rounded bg-slate-100" />
            <div className="mt-3 h-10 w-full rounded-lg bg-slate-200" />
          </div>
        </div>
      ))}
    </div>
  );
}
