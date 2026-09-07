import { useMemo } from 'react';
import {
  RECURRING_FREQUENCIES,
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
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-xs font-semibold text-text">
          {isAr ? 'يوم التوصيل الدوري' : 'Your recurring delivery day'}
        </p>
        {frequency === 'monthly' ? (
          <>
            <p className="mb-2 text-[11px] text-text-muted">
              {isAr ? 'اختر رقم اليوم من كل شهر' : 'Choose the day of each month'}
            </p>
            <div className="grid grid-cols-7 gap-1.5">
              {monthlyDays.map((day) => {
                const selected = Number(preferredDayOfMonth) === day;
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => onChange({
                      recurringPreferredDayOfMonth: day,
                      scheduledDate: computeFirstRecurringDeliveryDate({
                        frequency: 'monthly',
                        preferredDayOfMonth: day,
                        slotFrom,
                      }, new Date(), timeSlots, minLeadMinutes),
                    })}
                    className={`rounded-lg border py-2 text-sm font-semibold transition-colors ${
                      selected
                        ? 'border-violet-600 bg-violet-600 text-white'
                        : 'border-border bg-white text-text hover:border-violet-300 hover:bg-violet-50'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <p className="mb-2 text-[11px] text-text-muted">
              {isAr ? 'اختر يوم الأسبوع للتوصيل المتكرر' : 'Choose the weekday for repeat delivery'}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {WEEKDAYS_DISPLAY_ORDER.map((day) => {
                const selected = Number(preferredWeekday) === day.index;
                return (
                  <button
                    key={day.index}
                    type="button"
                    onClick={() => onChange({
                      recurringPreferredWeekday: day.index,
                      scheduledDate: computeFirstRecurringDeliveryDate({
                        frequency,
                        preferredWeekday: day.index,
                        slotFrom,
                      }, new Date(), timeSlots, minLeadMinutes),
                    })}
                    className={`rounded-xl border px-2 py-2.5 text-sm font-semibold transition-colors ${
                      selected
                        ? 'border-violet-600 bg-violet-600 text-white shadow-sm'
                        : 'border-border bg-white text-text hover:border-violet-300 hover:bg-violet-50'
                    }`}
                  >
                    {isAr ? day.labelAr : day.labelEn}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="rounded-xl border border-violet-200 bg-violet-50/80 px-4 py-3 text-sm">
        <p className="font-semibold text-violet-900">
          {isAr ? 'جدول التوصيل' : 'Your schedule'}
        </p>
        <p className="mt-1 text-violet-800">{summary}</p>
        <p className="mt-2 text-xs text-violet-700">
          {isAr ? 'أول توصيل:' : 'First delivery:'}{' '}
          <span className="font-semibold">{firstDelivery}</span>
        </p>
        <p className="mt-1 text-[11px] text-violet-600">
          {RECURRING_FREQUENCIES.find((f) => f.value === frequency)
            ? (isAr
              ? RECURRING_FREQUENCIES.find((f) => f.value === frequency).hintAr
              : RECURRING_FREQUENCIES.find((f) => f.value === frequency).hintEn)
            : ''}
        </p>
      </div>
    </div>
  );
}
