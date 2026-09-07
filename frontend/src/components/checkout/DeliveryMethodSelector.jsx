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
    <div className="space-y-3">
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
            className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-all ${
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
              className="mt-1.5 shrink-0 accent-primary-600"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <MethodIcon method={method} />
                <p className="font-semibold text-text">
                  {isAr ? meta.labelAr : meta.labelEn}
                </p>
              </div>
              <p className="mt-1 text-sm text-text-muted">
                {isAr ? meta.descAr : meta.descEn}
              </p>
              <p className="mt-0.5 text-xs text-text-muted">
                {isAr ? meta.etaAr : meta.etaEn}
              </p>
              {method === 'express' && !expressOpenNow && expressAvailable && (
                <p className="mt-2 text-xs text-amber-800">
                  {isAr
                    ? `التوصيل السريع غير متاح الآن — يتطلب ${formatLeadMinutesLabel(expressLeadMinutes, 'ar')} على الأقل قبل نهاية مواعيد اليوم`
                    : `Express is unavailable now — needs at least ${formatLeadMinutesLabel(expressLeadMinutes, 'en')} before today's last slot ends`}
                </p>
              )}
              {freeNote && (
                <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-900">
                  {freeNote}
                </p>
              )}

              {selected && showScheduleFields && method === deliveryMethod && (
                <div className="mt-4 space-y-4 rounded-xl border border-primary-100 bg-white/80 p-4">
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
                    <>
                      <div>
                        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-text">
                          <CalendarClock className="h-4 w-4 text-violet-600" aria-hidden />
                          {isAr ? 'تكرار التوصيل' : 'Delivery frequency'}
                        </p>
                        <div className="grid gap-2 sm:grid-cols-3">
                          {RECURRING_FREQUENCIES.map((freq) => (
                            <label
                              key={freq.value}
                              className={`cursor-pointer rounded-xl border px-3 py-2.5 text-center text-sm transition-colors ${
                                form.recurringFrequency === freq.value
                                  ? 'border-violet-500 bg-violet-50 font-semibold text-violet-900'
                                  : 'border-border hover:border-violet-200'
                              }`}
                            >
                              <input
                                type="radio"
                                name="recurringFrequency"
                                className="sr-only"
                                checked={form.recurringFrequency === freq.value}
                                onChange={() => onFormChange({
                                  recurringFrequency: freq.value,
                                  scheduledDate: computeFirstRecurringDeliveryDate({
                                    frequency: freq.value,
                                    preferredWeekday: form.recurringPreferredWeekday,
                                    preferredDayOfMonth: form.recurringPreferredDayOfMonth,
                                    slotFrom: selectedSlot?.from,
                                  }, new Date(), timeSlots, scheduledLeadMinutes),
                                })}
                              />
                              <span className="block">{isAr ? freq.labelAr : freq.labelEn}</span>
                              <span className="mt-0.5 block text-[10px] text-text-muted">
                                {isAr ? freq.hintAr : freq.hintEn}
                              </span>
                            </label>
                          ))}
                        </div>
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

                      <p className="text-[11px] leading-relaxed text-text-muted">
                        {isAr
                          ? 'يمكنك إيقاف أو إلغاء التوصيل الدوري في أي وقت من صفحة حسابك بعد الطلب.'
                          : 'You can pause or cancel recurring delivery anytime from your account after ordering.'}
                      </p>
                    </>
                  )}

                  {method !== 'express' && (
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-text">
                        {isAr ? 'موعد التوصيل' : 'Time slot'}
                      </label>
                      <p className="mb-2 text-[11px] text-text-muted">
                        {isAr
                          ? `المواعيد المتاحة تبدأ بعد ${formatLeadMinutesLabel(scheduledLeadMinutes, 'ar')} على الأقل من الآن`
                          : `Available slots start at least ${formatLeadMinutesLabel(scheduledLeadMinutes, 'en')} from now`}
                      </p>
                      <select
                        value={form.scheduledTime}
                        onChange={(e) => onFormChange({ scheduledTime: e.target.value })}
                        className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
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
