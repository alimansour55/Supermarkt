import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import {
  RECURRING_FREQUENCIES,
  buildRecurringScheduleSummary,
} from '../../constants/deliveryOptions';
import { deliveryZoneService } from '../../services/apiServices';
import RecurringSchedulePicker from '../checkout/RecurringSchedulePicker';
import Button from '../ui/Button';

const DEFAULT_SLOTS = [
  { labelAr: 'صباحاً (9-12)', labelEn: 'Morning (9-12)', from: '09:00', to: '12:00' },
  { labelAr: 'مساءً (2-6)', labelEn: 'Afternoon (2-6)', from: '14:00', to: '18:00' },
  { labelAr: 'ليلاً (6-9)', labelEn: 'Evening (6-9)', from: '18:00', to: '21:00' },
];

export default function EditRecurringModal({
  open,
  subscription,
  isAr,
  saving,
  onClose,
  onSave,
}) {
  const [form, setForm] = useState(null);
  const [timeSlots, setTimeSlots] = useState(DEFAULT_SLOTS);

  useEffect(() => {
    if (!open || !subscription) return;
    setForm({
      frequency: subscription.frequency || 'weekly',
      preferredWeekday: subscription.preferredWeekday ?? new Date().getDay(),
      preferredDayOfMonth: subscription.preferredDayOfMonth || new Date().getDate(),
      deliveryTimeSlot: subscription.deliveryTimeSlot || DEFAULT_SLOTS[0],
      notes: subscription.notes || '',
    });
  }, [open, subscription]);

  useEffect(() => {
    if (!open) return;
    deliveryZoneService.list()
      .then(({ data }) => {
        const zones = data.data || [];
        const zone = zones.find((z) => String(z._id || z.id) === String(subscription?.deliveryZone))
          || zones.find((z) => z.nameAr === subscription?.deliveryZoneNameAr)
          || zones[0];
        if (zone?.timeSlots?.length) {
          setTimeSlots(zone.timeSlots.filter((slot) => slot.isActive !== false));
        } else {
          setTimeSlots(DEFAULT_SLOTS);
        }
      })
      .catch(() => setTimeSlots(DEFAULT_SLOTS));
  }, [open, subscription?.deliveryZone, subscription?.deliveryZoneNameAr]);

  const selectedSlot = useMemo(() => {
    if (!form?.deliveryTimeSlot) return timeSlots[0];
    return timeSlots.find((slot) => slot.from === form.deliveryTimeSlot.from
      && slot.to === form.deliveryTimeSlot.to)
      || timeSlots.find((slot) => slot.labelAr === form.deliveryTimeSlot.labelAr)
      || form.deliveryTimeSlot;
  }, [form?.deliveryTimeSlot, timeSlots]);

  const summary = useMemo(() => {
    if (!form) return '';
    return buildRecurringScheduleSummary({
      frequency: form.frequency,
      preferredWeekday: form.preferredWeekday,
      preferredDayOfMonth: form.preferredDayOfMonth,
      timeSlotLabelAr: selectedSlot?.labelAr,
      timeSlotLabelEn: selectedSlot?.labelEn,
    }, isAr);
  }, [form, isAr, selectedSlot]);

  if (!open || !subscription || !form) return null;

  const patchForm = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const handleSave = () => {
    onSave({
      frequency: form.frequency,
      preferredWeekday: form.frequency === 'monthly' ? undefined : Number(form.preferredWeekday),
      preferredDayOfMonth: form.frequency === 'monthly' ? Number(form.preferredDayOfMonth) : undefined,
      deliveryTimeSlot: {
        labelAr: selectedSlot?.labelAr,
        labelEn: selectedSlot?.labelEn,
        from: selectedSlot?.from,
        to: selectedSlot?.to,
      },
      notes: form.notes,
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 p-4 sm:items-center">
      <div
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-recurring-title"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-white px-5 py-4">
          <div>
            <h2 id="edit-recurring-title" className="text-lg font-bold text-text">
              {isAr ? 'تعديل التوصيل الدوري' : 'Edit recurring delivery'}
            </h2>
            <p className="mt-0.5 text-sm text-text-muted">{summary}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 hover:bg-slate-100"
            aria-label={isAr ? 'إغلاق' : 'Close'}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          <div>
            <p className="mb-2 text-xs font-semibold text-text">
              {isAr ? 'تكرار التوصيل' : 'Frequency'}
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              {RECURRING_FREQUENCIES.map((freq) => (
                <button
                  key={freq.value}
                  type="button"
                  onClick={() => patchForm({ frequency: freq.value })}
                  className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
                    form.frequency === freq.value
                      ? 'border-violet-600 bg-violet-50 text-violet-900'
                      : 'border-border hover:border-violet-200'
                  }`}
                >
                  {isAr ? freq.labelAr : freq.labelEn}
                </button>
              ))}
            </div>
          </div>

          <RecurringSchedulePicker
            frequency={form.frequency}
            preferredWeekday={form.preferredWeekday}
            preferredDayOfMonth={form.preferredDayOfMonth}
            timeSlotLabelAr={selectedSlot?.labelAr}
            timeSlotLabelEn={selectedSlot?.labelEn}
            onChange={(patch) => {
              const next = { ...patch };
              if (patch.recurringPreferredWeekday != null) {
                next.preferredWeekday = patch.recurringPreferredWeekday;
                delete next.recurringPreferredWeekday;
              }
              if (patch.recurringPreferredDayOfMonth != null) {
                next.preferredDayOfMonth = patch.recurringPreferredDayOfMonth;
                delete next.recurringPreferredDayOfMonth;
              }
              delete next.scheduledDate;
              patchForm(next);
            }}
            language={isAr ? 'ar' : 'en'}
          />

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-text">
              {isAr ? 'موعد التوصيل' : 'Time slot'}
            </label>
            <select
              value={`${selectedSlot?.from || ''}-${selectedSlot?.to || ''}`}
              onChange={(e) => {
                const slot = timeSlots.find((s) => `${s.from}-${s.to}` === e.target.value);
                if (slot) patchForm({ deliveryTimeSlot: slot });
              }}
              className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
            >
              {timeSlots.map((slot) => (
                <option key={`${slot.from}-${slot.to}`} value={`${slot.from}-${slot.to}`}>
                  {isAr ? slot.labelAr : slot.labelEn}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-text">
              {isAr ? 'ملاحظات للتوصيل' : 'Delivery notes'}
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => patchForm({ notes: e.target.value })}
              rows={3}
              maxLength={500}
              className="w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
              placeholder={isAr ? 'مثال: اتصل قبل الوصول' : 'e.g. Call before arrival'}
            />
          </div>
        </div>

        <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-border bg-white px-5 py-4">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            {isAr ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ التعديلات' : 'Save changes')}
          </Button>
        </div>
      </div>
    </div>
  );
}
