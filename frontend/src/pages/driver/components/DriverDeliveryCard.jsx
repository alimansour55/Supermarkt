import { Link } from '../../../app/router';
import {
  Banknote, ChevronLeft, ChevronRight, Clock, MapPin, Package,
} from 'lucide-react';
import DriverStatusBadge from './DriverStatusBadge';
import {
  formatDeliverySlot, formatDriverAddress, formatOrderTotal, paymentLabel,
} from '../driverUtils';

export default function DriverDeliveryCard({ order, isAr }) {
  const slot = formatDeliverySlot(order.deliveryTimeSlot, isAr);
  const isCod = order.paymentMethod === 'cod' && order.paymentStatus !== 'paid';
  const Chevron = isAr ? ChevronLeft : ChevronRight;

  return (
    <Link
      to={`/driver/deliveries/${order._id}`}
      className="group block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition active:scale-[0.99] hover:border-teal-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3 px-4 pt-3.5">
        <div className="min-w-0">
          <p className="font-mono text-lg font-bold tabular-nums text-slate-900">
            #{order.orderNumber}
          </p>
          {order.customerName && (
            <p className="mt-0.5 truncate text-sm text-slate-600">{order.customerName}</p>
          )}
        </div>
        <DriverStatusBadge status={order.orderStatus || 'out_for_delivery'} isAr={isAr} size="sm" />
      </div>

      <div className="px-4 py-3">
        <p className="flex items-start gap-2 text-sm text-slate-600">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" aria-hidden />
          <span className="line-clamp-2 leading-relaxed">
            {formatDriverAddress(order.shippingAddress, isAr)}
          </span>
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          {order.itemCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 font-medium text-slate-700">
              <Package className="h-3.5 w-3.5" aria-hidden />
              {order.itemCount} {isAr ? 'قطعة' : 'items'}
            </span>
          )}
          {slot && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2 py-1 font-medium text-indigo-800">
              <Clock className="h-3.5 w-3.5" aria-hidden />
              {slot}
            </span>
          )}
          {isCod && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 font-semibold text-amber-900">
              <Banknote className="h-3.5 w-3.5" aria-hidden />
              {formatOrderTotal(order)}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/80 px-4 py-2.5 text-sm">
        <span className="text-slate-500">{paymentLabel(order, isAr)}</span>
        <span className="inline-flex items-center gap-0.5 font-semibold text-teal-700 group-hover:underline">
          {isAr ? 'فتح الطلب' : 'Open'}
          <Chevron className="h-4 w-4" aria-hidden />
        </span>
      </div>
    </Link>
  );
}
