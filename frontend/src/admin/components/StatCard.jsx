export default function StatCard({ title, value, icon: Icon, accent = 'primary' }) {
  const colors = {
    primary: 'from-primary-500 to-primary-700',
    blue: 'from-blue-500 to-blue-700',
    amber: 'from-amber-500 to-amber-600',
    red: 'from-red-500 to-red-600',
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
      <div className={`bg-gradient-to-br ${colors[accent] || colors.primary} px-5 py-4 text-white`}>
        <div className="flex items-center justify-between">
          {Icon && <Icon className="h-8 w-8 opacity-90" strokeWidth={1.75} />}
          <p className="text-3xl font-bold">{value}</p>
        </div>
      </div>
      <div className="px-5 py-3">
        <p className="text-sm font-medium text-text-muted">{title}</p>
      </div>
    </div>
  );
}
