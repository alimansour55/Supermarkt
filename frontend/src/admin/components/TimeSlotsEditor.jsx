import { Clock, Plus, Trash2 } from 'lucide-react';

const makeSlot = () => ({
  labelAr: '', labelEn: '', from: '09:00', to: '12:00', isActive: true,
});

export default function TimeSlotsEditor({ value = [], onChange, isAr }) {
  const slots = Array.isArray(value) ? value : [];

  const updateSlot = (index, patch) => {
    onChange(slots.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)));
  };

  const removeSlot = (index) => {
    onChange(slots.filter((_, i) => i !== index));
  };

  const addSlot = () => {
    onChange([...slots, makeSlot()]);
  };

  return (
    <div className="md:col-span-2 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-text">
            <Clock className="h-4 w-4 text-text-muted" aria-hidden />
            {isAr ? 'مواعيد التوصيل المتاحة' : 'Available delivery time slots'}
          </p>
          <p className="mt-0.5 text-xs text-text-muted">
            {isAr
              ? 'يختار العميل أحد هذه المواعيد عند التوصيل العادي أو الدوري.'
              : 'Customers pick one of these when ordering standard or recurring delivery.'}
          </p>
        </div>
        <button
          type="button"
          onClick={addSlot}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-100"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          {isAr ? 'إضافة موعد' : 'Add slot'}
        </button>
      </div>

      {slots.length === 0 && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
          {isAr
            ? 'لا توجد مواعيد بعد — أضف موعداً واحداً على الأقل ليتمكن العملاء من الطلب.'
            : 'No time slots yet — add at least one so customers can order.'}
        </p>
      )}

      <div className="space-y-2">
        {slots.map((slot, index) => {
          const invalidRange = slot.from && slot.to && slot.to <= slot.from;
          return (
            <div
              key={index}
              className={`space-y-2 rounded-xl border p-3 ${slot.isActive === false ? 'border-border bg-slate-50 opacity-60' : 'border-border bg-white'}`}
            >
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={slot.labelAr}
                  onChange={(e) => updateSlot(index, { labelAr: e.target.value })}
                  placeholder={isAr ? 'الاسم بالعربي (مثال: صباحاً 9-12)' : 'Label in Arabic'}
                  className="w-full rounded-lg border border-border bg-white px-2.5 py-1.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                />
                <input
                  type="text"
                  value={slot.labelEn}
                  onChange={(e) => updateSlot(index, { labelEn: e.target.value })}
                  placeholder={isAr ? 'الاسم بالإنجليزي' : 'Label in English'}
                  className="w-full rounded-lg border border-border bg-white px-2.5 py-1.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="time"
                  value={slot.from}
                  onChange={(e) => updateSlot(index, { from: e.target.value })}
                  className="rounded-lg border border-border bg-white px-2.5 py-1.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                />
                <span className="text-xs text-text-muted">{isAr ? 'إلى' : 'to'}</span>
                <input
                  type="time"
                  value={slot.to}
                  onChange={(e) => updateSlot(index, { to: e.target.value })}
                  className="rounded-lg border border-border bg-white px-2.5 py-1.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                />
                <label className="flex items-center gap-1.5 text-xs font-medium text-text">
                  <input
                    type="checkbox"
                    checked={slot.isActive !== false}
                    onChange={(e) => updateSlot(index, { isActive: e.target.checked })}
                  />
                  {isAr ? 'مفعّل' : 'Active'}
                </label>
                <button
                  type="button"
                  onClick={() => removeSlot(index)}
                  className="ms-auto flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  {isAr ? 'حذف' : 'Remove'}
                </button>
              </div>
              {invalidRange && (
                <p className="text-xs font-medium text-red-600">
                  {isAr ? 'وقت النهاية يجب أن يكون بعد وقت البداية.' : 'End time must be after start time.'}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
