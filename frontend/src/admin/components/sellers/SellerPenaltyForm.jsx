import { useState } from 'react';
import { Gavel } from 'lucide-react';
import Button from '../../../components/ui/Button';
import { useConfirm, useToast } from '../index';
import { adminApi } from '../../adminApi';
import { apiError } from '../../../seller/sellerLabels';

const inputCls = 'w-full rounded-xl border border-border bg-white px-3 py-2 text-sm';

const PENALTY_REASONS = {
  late_shipment: { ar: 'تأخر في الشحن', en: 'Late shipment' },
  cancellation: { ar: 'إلغاء من البائع', en: 'Seller cancellation' },
  wrong_item: { ar: 'منتج خاطئ أو تالف', en: 'Wrong or damaged item' },
  policy: { ar: 'مخالفة السياسة', en: 'Policy breach' },
  other: { ar: 'أخرى', en: 'Other' },
};

/** Charge a seller a fee (deducted from its balance, counted as marketplace income). */
export default function SellerPenaltyForm({ sellerId, isAr, onCharged }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [form, setForm] = useState({ amount: '', reason: 'late_shipment', note: '' });
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const ok = await confirm({
      title: isAr ? `خصم ${form.amount} ج.م من البائع؟` : `Charge the seller ${form.amount} EGP?`,
      message: isAr ? 'يُخصم من رصيده ويظهر له في كشف الحساب مع السبب.' : 'It is deducted from their balance and shows on their statement with the reason.',
      confirmLabel: isAr ? 'خصم' : 'Charge',
      cancelLabel: isAr ? 'إلغاء' : 'Cancel',
      variant: 'danger',
    });
    if (!ok) return;
    setBusy(true);
    try {
      const { data } = await adminApi.chargeSellerPenalty(sellerId, { amount: Number(form.amount), reason: form.reason, note: form.note });
      toast.success(isAr ? 'تم الخصم' : 'Fee charged');
      setForm({ amount: '', reason: form.reason, note: '' });
      onCharged?.(data.balance);
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر الخصم' : 'Could not charge'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-white p-4">
      <h3 className="mb-1 flex items-center gap-2 font-bold"><Gavel className="h-4 w-4 text-text-muted" />{isAr ? 'خصم غرامة' : 'Charge a penalty'}</h3>
      <p className="mb-3 text-xs text-text-muted">{isAr ? 'لتأخر الشحن أو الإلغاء أو مخالفة الشروط. للتصحيحات في أي اتجاه استخدم التسوية في صفحة المستحقات.' : 'For late shipping, cancellations or policy breaches. For corrections either way, use an adjustment on the payouts page.'}</p>
      <div className="grid grid-cols-2 gap-2">
        <select className={inputCls} value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}>
          {Object.entries(PENALTY_REASONS).map(([k, v]) => <option key={k} value={k}>{isAr ? v.ar : v.en}</option>)}
        </select>
        <input type="number" min="1" step="1" className={inputCls} placeholder={isAr ? 'المبلغ (ج.م)' : 'Amount (EGP)'} value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} dir="ltr" />
        <input className={`${inputCls} col-span-2`} placeholder={isAr ? 'التفاصيل (يراها البائع) — مثال: طلب 1234 شُحن بعد 3 أيام' : 'Details (the seller sees this) — e.g. order 1234 shipped 3 days late'} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
      </div>
      <Button size="sm" variant="outline" className="mt-3" disabled={busy || !(Number(form.amount) > 0)} onClick={submit}>{isAr ? 'خصم من الرصيد' : 'Deduct from balance'}</Button>
    </section>
  );
}
