import { Calendar, Clock, MapPin, Package, Phone } from 'lucide-react';
import { formatDate } from '../../utils/formatters';
import {
  getItemConditionLabel,
  getPickupSlotLabel,
  getReturnMethodLabel,
} from '../../constants/returnPickup';

export default function ReturnPickupDetails({ ret, isAr, compact = false }) {
  if (!ret?.pickupDate && !ret?.pickupSlotId) return null;

  const dateLabel = ret.pickupDate
    ? formatDate(ret.pickupDate, isAr ? 'ar-EG' : 'en-GB')
    : '—';

  const slotLabel = getPickupSlotLabel(ret, isAr);
  const methodLabel = getReturnMethodLabel(ret.returnMethod, isAr);
  const conditionLabel = getItemConditionLabel(ret, isAr);

  if (compact) {
    return (
      <p className="mt-1 text-xs text-text-muted">
        {methodLabel}
        {' · '}
        {dateLabel}
        {slotLabel ? ` · ${slotLabel}` : ''}
      </p>
    );
  }

  return (
    <div className="mt-3 grid gap-2 rounded-xl border border-border/80 bg-white/80 p-3 text-sm sm:grid-cols-2">
      <div className="flex items-start gap-2">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" />
        <div>
          <p className="text-xs font-semibold text-text-muted">
            {isAr ? 'طريقة الإرجاع' : 'Return method'}
          </p>
          <p className="font-medium text-text">{methodLabel}</p>
        </div>
      </div>
      <div className="flex items-start gap-2">
        <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" />
        <div>
          <p className="text-xs font-semibold text-text-muted">
            {isAr ? 'تاريخ الإرجاع' : 'Return date'}
          </p>
          <p className="font-medium text-text">{dateLabel}</p>
        </div>
      </div>
      <div className="flex items-start gap-2">
        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" />
        <div>
          <p className="text-xs font-semibold text-text-muted">
            {isAr ? 'الفترة الزمنية' : 'Time window'}
          </p>
          <p className="font-medium text-text">{slotLabel || '—'}</p>
        </div>
      </div>
      <div className="flex items-start gap-2">
        <Package className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" />
        <div>
          <p className="text-xs font-semibold text-text-muted">
            {isAr ? 'حالة المنتج' : 'Product condition'}
          </p>
          <p className="font-medium text-text">{conditionLabel}</p>
        </div>
      </div>
      {ret.contactPhone && (
        <div className="flex items-start gap-2 sm:col-span-2">
          <Phone className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" />
          <div>
            <p className="text-xs font-semibold text-text-muted">
              {isAr ? 'هاتف التواصل' : 'Contact phone'}
            </p>
            <p className="font-medium text-text" dir="ltr">
              {ret.contactPhone}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
