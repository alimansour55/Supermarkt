const ACCENTS = {
  teal: 'text-teal-700 bg-teal-50',
  violet: 'text-violet-700 bg-violet-50',
  amber: 'text-amber-800 bg-amber-50',
  emerald: 'text-emerald-700 bg-emerald-50',
  red: 'text-red-700 bg-red-50',
};

export default function DriverStatCard({ icon: Icon, label, value, accent = 'teal' }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${ACCENTS[accent]}`}>
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
      <p className="text-xs font-medium text-slate-500">{label}</p>
    </div>
  );
}
