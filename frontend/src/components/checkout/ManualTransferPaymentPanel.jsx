import { useState } from 'react';
import { Check, Copy, ExternalLink, ImagePlus, X } from 'lucide-react';
import { formatPrice } from '../../utils/formatters';

function AccountCard({
  entry,
  isAr,
  selected,
  onSelect,
}) {
  const [copied, setCopied] = useState(false);
  const label = (isAr ? entry.labelAr : entry.labelEn) || entry.number;

  const copyNumber = async () => {
    try {
      await navigator.clipboard.writeText(entry.number);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore clipboard failures
    }
  };

  return (
    <button
      type="button"
      onClick={() => onSelect(entry.number)}
      className={[
        'flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-start transition',
        selected
          ? 'border-primary-500 bg-primary-50/80 ring-2 ring-primary-500/20'
          : 'border-slate-200 bg-white hover:border-slate-300',
      ].join(' ')}
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900">{label}</p>
        <p className="mt-0.5 font-mono text-base tracking-wide text-slate-700">{entry.number}</p>
      </div>
      <span
        role="presentation"
        onClick={(event) => {
          event.stopPropagation();
          copyNumber();
        }}
        className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-white"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? (isAr ? 'تم النسخ' : 'Copied') : (isAr ? 'نسخ' : 'Copy')}
      </span>
    </button>
  );
}

export default function ManualTransferPaymentPanel({
  method,
  isAr,
  total,
  selectedAccount,
  onAccountChange,
  proofFile,
  onProofChange,
  error,
}) {
  const accounts = method?.accountNumbers || [];
  const previewUrl = proofFile ? URL.createObjectURL(proofFile) : '';

  return (
    <div className="mt-4 space-y-4 rounded-2xl border border-primary-200 bg-primary-50/30 p-4 sm:p-5">
      <div>
        <p className="text-sm font-bold text-slate-900">
          {isAr ? 'خطوات الدفع' : 'How to pay'}
        </p>
        <ol className="mt-2 list-decimal space-y-1 ps-5 text-sm text-slate-600">
          <li>{isAr ? 'حوّل المبلغ إلى أحد الأرقام أدناه' : 'Transfer the order total to one of the numbers below'}</li>
          <li>{isAr ? 'التقط لقطة شاشة أو صورة للإيصال' : 'Take a screenshot or photo of the receipt'}</li>
          <li>{isAr ? 'ارفع الصورة وأكمل الطلب' : 'Upload the image and place your order'}</li>
        </ol>
        {total != null && (
          <p className="mt-3 inline-flex rounded-full bg-white px-3 py-1 text-sm font-semibold text-primary-800 ring-1 ring-primary-200">
            {isAr ? 'المبلغ المطلوب:' : 'Amount to transfer:'} {formatPrice(total)}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {isAr ? 'اختر رقم التحويل' : 'Select transfer number'}
        </p>
        {accounts.map((entry) => (
          <AccountCard
            key={entry.number}
            entry={entry}
            isAr={isAr}
            selected={selectedAccount === entry.number}
            onSelect={onAccountChange}
          />
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {isAr ? 'صورة تأكيد التحويل' : 'Transfer confirmation photo'}
        </p>

        {!proofFile ? (
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white px-4 py-8 text-center transition hover:border-primary-400 hover:bg-primary-50/40">
            <ImagePlus className="mb-2 h-8 w-8 text-slate-400" aria-hidden />
            <span className="text-sm font-semibold text-slate-800">
              {isAr ? 'اضغط لرفع صورة الإيصال' : 'Tap to upload receipt image'}
            </span>
            <span className="mt-1 text-xs text-slate-500">JPG, PNG, WEBP · max 5MB</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              onChange={(event) => onProofChange(event.target.files?.[0] || null)}
            />
          </label>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="relative">
              <img src={previewUrl} alt="" className="max-h-64 w-full object-contain bg-slate-50" />
              <button
                type="button"
                onClick={() => onProofChange(null)}
                className="absolute top-2 end-2 rounded-full bg-black/60 p-1.5 text-white transition hover:bg-black/80"
                aria-label={isAr ? 'إزالة الصورة' : 'Remove image'}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-3 py-2 text-xs text-slate-600">
              <span className="truncate">{proofFile.name}</span>
              <a
                href={previewUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-primary-700 hover:text-primary-800"
              >
                {isAr ? 'معاينة' : 'Preview'}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
    </div>
  );
}
