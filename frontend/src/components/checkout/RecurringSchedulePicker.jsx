import { useMemo } from 'react';
import {
  WEEKDAYS_DISPLAY_ORDER,
  buildRecurringScheduleSummary,
  computeFirstRecurringDeliveryDate,
} from '../../constants/deliveryOptions';

export default function RecurringSchedulePicker({
  frequency,
  preferredWeekday,
  preferredDayOfMonth,
  timeSlotLabelAr,
  timeSlotLabelEn,
  timeSlots = [],
  slotFrom,
  minLeadMinutes,
  onChange,
  language = 'ar',
}) {
  const isAr = language === 'ar';

  const summary = useMemo(() => buildRecurringScheduleSummary({
    frequency,
    preferredWeekday,
    preferredDayOfMonth,
    timeSlotLabelAr,
    timeSlotLabelEn,
  }, isAr), [frequency, preferredWeekday, preferredDayOfMonth, timeSlotLabelAr, timeSlotLabelEn, isAr]);

  const firstDelivery = useMemo(() => computeFirstRecurringDeliveryDate({
    frequency,
    preferredWeekday,
    preferredDayOfMonth,
    slotFrom,
  }, new Date(), timeSlots, minLeadMinutes), [frequency, preferredWeekday, preferredDayOfMonth, slotFrom, timeSlots, minLeadMinutes]);

  const monthlyDays = useMemo(() => Array.from({ length: 28 }, (_, i) => i + 1), []);

  return (
    <>
      <div>
        <label className="mb-1 block text-xs font-semibold text-text">
          {frequency === 'monthly'
            ? (isAr ? 'يوم الشهر' : 'Day of month')
            : (isAr ? 'يوم الأسبوع' : 'Weekday')}
        </label>
        {frequency === 'monthly' ? (
          <select
            value={preferredDayOfMonth || ''}
            onChange={(e) => onChange({
              recurringPreferredDayOfMonth: Number(e.target.value),
              scheduledDate: computeFirstRecurringDeliveryDate({
                frequency: 'monthly',
                preferredDayOfMonth: Number(e.target.value),
                slotFrom,
              }, new Date(), timeSlots, minLeadMinutes),
            })}
            className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          >
            {monthlyDays.map((day) => (
              <option key={day} value={day}>{day}</option>
            ))}
          </select>
        ) : (
          <select
            value={preferredWeekday ?? ''}
            onChange={(e) => onChange({
              recurringPreferredWeekday: Number(e.target.value),
              scheduledDate: computeFirstRecurringDeliveryDate({
                frequency,
                preferredWeekday: Number(e.target.value),
                slotFrom,
              }, new Date(), timeSlots, minLeadMinutes),
            })}
            className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          >
            {WEEKDAYS_DISPLAY_ORDER.map((day) => (
              <option key={day.index} value={day.index}>{isAr ? day.labelAr : day.labelEn}</option>
            ))}
          </select>
        )}
      </div>

      <p className="col-span-2 text-xs text-violet-700">
        {summary} · {isAr ? 'أول توصيل:' : 'First delivery:'} <span className="font-semibold text-violet-900">{firstDelivery}</span>
      </p>
    </>
  );
}
