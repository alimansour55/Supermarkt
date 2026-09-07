import { useState } from 'react';
import { CheckCircle2, ExternalLink, ImageIcon } from 'lucide-react';
import Button from '../../components/ui/Button';
import { getPaymentMethodLabel } from '../../constants/paymentMethods';

export default function OrderPaymentProofPanel({ order, isAr, onMarkPaid, updating }) {
  const [expanded, setExpanded] = useState(true);
  const hasProof = Boolean(order.paymentProofUrl);
  const isManual = ['instapay', 'vodafone_cash'].includes(order.paymentMethod);
  const needsReview = isManual && order.paymentStatus === 'pending';

  if (!isManual) return null;

  return (
    <section className="overflow-hidden rounded-2xl border border-orange-200 bg-orange-50/40">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-start"
      >
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-100 text-orange-700">
            <ImageIcon className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-bold text-text">
              {isAr ? 'إيصال التحويل' : 'Transfer receipt'}
            </p>
            <p className="text-xs text-text-muted">
              {getPaymentMethodLabel(order.paymentMethod, null, isAr)}
              {order.manualPaymentAccount ? ` · ${order.manualPaymentAccount}` : ''}
            </p>
          </div>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${hasProof ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
          {hasProof ? (isAr ? 'مرفوع' : 'Uploaded') : (isAr ? 'غير مرفوع' : 'Missing')}
        </span>
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-orange-200/80 bg-white/80 px-4 py-4">
          {order.manualPaymentAccount && (
            <div className="rounded-xl border border-border bg-slate-50 px-3 py-2 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                {isAr ? 'رقم التحويل' : 'Paid to account'}
              </p>
              <p className="mt-1 font-mono text-base font-semibold text-text">{order.manualPaymentAccount}</p>
            </div>
          )}

          {hasProof ? (
            <div className="overflow-hidden rounded-xl border border-border bg-white">
              <a href={order.paymentProofUrl} target="_blank" rel="noreferrer" className="block">
                <img
                  src={order.paymentProofUrl}
                  alt=""
                  className="max-h-80 w-full bg-slate-50 object-contain"
                />
              </a>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2 text-xs text-text-muted">
                <span>
                  {order.paymentProofUploadedAt
                    ? new Date(order.paymentProofUploadedAt).toLocaleString(isAr ? 'ar-EG' : 'en-GB')
                    : ''}
                </span>
                <a
                  href={order.paymentProofUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-primary-700 hover:text-primary-800"
                >
                  {isAr ? 'فتح بالحجم الكامل' : 'Open full size'}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-900">
              {isAr ? 'لم يرفع العميل صورة التأكيد بعد.' : 'Customer has not uploaded a confirmation photo yet.'}
            </p>
          )}

          {needsReview && hasProof && onMarkPaid && (
            <Button
              size="sm"
              disabled={updating}
              onClick={() => onMarkPaid()}
              className="w-full sm:w-auto"
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              {isAr ? 'تأكيد استلام الدفع' : 'Confirm payment received'}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
