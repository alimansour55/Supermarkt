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
      <p className="mb-1.5 text-xs font-medium text-text-muted">
        {isAr ? 'اختر يوم التوصيل (متاح خلال 7 أيام)' : 'Choose delivery day (available for 7 days)'}
      </p>
      <div className="scrollbar-thin flex gap-1.5 overflow-x-auto pb-1">
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
              className={`flex h-14 w-12 shrink-0 flex-col items-center justify-center rounded-xl border px-1 py-1 text-center transition-all ${
                disabled
                  ? 'cursor-not-allowed border-border/60 bg-slate-50 text-slate-300 opacity-60'
                  : selected
                    ? 'border-primary-600 bg-primary-600 text-white shadow-md shadow-primary-600/20'
                    : 'border-border bg-white text-text hover:border-primary-300 hover:bg-primary-50/50'
              }`}
              aria-pressed={selected}
              aria-disabled={disabled}
            >
              <span className={`text-[9px] font-semibold uppercase ${selected ? 'text-white/90' : 'text-text-muted'}`}>
                {day.isToday ? (isAr ? 'اليوم' : 'Today') : weekday}
              </span>
              <span className="text-base font-bold leading-none">{dayNum}</span>
              <span className={`text-[9px] ${selected ? 'text-white/80' : 'text-text-muted'}`}>
                {month}/{isAr ? day.date.getFullYear() : String(day.date.getFullYear()).slice(-2)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
