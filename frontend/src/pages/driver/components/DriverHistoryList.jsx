import { Link } from '../../../app/router';
import { Banknote, MapPin, Package } from 'lucide-react';
import DriverStatusBadge from './DriverStatusBadge';
import { formatDriverAddress, formatOrderTotal, paymentLabel } from '../driverUtils';

function dayKey(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function groupLabel(iso, isAr) {
  const now = new Date();
  const todayKey = dayKey(now.toISOString());
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const key = dayKey(iso);

  if (key === todayKey) return isAr ? 'اليوم' : 'Today';
  if (key === dayKey(yesterday.toISOString())) return isAr ? 'أمس' : 'Yesterday';
  return new Date(iso).toLocaleDateString(isAr ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short' });
}

export function groupHistoryByDay(history, isAr) {
  const groups = new Map();
  history.forEach((order) => {
    const iso = order.deliveredAt || order.createdAt;
    const label = groupLabel(iso, isAr);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(order);
  });
  return Array.from(groups.entries());
}

export default function DriverHistoryList({ history, isAr }) {
  const groups = groupHistoryByDay(history, isAr);

  return (
    <div className="space-y-5">
      {groups.map(([label, orders]) => (
        <div key={label}>
          <h3 className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-slate-400">{label}</h3>
          <ul className="space-y-2">
            {orders.map((order) => {
              const failed = order.orderStatus === 'delivery_failed';
              const time = order.deliveredAt
                ? new Date(order.deliveredAt).toLocaleTimeString(isAr ? 'ar-EG' : undefined, { hour: '2-digit', minute: '2-digit' })
                : '';
              return (
                <li key={order._id}>
                  <Link
                    to={`/driver/deliveries/${order._id}`}
                    className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-teal-300"
                  >
                    {order.deliveryProofPhoto ? (
                      <img src={order.deliveryProofPhoto} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${failed ? 'bg-red-50 text-red-400' : 'bg-emerald-50 text-emerald-500'}`}>
                        <Package className="h-5 w-5" aria-hidden />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-mono text-sm font-bold tabular-nums text-slate-900">#{order.orderNumber}</p>
                        <DriverStatusBadge status={order.orderStatus} isAr={isAr} size="sm" />
                      </div>
                      <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-500">
                        <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                        {formatDriverAddress(order.shippingAddress, isAr)}
                      </p>
                      <div className="mt-1.5 flex items-center justify-between text-xs">
                        <span className="text-slate-400">{time} · {paymentLabel(order, isAr)}</span>
                        {order.paymentMethod === 'cod' && (
                          <span className="inline-flex items-center gap-1 font-semibold text-amber-800">
                            <Banknote className="h-3 w-3" aria-hidden />
                            {formatOrderTotal(order)}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
