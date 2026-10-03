import { CalendarClock, RefreshCw, Truck, Zap } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import {
  DELIVERY_METHODS,
  RECURRING_FREQUENCIES,
  computeFirstRecurringDeliveryDate,
  defaultBookingDate,
} from '../../constants/deliveryOptions';
import { formatPrice } from '../../utils/formatters';
import {
  filterAvailableSlots,
  getEarliestBooking,
  isExpressAvailableNow,
  resolveSelectedSlot,
} from '../../utils/deliverySlotAvailability';
import {
  formatLeadMinutesLabel,
  resolveDeliveryLeadMinutes,
} from '../../utils/deliveryLeadTime';
import {
  getMethodFreeDeliveryNote,
  isFreeDeliveryForMethod,
  filterFreeDeliveryMethods,
} from '../../utils/freeDelivery';
import DeliveryWeekPicker from './DeliveryWeekPicker';
import RecurringSchedulePicker from './RecurringSchedulePicker';

function MethodIcon({ method }) {
  if (method === 'express') return <Zap className="h-5 w-5 shrink-0 text-amber-500" aria-hidden />;
  if (method === 'recurring') return <RefreshCw className="h-5 w-5 shrink-0 text-violet-600" aria-hidden />;
  return <Truck className="h-5 w-5 shrink-0 text-primary-600" aria-hidden />;
}

export { resolveSelectedSlot };

