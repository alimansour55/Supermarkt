import { useOutletContext } from 'react-router-dom';
import { useState } from 'react';
import {
  LogOut, Package, Percent, Phone, ShieldCheck, Timer, UserRound, XCircle,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { orderService } from '../../services/apiServices';
import { useAsyncData } from '../../hooks/useAsyncData';
import Button from '../../components/ui/Button';
import DriverAvailabilityToggle from '../../components/driver/DriverAvailabilityToggle';
import DriverStatCard from './components/DriverStatCard';
import DriverCashCard from './components/DriverCashCard';
import DriverPushToggle from '../../components/driver/DriverPushToggle';
import { formatPrice } from '../../utils/formatters';

const RANGES = [
  { days: 1, ar: 'اليوم', en: 'Today' },
  { days: 7, ar: '7 أيام', en: '7 days' },
  { days: 30, ar: '30 يوم', en: '30 days' },
];

async function fetchCash() {
  const { data } = await orderService.getDriverCash();
  return data.data || null;
}

function Row({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Icon className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
      <span className="text-sm text-slate-500">{label}</span>
      <span className="ms-auto text-sm font-semibold text-slate-900" dir="ltr">{value}</span>
    </div>
  );
}

export default function DriverAccountPage() {
  const { language } = useLanguage();
  const { user, logout } = useAuth();
  const isAr = language === 'ar';
  const { config, setAvailability, availabilityBusy } = useOutletContext() || {};
  const [days, setDays] = useState(1);
  const { data: stats } = useAsyncData(async () => {
    const { data } = await orderService.getDriverStats(days);
    return data.data || null;
  }, [days]);
  const { data: cash } = useAsyncData(fetchCash, []);

  const availabilityEnabled = config?.availabilityEnabled === true;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">{isAr ? 'حسابي' : 'My account'}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {isAr ? 'بياناتك وحالة العمل' : 'Your details and work status'}
        </p>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between px-1">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
            {isAr ? 'أدائي' : 'My performance'}
          </p>
          <div className="flex gap-1 rounded-lg bg-slate-200/60 p-0.5">
            {RANGES.map((r) => (
              <button
                key={r.days}
                type="button"
                onClick={() => setDays(r.days)}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold ${days === r.days ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500'}`}
              >
                {isAr ? r.ar : r.en}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <DriverStatCard icon={Package} label={isAr ? 'تم التسليم' : 'Delivered'} value={stats?.delivered ?? '—'} accent="emerald" />
          <DriverStatCard icon={XCircle} label={isAr ? 'فشل' : 'Failed'} value={stats?.failed ?? '—'} accent="red" />
          <DriverStatCard
            icon={Percent}
            label={isAr ? 'نسبة النجاح' : 'Success rate'}
            value={stats?.successRate != null ? `${stats.successRate}%` : '—'}
            accent="teal"
          />
          <DriverStatCard
            icon={Timer}
            label={isAr ? 'متوسط التوصيل (د)' : 'Avg delivery (min)'}
            value={stats?.avgPickupToDeliverMin ?? stats?.avgAssignToDeliverMin ?? '—'}
            accent="violet"
          />
        </div>
        {stats?.cashCollected > 0 && (
          <p className="mt-2 px-1 text-xs text-slate-500">
            {isAr ? 'نقدية حُصّلت في الفترة: ' : 'Cash collected in this period: '}
            <span className="font-semibold text-slate-700">{formatPrice(stats.cashCollected)}</span>
          </p>
        )}
      </div>

      <DriverPushToggle isAr={isAr} />

      {config?.cashTrackingEnabled !== false && <DriverCashCard summary={cash} isAr={isAr} />}

      {availabilityEnabled && (
        <DriverAvailabilityToggle
          available={config?.driverAvailable !== false}
          busy={availabilityBusy}
          onChange={setAvailability}
          isAr={isAr}
          variant="panel"
        />
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-100 text-base font-bold text-teal-800">
            {(user?.name || '?').slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate font-bold text-slate-900">{user?.name || user?.username}</p>
            <p className="truncate text-xs text-slate-500">{isAr ? 'مندوب توصيل' : 'Delivery driver'}</p>
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          <Row icon={UserRound} label={isAr ? 'اسم المستخدم' : 'Username'} value={user?.username ? `@${user.username}` : ''} />
          <Row icon={Phone} label={isAr ? 'الهاتف' : 'Phone'} value={user?.phone} />
          <Row icon={ShieldCheck} label={isAr ? 'الصلاحية' : 'Role'} value={isAr ? 'مندوب' : 'Driver'} />
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full border-red-200 text-red-700 hover:bg-red-50"
        onClick={() => logout()}
      >
        <LogOut className="h-4 w-4" aria-hidden />
        {isAr ? 'تسجيل الخروج' : 'Log out'}
      </Button>

      <p className="text-center text-xs text-slate-400">
        {isAr ? 'تطبيق المندوب' : 'Driver app'} · {isAr ? 'سوق+' : 'MarketPlus'}
      </p>
    </div>
  );
}
