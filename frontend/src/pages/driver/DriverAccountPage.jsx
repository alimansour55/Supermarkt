import { useOutletContext } from 'react-router-dom';
import { LogOut, Package, Phone, ShieldCheck, UserRound, XCircle } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { orderService } from '../../services/apiServices';
import { useAsyncData } from '../../hooks/useAsyncData';
import Button from '../../components/ui/Button';
import DriverAvailabilityToggle from '../../components/driver/DriverAvailabilityToggle';
import DriverStatCard from './components/DriverStatCard';
import { isToday } from './driverUtils';

async function fetchHistory() {
  const { data } = await orderService.getDriverHistory();
  return data.data || [];
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
  const { data: history } = useAsyncData(fetchHistory, []);

  const availabilityEnabled = config?.availabilityEnabled === true;
  const todayOrders = (history || []).filter((o) => isToday(o.deliveredAt));
  const deliveredToday = todayOrders.filter((o) => o.orderStatus === 'delivered').length;
  const failedToday = todayOrders.filter((o) => o.orderStatus === 'delivery_failed').length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">{isAr ? 'حسابي' : 'My account'}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {isAr ? 'بياناتك وحالة العمل' : 'Your details and work status'}
        </p>
      </div>

      {history && history.length > 0 && (
        <div>
          <p className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-slate-400">
            {isAr ? 'أداء اليوم' : "Today's performance"}
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            <DriverStatCard icon={Package} label={isAr ? 'تم التسليم' : 'Delivered'} value={deliveredToday} accent="emerald" />
            <DriverStatCard icon={XCircle} label={isAr ? 'فشل' : 'Failed'} value={failedToday} accent="red" />
          </div>
        </div>
      )}

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