export default function DeliveryMethodSelector({
  deliveryMethod,
  onDeliveryMethodChange,
  form,
  onFormChange,
  timeSlots = [],
  language = 'ar',
  subtotal = 0,
  freeDeliveryThreshold = 500,
  freeDeliveryMethods = ['scheduled', 'recurring'],
  freeDeliveryFromCoupon = false,
  scheduledFee = 29.99,
  expressFee = 49.99,
  expressAvailable = true,
  scheduledAvailable = true,
  showScheduleFields = true,
  bannerSettings = null,
  storeSettings = null,
  deliveryZone = null,
}) {
  const isAr = language === 'ar';
  const scheduledLeadMinutes = useMemo(
    () => resolveDeliveryLeadMinutes({ deliveryMethod: 'scheduled', storeSettings, zone: deliveryZone }),
    [storeSettings, deliveryZone],
  );
  const expressLeadMinutes = useMemo(
    () => resolveDeliveryLeadMinutes({ deliveryMethod: 'express', storeSettings, zone: deliveryZone }),
    [storeSettings, deliveryZone],
  );
  const expressOpenNow = useMemo(
    () => isExpressAvailableNow({ slots: timeSlots, minLeadMinutes: expressLeadMinutes }),
    [timeSlots, expressLeadMinutes],
  );
  const availableSlotsForDate = useMemo(
    () => filterAvailableSlots(timeSlots, form.scheduledDate, new Date(), scheduledLeadMinutes),
    [timeSlots, form.scheduledDate, scheduledLeadMinutes],
  );
  const selectedSlot = resolveSelectedSlot(
    timeSlots,
    form.scheduledTime,
    form.scheduledDate,
    new Date(),
    scheduledLeadMinutes,
  );
  const methods = filterFreeDeliveryMethods(freeDeliveryMethods);
  const thresholdMet = freeDeliveryFromCoupon || subtotal >= freeDeliveryThreshold;

  const fees = useMemo(() => ({
    scheduled: isFreeDeliveryForMethod({
      deliveryMethod: 'scheduled',
      subtotal,
      threshold: freeDeliveryThreshold,
      freeDeliveryMethods: methods,
      freeDeliveryFromCoupon,
    }) ? 0 : scheduledFee,
    express: isFreeDeliveryForMethod({
      deliveryMethod: 'express',
      subtotal,
      threshold: freeDeliveryThreshold,
      freeDeliveryMethods: methods,
      freeDeliveryFromCoupon,
    }) ? 0 : expressFee,
    recurring: isFreeDeliveryForMethod({
      deliveryMethod: 'recurring',
      subtotal,
      threshold: freeDeliveryThreshold,
      freeDeliveryMethods: methods,
      freeDeliveryFromCoupon,
    }) ? 0 : scheduledFee,
  }), [subtotal, freeDeliveryThreshold, methods, freeDeliveryFromCoupon, scheduledFee, expressFee]);

  useEffect(() => {
    if (deliveryMethod !== 'scheduled' && deliveryMethod !== 'recurring') return;
    if (!timeSlots.length) return;

    const earliest = getEarliestBooking({ slots: timeSlots, minLeadMinutes: scheduledLeadMinutes });
    if (!earliest) return;

    const patch = {};
    const dateHasSlots = availableSlotsForDate.length > 0;
    if (!form.scheduledDate || !dateHasSlots) {
      patch.scheduledDate = earliest.date;
    }
    const slotsForDate = dateHasSlots
      ? availableSlotsForDate
      : filterAvailableSlots(timeSlots, earliest.date, new Date(), scheduledLeadMinutes);
    const validTime = slotsForDate.some((slot) => String(slot._id) === String(form.scheduledTime));
    if (!validTime && slotsForDate[0]) {
      patch.scheduledTime = slotsForDate[0]._id;
    }
    if (Object.keys(patch).length) {
      onFormChange(patch);
    }
  }, [
    deliveryMethod,
    timeSlots,
    form.scheduledDate,
    form.scheduledTime,
    availableSlotsForDate,
    scheduledLeadMinutes,
    onFormChange,
  ]);

  useEffect(() => {
    if (deliveryMethod !== 'scheduled' || form.scheduledDate) return;
    onFormChange({ scheduledDate: defaultBookingDate(new Date(), timeSlots, scheduledLeadMinutes) });
  }, [deliveryMethod, form.scheduledDate, onFormChange, timeSlots, scheduledLeadMinutes]);
  useEffect(() => {
    if (deliveryMethod !== 'recurring') return;
    const weekday = form.recurringPreferredWeekday ?? new Date().getDay();
    const dayOfMonth = form.recurringPreferredDayOfMonth || new Date().getDate();
    const scheduledDate = computeFirstRecurringDeliveryDate({
      frequency: form.recurringFrequency || 'weekly',
      preferredWeekday: weekday,
      preferredDayOfMonth: dayOfMonth,
      slotFrom: selectedSlot?.from,
    }, new Date(), timeSlots, scheduledLeadMinutes);
    const patch = {};
    if (form.recurringPreferredWeekday == null || form.recurringPreferredWeekday === '') {
      patch.recurringPreferredWeekday = weekday;
    }
    if (!form.recurringPreferredDayOfMonth) {
      patch.recurringPreferredDayOfMonth = dayOfMonth;
    }
    if (form.scheduledDate !== scheduledDate) {
      patch.scheduledDate = scheduledDate;
    }
    if (Object.keys(patch).length) {
      onFormChange(patch);
    }
  }, [
    deliveryMethod,
    form.recurringPreferredWeekday,
    form.recurringPreferredDayOfMonth,
    form.recurringFrequency,
    form.scheduledDate,
    selectedSlot?.from,
    timeSlots,
    scheduledLeadMinutes,
    onFormChange,
  ]);

  useEffect(() => {
    if (deliveryMethod === 'express' && expressAvailable === false) {
      onDeliveryMethodChange('scheduled');
    }
    if (deliveryMethod === 'scheduled' && scheduledAvailable === false && expressAvailable) {
      onDeliveryMethodChange('express');
    }
  }, [deliveryMethod, expressAvailable, scheduledAvailable, onDeliveryMethodChange]);

  const methodList = ['scheduled', 'express', 'recurring'];

  return (
    <div className="space-y-1.5">
      {methodList.map((method) => {
        const meta = DELIVERY_METHODS[method];
        const disabled = (method === 'express' && (!expressAvailable || !expressOpenNow))
          || (method === 'scheduled' && !scheduledAvailable);
        const selected = deliveryMethod === method;
        const fee = fees[method];
        const freeNote = getMethodFreeDeliveryNote({
          isAr,
          method,
          thresholdMet,
          freeDeliveryMethods: methods,
          bannerSettings,
        });

        return (
          <label
            key={method}
            className={`flex cursor-pointer items-start gap-2.5 rounded-2xl border p-2.5 transition-all ${
              disabled ? 'cursor-not-allowed opacity-50' : ''
            } ${
              selected
                ? 'border-primary-500 bg-primary-50/80 ring-1 ring-primary-500/30'
                : 'border-border bg-white hover:border-primary-200 hover:shadow-sm'
            }`}
          >
            <input
              type="radio"
              name="deliveryMethodSelector"
              checked={selected}
              disabled={disabled}
              onChange={() => onDeliveryMethodChange(method)}
              className="mt-1 shrink-0 accent-primary-600"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <MethodIcon method={method} />
                <p className="font-semibold text-text">
                  {isAr ? meta.labelAr : meta.labelEn}
                </p>
                <span className="text-xs text-text-muted">· {isAr ? meta.etaAr : meta.etaEn}</span>
              </div>
              {method === 'express' && !expressOpenNow && expressAvailable && (
                <p className="mt-1.5 text-xs text-amber-800">
                  {isAr
                    ? `غير متاح الآن — يتطلب ${formatLeadMinutesLabel(expressLeadMinutes, 'ar')} على الأقل`
                    : `Unavailable now — needs at least ${formatLeadMinutesLabel(expressLeadMinutes, 'en')}`}
                </p>
              )}
              {freeNote && selected && (
                <p className="mt-1.5 rounded-lg bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900">
                  {freeNote}
                </p>
              )}

              {selected && showScheduleFields && method === deliveryMethod && (
                <div className="mt-2 space-y-2 rounded-xl border border-primary-100 bg-white/80 p-2.5">
                  {method === 'scheduled' && (
                    <DeliveryWeekPicker
                      value={form.scheduledDate}
                      onChange={(scheduledDate) => onFormChange({ scheduledDate })}
                      language={language}
                      timeSlots={timeSlots}
                      minLeadMinutes={scheduledLeadMinutes}
                    />
                  )}

                  {method === 'recurring' && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 flex items-center gap-1 text-xs font-semibold text-text">
                          <CalendarClock className="h-3.5 w-3.5 text-violet-600" aria-hidden />
                          {isAr ? 'التكرار' : 'Frequency'}
                        </label>
                        <select
                          value={form.recurringFrequency || 'weekly'}
                          onChange={(e) => onFormChange({
                            recurringFrequency: e.target.value,
                            scheduledDate: computeFirstRecurringDeliveryDate({
                              frequency: e.target.value,
                              preferredWeekday: form.recurringPreferredWeekday,
                              preferredDayOfMonth: form.recurringPreferredDayOfMonth,
                              slotFrom: selectedSlot?.from,
                            }, new Date(), timeSlots, scheduledLeadMinutes),
                          })}
                          className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                        >
                          {RECURRING_FREQUENCIES.map((freq) => (
                            <option key={freq.value} value={freq.value}>
                              {isAr ? freq.labelAr : freq.labelEn}
                            </option>
                          ))}
                        </select>
                      </div>

                      <RecurringSchedulePicker
                        frequency={form.recurringFrequency || 'weekly'}
                        preferredWeekday={form.recurringPreferredWeekday}
                        preferredDayOfMonth={form.recurringPreferredDayOfMonth}
                        timeSlotLabelAr={selectedSlot?.labelAr}
                        timeSlotLabelEn={selectedSlot?.labelEn}
                        timeSlots={timeSlots}
                        slotFrom={selectedSlot?.from}
                        minLeadMinutes={scheduledLeadMinutes}
                        onChange={onFormChange}
                        language={language}
                      />
                    </div>
                  )}

                  {method !== 'express' && (
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-text">
                        {isAr ? 'موعد التوصيل' : 'Time slot'}
                      </label>
                      <select
                        value={form.scheduledTime}
                        onChange={(e) => onFormChange({ scheduledTime: e.target.value })}
                        className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                        required
                        disabled={!availableSlotsForDate.length}
                      >
                        {!availableSlotsForDate.length ? (
                          <option value="">
                            {isAr ? 'لا توجد مواعيد متاحة لهذا اليوم' : 'No slots available for this day'}
                          </option>
                        ) : (
                          availableSlotsForDate.map((slot) => (
                            <option key={slot._id} value={slot._id}>
                              {isAr ? slot.labelAr : slot.labelEn}
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                  )}
                </div>
              )}
            </div>
            <span className={`shrink-0 text-sm font-semibold ${fee === 0 ? 'text-primary-600' : 'text-text'}`}>
              {fee === 0 ? (isAr ? 'مجاني' : 'Free') : formatPrice(fee)}
            </span>
          </label>
        );
      })}
    </div>
  );
}
