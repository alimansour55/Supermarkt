import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, CheckCircle2, Clock, Percent, Truck,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { adminApi } from '../adminApi';
import Loader from '../../components/ui/Loader';
import { PageHeader, useToast } from '../components';
import { formatPrice } from '../../utils/formatters';

const RANGES = [
  { days: 1, ar: 'اليوم', en: 'Today' },
  { days: 7, ar: '7 أيام', en: '7 days' },
  { days: 30, ar: '30 يوم', en: '30 days' },
];

function ago(value, isAr) {
  if (!value) return isAr ? 'لا يوجد' : 'never';
  const mins = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
  if (mins < 1) return isAr ? 'الآن' : 'just now';
  if (mins < 60) return isAr ? `منذ ${mins} د` : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return isAr ? `منذ ${hrs} س` : `${hrs}h ago`;
  return isAr ? `منذ ${Math.floor(hrs / 24)} يوم` : `${Math.floor(hrs / 24)}d ago`;
}

function rateTone(rate) {
  if (rate == null) return 'text-text-muted';
  if (rate >= 95) return 'text-emerald-700';
  if (rate >= 85) return 'text-amber-700';
  return 'text-red-700';
}

export default function DriverPerformancePage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const toast = useToast();
  const [days, setDays] = useState(7);
  const [result, setResult] = useState({ days: null, data: null });

  useEffect(() => {
    let alive = true;
    adminApi.getDriversPerformance(days)
      .then(({ data }) => { if (alive) setResult({ days, data: data.data }); })
      .catch((err) => toast.error(err.response?.data?.message || err.message));
    return () => { alive = false; };
  }, [days, toast]);

  const loading = result.days !== days;
  const rows = useMemo(
    () => [...(result.data?.drivers || [])].sort((a, b) => (b.delivered + b.failed) - (a.delivered + a.failed)),
    [result.data],
  );
  const totals = useMemo(() => {
    const delivered = rows.reduce((n, r) => n + r.delivered, 0);
    const failed = rows.reduce((n, r) => n + r.failed, 0);
    const timed = rows.filter((r) => r.avgAssignToDeliverMin != null && r.delivered > 0);
    const weighted = timed.reduce((n, r) => n + r.avgAssignToDeliverMin * r.delivered, 0);
    const timedCount = timed.reduce((n, r) => n + r.delivered, 0);
    return {
      delivered,
      failed,
      successRate: delivered + failed ? Math.round((delivered / (delivered + failed)) * 100) : null,
      avgMin: timedCount ? Math.round(weighted / timedCount) : null,
      flags: rows.reduce((n, r) => n + r.offsite + r.missingAtPickup, 0),
    };
  }, [rows]);

  return (
    <div className="space-y-6">
      <PageHeader />

      <div className="flex justify-end">
        <div className="flex gap-1 rounded-xl bg-surface p-1 ring-1 ring-border">
          {RANGES.map((r) => (
            <button
              key={r.days}
              type="button"
              onClick={() => setDays(r.days)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${days === r.days ? 'bg-white shadow-sm' : 'text-text-muted'}`}
            >
              {isAr ? r.ar : r.en}
            </button>
          ))}
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-4">
        {[
          { icon: CheckCircle2, label: isAr ? 'تم التسليم' : 'Delivered', value: totals.delivered },
          { icon: Percent, label: isAr ? 'نسبة النجاح' : 'Success rate', value: totals.successRate != null ? `${totals.successRate}%` : '—' },
          { icon: Clock, label: isAr ? 'متوسط من التعيين للتسليم' : 'Avg assign → delivered', value: totals.avgMin != null ? `${totals.avgMin} ${isAr ? 'د' : 'min'}` : '—' },
          { icon: AlertTriangle, label: isAr ? 'تنبيهات (بعيد / نواقص)' : 'Flags (away / missing)', value: totals.flags, accent: totals.flags > 0 },
        ].map((card) => (
          <article key={card.label} className="rounded-2xl border border-border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3 text-text-muted">
              <card.icon className="h-5 w-5 text-primary-700" />
              <span className="text-sm">{card.label}</span>
            </div>
            <p className={`mt-3 text-2xl font-extrabold tabular-nums ${card.accent ? 'text-amber-600' : ''}`}>{card.value}</p>
          </article>
        ))}
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
        <div className="border-b border-border px-5 py-4">
          <h2 className="flex items-center gap-2 font-bold">
            <Truck className="h-5 w-5 text-primary-700" />
            {isAr ? 'أداء المناديب' : 'Driver performance'}
          </h2>
          <p className="text-sm text-text-muted">
            {isAr
              ? 'الاعتذارات والطلبات المنتهية مهلتها تُحسب من سجل العمليات. «بعيد» = تسليم خارج نطاق العنوان.'
              : 'Declines and expired assignments come from the audit log. "Away" = completed outside the address geofence.'}
          </p>
        </div>
        {loading && !result.data ? (
          <div className="flex justify-center py-12"><Loader /></div>
        ) : rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-text-muted">{isAr ? 'لا يوجد مناديب' : 'No drivers yet'}</p>
        ) : (
          <div className={`overflow-x-auto ${loading ? 'opacity-60' : ''}`}>
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-surface text-xs uppercase text-text-muted">
                <tr>
                  <th className="px-4 py-3 text-start">{isAr ? 'المندوب' : 'Driver'}</th>
                  <th className="px-4 py-3 text-start">{isAr ? 'تسليم' : 'Delivered'}</th>
                  <th className="px-4 py-3 text-start">{isAr ? 'فشل' : 'Failed'}</th>
                  <th className="px-4 py-3 text-start">{isAr ? 'النجاح' : 'Success'}</th>
                  <th className="px-4 py-3 text-start">{isAr ? 'متوسط الوقت' : 'Avg time'}</th>
                  <th className="px-4 py-3 text-start">{isAr ? 'اعتذار / انتهت المهلة' : 'Declined / expired'}</th>
                  <th className="px-4 py-3 text-start">{isAr ? 'بعيد / نواقص' : 'Away / missing'}</th>
                  <th className="px-4 py-3 text-start">{isAr ? 'نقدية معه' : 'Cash held'}</th>
                  <th className="px-4 py-3 text-start">{isAr ? 'آخر موقع' : 'Last GPS'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r._id} className="hover:bg-surface/60">
                    <td className="px-4 py-3">
                      <p className="font-semibold">{r.name}</p>
                      <p className="text-xs text-text-muted">
                        {!r.isActive
                          ? (isAr ? 'موقوف' : 'Disabled')
                          : r.available ? (isAr ? 'متصل' : 'Online') : (isAr ? 'غير متصل' : 'Offline')}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-semibold tabular-nums">{r.delivered}</td>
                    <td className={`px-4 py-3 tabular-nums ${r.failed ? 'text-red-700' : 'text-text-muted'}`}>{r.failed}</td>
                    <td className={`px-4 py-3 font-semibold tabular-nums ${rateTone(r.successRate)}`}>
                      {r.successRate != null ? `${r.successRate}%` : '—'}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-text-muted">
                      {r.avgAssignToDeliverMin != null ? `${Math.round(r.avgAssignToDeliverMin)} ${isAr ? 'د' : 'min'}` : '—'}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      <span className={r.declined ? 'text-amber-700' : 'text-text-muted'}>{r.declined}</span>
                      {' / '}
                      <span className={r.expired ? 'text-amber-700' : 'text-text-muted'}>{r.expired}</span>
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      <span className={r.offsite ? 'text-amber-700' : 'text-text-muted'}>{r.offsite}</span>
                      {' / '}
                      <span className={r.missingAtPickup ? 'text-amber-700' : 'text-text-muted'}>{r.missingAtPickup}</span>
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {r.cashHeld > 0 ? (
                        <Link to="/admin/driver-cash" className="font-semibold text-amber-700 hover:underline">{formatPrice(r.cashHeld)}</Link>
                      ) : <span className="text-text-muted">—</span>}
                    </td>
                    <td className="px-4 py-3 text-text-muted">{ago(r.lastLocationAt, isAr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
