import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { adminApi } from '../../adminApi';
import Loader from '../../../components/ui/Loader';

function Meter({ value, target, isAr }) {
  if (value == null) return <span className="text-xs text-text-muted">{isAr ? 'لا تقييمات بعد' : 'No ratings yet'}</span>;
  const met = value >= target;
  return (
    <div className="min-w-[8rem]">
      <div className="flex items-baseline justify-between text-xs">
        <span className={`font-bold ${met ? 'text-emerald-700' : 'text-rose-600'}`}>{value}%</span>
        <span className="text-text-muted">{isAr ? 'الهدف' : 'target'} {target}%</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${met ? 'bg-emerald-500' : 'bg-rose-400'}`} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </div>
  );
}

function Stat({ label, children }) {
  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <p className="text-xs font-semibold text-text-muted">{label}</p>
      <div className="mt-2 text-xl font-extrabold text-text">{children}</div>
    </div>
  );
}

export default function LiveChatPerformancePanel({ isAr }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    adminApi.getLiveChatPerformance().then(({ data: res }) => setData(res.data)).catch(() => setData(false));
  }, []);

  if (data === null) return <div className="flex justify-center py-16"><Loader size="md" /></div>;
  if (data === false) return <p className="p-6 text-sm text-text-muted">{isAr ? 'تعذر تحميل الأداء' : 'Could not load performance'}</p>;

  const { targets, team, agents, scope } = data;

  return (
    <div className="mx-auto max-w-4xl space-y-4 overflow-y-auto p-4">
      <p className="text-sm text-text-muted">
        {scope === 'team'
          ? (isAr ? 'أداء الفريق كله. المستهدف يحدده المسؤول الأعلى من تبويب الإعدادات.' : 'Whole-team performance. Targets are set by a super admin in the Settings tab.')
          : (isAr ? 'هذه أرقامك أنت مقابل المستهدف.' : 'These are your own numbers against the target.')}
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label={isAr ? 'رضا العملاء (٤-٥ نجوم)' : 'Customer satisfaction (4–5★)'}>
          <Meter value={team.csatPercent} target={targets.csatTargetPercent} isAr={isAr} />
        </Stat>
        <Stat label={isAr ? 'متوسط التقييم' : 'Average rating'}>
          {team.avgRating != null ? (
            <span className="inline-flex items-center gap-1">{team.avgRating}<Star className="h-4 w-4 fill-amber-400 text-amber-400" /></span>
          ) : '—'}
        </Stat>
        <Stat label={isAr ? 'المحادثات / المقيّمة' : 'Chats / rated'}>{team.handled} / {team.rated}</Stat>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-text-muted">
            <tr>
              <th className="px-4 py-2 text-start">{isAr ? 'الموظف' : 'Agent'}</th>
              <th className="px-4 py-2 text-start">{isAr ? 'هذا الشهر' : 'This month'}</th>
              <th className="px-4 py-2 text-start">{isAr ? 'الإجمالي' : 'Total'}</th>
              <th className="px-4 py-2 text-start">{isAr ? 'التقييم' : 'Rating'}</th>
              <th className="px-4 py-2 text-start">{isAr ? 'الرضا مقابل الهدف' : 'Satisfaction vs target'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70">
            {agents.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-text-muted">{isAr ? 'لا توجد بيانات بعد' : 'No data yet'}</td></tr>
            )}
            {agents.map((a) => (
              <tr key={a.userId}>
                <td className="px-4 py-3 font-semibold">{a.displayName || a.name}</td>
                <td className="px-4 py-3">
                  {a.stats.monthHandled}
                  {targets.monthlyChatTarget > 0 && <span className="text-xs text-text-muted"> / {targets.monthlyChatTarget}</span>}
                </td>
                <td className="px-4 py-3">{a.stats.handled}</td>
                <td className="px-4 py-3">{a.stats.avgRating ?? '—'} <span className="text-xs text-text-muted">({a.stats.rated})</span></td>
                <td className="px-4 py-3"><Meter value={a.stats.csatPercent} target={targets.csatTargetPercent} isAr={isAr} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
