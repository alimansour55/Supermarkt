import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import Button from '../../../components/ui/Button';
import { DELIVERY_FAILURE_PRESETS } from '../../../constants/deliveryFailureReasons';

export default function DriverFailModal({ open, isAr, onClose, onConfirm, loading }) {
  const [reasonKey, setReasonKey] = useState('');
  const [customReason, setCustomReason] = useState('');

  if (!open) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (reasonKey === 'custom') {
      onConfirm?.({ deliveryFailureReasonKey: 'custom', deliveryFailureReason: customReason.trim() });
      return;
    }
    onConfirm?.({ deliveryFailureReasonKey: reasonKey });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fail-delivery-title"
      >
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700">
            <AlertTriangle className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h2 id="fail-delivery-title" className="text-lg font-bold text-slate-900">
              {isAr ? 'تعذّر التسليم' : 'Could not deliver'}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {isAr ? 'اختر السبب — سيُبلَغ العميل والإدارة' : 'Choose a reason — customer and admin will be notified'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="max-h-52 space-y-2 overflow-y-auto">
            {DELIVERY_FAILURE_PRESETS.map((preset) => (
              <label
                key={preset.key}
                className={[
                  'flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition',
                  reasonKey === preset.key
                    ? 'border-red-300 bg-red-50'
                    : 'border-slate-200 hover:border-red-200',
                ].join(' ')}
              >
                <input
                  type="radio"
                  name="failReason"
                  value={preset.key}
                  checked={reasonKey === preset.key}
                  onChange={() => setReasonKey(preset.key)}
                  className="mt-0.5"
                />
                <span>{isAr ? preset.labelAr : preset.labelEn}</span>
              </label>
            ))}
            <label
              className={[
                'flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition',
                reasonKey === 'custom'
                  ? 'border-red-300 bg-red-50'
                  : 'border-slate-200 hover:border-red-200',
              ].join(' ')}
            >
              <input
                type="radio"
                name="failReason"
                value="custom"
                checked={reasonKey === 'custom'}
                onChange={() => setReasonKey('custom')}
                className="mt-0.5"
              />
              <span>{isAr ? 'سبب آخر' : 'Other reason'}</span>
            </label>
          </div>

          {reasonKey === 'custom' && (
            <textarea
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100"
              placeholder={isAr ? 'اكتب السبب...' : 'Describe the issue...'}
              required
              minLength={3}
            />
          )}

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={loading}>
              {isAr ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-red-600 hover:bg-red-700"
              disabled={loading || !reasonKey || (reasonKey === 'custom' && customReason.trim().length < 3)}
            >
              {loading ? (isAr ? 'جاري الإرسال...' : 'Sending...') : (isAr ? 'تأكيد' : 'Confirm')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
