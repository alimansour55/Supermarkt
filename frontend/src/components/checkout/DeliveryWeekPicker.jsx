import { useMemo } from 'react';
import { buildDeliveryWeekDays, WEEKDAY_AR_FULL, WEEKDAY_EN_FULL } from '../../constants/deliveryOptions';

export default function DeliveryWeekPicker({
  value,
  onChange,
  language = 'ar',
  className = '',
  timeSlots = [],
  minLeadMinutes,
}) {
  const isAr = language === 'ar';
  const days = useMemo(
    () => buildDeliveryWeekDays(new Date(), 14, timeSlots, minLeadMinutes),
    [timeSlots, minLeadMinutes],
  );

  return (
    <div className={className}>
      <p className="mb-2 text-xs font-medium text-text-muted">
        {isAr ? 'اختر يوم التوصيل (متاح خلال 7 أيام)' : 'Choose delivery day (available for 7 days)'}
      </p>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
        {days.map((day) => {
          const weekday = (isAr ? WEEKDAY_AR_FULL : WEEKDAY_EN_FULL)[day.date.getDay()];
          const dayNum = day.date.getDate();
          const month = day.date.getMonth() + 1;
          const selected = value === day.value;
          const disabled = !day.selectable;

          return (
            <button
              key={day.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(day.value)}
              className={`flex min-h-[4.5rem] flex-col items-center justify-center rounded-xl border px-1 py-2 text-center transition-all ${
                disabled
                  ? 'cursor-not-allowed border-border/60 bg-slate-50 text-slate-300 opacity-60'
                  : selected
                    ? 'border-primary-600 bg-primary-600 text-white shadow-md shadow-primary-600/20'
                    : 'border-border bg-white text-text hover:border-primary-300 hover:bg-primary-50/50'
              }`}
              aria-pressed={selected}
              aria-disabled={disabled}
            >
              <span className={`text-[10px] font-semibold uppercase ${selected ? 'text-white/90' : 'text-text-muted'}`}>
                {weekday}
              </span>
              <span className="text-lg font-bold leading-none">{dayNum}</span>
              <span className={`text-[10px] ${selected ? 'text-white/80' : 'text-text-muted'}`}>
                {isAr ? `${month}/${day.date.getFullYear()}` : `${month}/${String(day.date.getFullYear()).slice(-2)}`}
              </span>
              {day.isToday && !disabled && (
                <span className={`mt-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                  selected ? 'bg-white/20 text-white' : 'bg-primary-100 text-primary-700'
                }`}
                >
                  {isAr ? 'اليوم' : 'Today'}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
