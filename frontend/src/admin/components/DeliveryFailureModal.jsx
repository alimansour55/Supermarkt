import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import Button from '../../components/ui/Button';
import { DELIVERY_FAILURE_PRESETS } from '../../constants/deliveryFailureReasons';

export default function DeliveryFailureModal({
  open,
  isAr,
  updating,
  onClose,
  onConfirm,
}) {
  const [selectedKey, setSelectedKey] = useState('');
  const [customReason, setCustomReason] = useState('');

  useEffect(() => {
    if (!open) return;
    setSelectedKey('');
    setCustomReason('');
  }, [open]);

  if (!open) return null;

  const useCustom = selectedKey === 'custom';
  const canSubmit = useCustom
    ? customReason.trim().length >= 3
    : Boolean(selectedKey);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSubmit || updating) return;
    onConfirm({
      deliveryFailureReasonKey: useCustom ? 'custom' : selectedKey,
      deliveryFailureReason: useCustom ? customReason.trim() : '',
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/50 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delivery-failure-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-white shadow-xl"
      >
        <div className="flex items-start justify-between border-b border-border px-5 py-4">
          <div>
            <h2 id="delivery-failure-title" className="text-lg font-bold text-text">
              {isAr ? 'فشل التسليم' : 'Delivery failed'}
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              {isAr
                ? 'اختر السبب — سيظهر للعميل على صفحة الطلب'
                : 'Choose a reason — the customer will see it on their order'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={updating}
            className="rounded-lg p-2 text-text-muted hover:bg-slate-100"
            aria-label={isAr ? 'إغلاق' : 'Close'}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <fieldset className="space-y-2">
            <legend className="sr-only">{isAr ? 'أسباب فشل التسليم' : 'Delivery failure reasons'}</legend>
            {DELIVERY_FAILURE_PRESETS.map((preset) => (
              <label
                key={preset.key}
                className={[
                  'flex cursor-pointer items-start gap-3 rounded-xl border-2 px-4 py-3 transition-colors',
                  selectedKey === preset.key
                    ? 'border-red-400 bg-red-50'
                    : 'border-border hover:border-red-200',
                ].join(' ')}
              >
                <input
                  type="radio"
                  name="failureReason"
                  value={preset.key}
                  checked={selectedKey === preset.key}
                  onChange={() => setSelectedKey(preset.key)}
                  className="mt-1"
                />
                <span className="text-sm font-medium text-text">
                  {isAr ? preset.labelAr : preset.labelEn}
                </span>
              </label>
            ))}
            <label
              className={[
                'flex cursor-pointer items-start gap-3 rounded-xl border-2 px-4 py-3 transition-colors',
                useCustom ? 'border-red-400 bg-red-50' : 'border-border hover:border-red-200',
              ].join(' ')}
            >
              <input
                type="radio"
                name="failureReason"
                value="custom"
                checked={useCustom}
                onChange={() => setSelectedKey('custom')}
                className="mt-1"
              />
              <span className="text-sm font-medium text-text">
                {isAr ? 'سبب آخر (اكتب بنفسك)' : 'Other (write your own)'}
              </span>
            </label>
          </fieldset>

          {useCustom && (
            <textarea
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder={
                isAr
                  ? 'اشرح سبب فشل التسليم للعميل...'
                  : 'Explain the delivery failure to the customer...'
              }
              className="w-full rounded-xl border border-border px-3 py-2 text-sm focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-200"
            />
          )}

          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <Button type="submit" variant="danger" disabled={!canSubmit || updating}>
              {isAr ? 'تأكيد فشل التسليم' : 'Confirm delivery failed'}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose} disabled={updating}>
              {isAr ? 'إلغاء' : 'Cancel'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
