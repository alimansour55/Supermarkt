import { useRef, useState } from 'react';
import { Camera, CheckCircle2, ImagePlus, X } from 'lucide-react';
import Button from '../../../components/ui/Button';
import { formatPrice } from '../../../utils/formatters';

export default function DriverCompleteModal({
  open, isAr, loading, isCod, total, onClose, onConfirm,
}) {
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const inputRef = useRef(null);

  if (!open) return null;

  const pickPhoto = (file) => {
    if (!file) return;
    setPhotoFile(file);
    const url = URL.createObjectURL(file);
    setPhotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
  };

  const clearPhoto = () => {
    setPhotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return '';
    });
    setPhotoFile(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleClose = () => {
    clearPhoto();
    onClose?.();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirm?.(photoFile);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="complete-delivery-title"
      >
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h2 id="complete-delivery-title" className="text-lg font-bold text-slate-900">
              {isAr ? 'تأكيد التسليم' : 'Confirm delivery'}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {isCod
                ? (isAr ? `تأكيد التسليم وتحصيل ${formatPrice(total)} نقداً` : `Confirm delivery and collect ${formatPrice(total)} cash`)
                : (isAr ? 'تأكيد أن الطلب وصل للعميل' : 'Confirm the order reached the customer')}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {isAr ? 'صورة إثبات التسليم (اختياري)' : 'Proof-of-delivery photo (optional)'}
            </p>
            {photoPreview ? (
              <div className="relative overflow-hidden rounded-xl border border-slate-200">
                <img src={photoPreview} alt="" className="h-40 w-full object-cover" />
                <button
                  type="button"
                  onClick={clearPhoto}
                  className="absolute end-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white"
                  aria-label={isAr ? 'إزالة الصورة' : 'Remove photo'}
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-slate-200 py-6 text-sm font-medium text-slate-500 hover:border-teal-300 hover:text-teal-700"
              >
                <Camera className="h-6 w-6" aria-hidden />
                {isAr ? 'التقط صورة عند الباب' : 'Take a photo at the door'}
              </button>
            )}
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => pickPhoto(e.target.files?.[0])}
            />
            {!photoPreview && (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:underline"
              >
                <ImagePlus className="h-3.5 w-3.5" aria-hidden />
                {isAr ? 'أو اختر من المعرض' : 'or choose from gallery'}
              </button>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={handleClose} disabled={loading}>
              {isAr ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              disabled={loading}
            >
              {loading ? (isAr ? 'جاري الإرسال...' : 'Sending...') : (isAr ? 'تأكيد التسليم' : 'Confirm delivered')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
