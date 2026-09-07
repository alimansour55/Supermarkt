import { useState } from 'react';
import { X } from 'lucide-react';
import Button from '../../../components/ui/Button';
import {
  RETURN_REJECT_PRESETS,
  RETURN_REJECT_NOTE_MIN,
  getRejectPresetText,
  isRejectNoteValid,
} from '../../../constants/returnRejectReasons';

export default function ReturnRejectForm({
  isAr,
  note,
  onNoteChange,
  onConfirm,
  onCancel,
  updating,
  confirmLabelAr = 'تأكيد الرفض',
  confirmLabelEn = 'Confirm reject',
}) {
  const [showError, setShowError] = useState(false);
  const valid = isRejectNoteValid(note);

  const handleConfirm = () => {
    if (!valid) {
      setShowError(true);
      return;
    }
    setShowError(false);
    onConfirm();
  };

  const applyPreset = (preset) => {
    onNoteChange(getRejectPresetText(preset, isAr));
    setShowError(false);
  };

  return (
    <div className="mt-3 space-y-3 rounded-xl border-2 border-red-200 bg-red-50/50 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-red-900">
            {isAr ? 'سبب رفض الإرجاع' : 'Rejection reason'}
            <span className="text-red-600"> *</span>
          </p>
          <p className="mt-0.5 text-xs text-red-800/80">
            {isAr
              ? 'يظهر للعميل مع حالة «مرفوض». اختر سبباً جاهزاً أو اكتب ملاحظة.'
              : 'Shown to the customer with «Rejected». Pick a suggestion or write your own.'}
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg p-1 text-red-700 hover:bg-red-100"
          aria-label={isAr ? 'إلغاء' : 'Cancel'}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {RETURN_REJECT_PRESETS.map((preset) => (
          <button
            key={preset.key}
            type="button"
            onClick={() => applyPreset(preset)}
            className="rounded-full border border-red-200 bg-white px-2.5 py-1 text-xs font-semibold text-red-900 transition-colors hover:border-red-300 hover:bg-red-50"
          >
            {isAr ? preset.labelAr : preset.labelEn}
          </button>
        ))}
      </div>

      <textarea
        value={note}
        onChange={(e) => {
          onNoteChange(e.target.value);
          if (showError && isRejectNoteValid(e.target.value)) setShowError(false);
        }}
        rows={3}
        placeholder={
          isAr
            ? 'اكتب سبب الرفض للعميل...'
            : 'Write the rejection reason for the customer...'
        }
        className={[
          'w-full resize-y rounded-lg border px-3 py-2 text-sm',
          showError && !valid
            ? 'border-red-500 ring-2 ring-red-200'
            : 'border-border',
        ].join(' ')}
      />

      {showError && !valid && (
        <p className="text-xs font-medium text-red-700">
          {isAr
            ? `يرجى كتابة سبب الرفض (${RETURN_REJECT_NOTE_MIN} أحرف على الأقل) أو اختيار أحد الأسباب أعلاه.`
            : `Please enter a reason (at least ${RETURN_REJECT_NOTE_MIN} characters) or tap a suggestion above.`}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={confirmLabelEn === 'Confirm reject' ? 'danger' : 'primary'}
          disabled={updating}
          onClick={handleConfirm}
        >
          {confirmLabelEn === 'Confirm reject' && <X className="h-4 w-4" />}
          {isAr ? confirmLabelAr : confirmLabelEn}
        </Button>
        <Button size="sm" variant="secondary" disabled={updating} onClick={onCancel}>
          {isAr ? 'إلغاء' : 'Cancel'}
        </Button>
      </div>
    </div>
  );
}
