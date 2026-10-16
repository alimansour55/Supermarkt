import { useState } from 'react';
import Button from '../../../components/ui/Button';
import { useToast } from '../index';
import { adminApi } from '../../adminApi';
import { apiError } from '../../../seller/sellerLabels';
import { cairoDate, cairoDayStart } from '../../utils/sellerFeesAdmin';
import { KEEP, bulkDealChanges } from '../../utils/sellerDeal';

const inputCls = 'w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100';

/**
 * One deal change for many sellers: plan, negotiated %, welcome offer, payout schedule —
 * now or from a date. Fields left on "no change" are not touched.
 */
export default function BulkDealForm({ sellers, plans = [], isAr, onDone, onCancel }) {
  const toast = useToast();
  const [form, setForm] = useState({ feePlan: KEEP, rateMode: 'keep', rate: '', freeMode: 'keep', freeUntil: '', payoutFrequency: KEEP, when: 'now', date: '', note: '' });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [minDate] = useState(() => cairoDate(new Date(Date.now() + 86400000)));
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const changes = bulkDealChanges(form);
  const rateBad = form.rateMode === 'set' && !(form.rate !== '' && Number(form.rate) >= 0 && Number(form.rate) <= 100);
  const valid = Object.keys(changes).length > 0 && !rateBad && (form.when === 'now' || form.date) && (form.freeMode !== 'set' || form.freeUntil);

  const submit = async () => {
    setBusy(true);
    try {
      const { data } = await adminApi.bulkSellerDeal({
        sellerIds: sellers.map((s) => s._id),
        changes,
        note: form.note,
        ...(form.when === 'date' ? { applyAt: cairoDayStart(form.date) } : {}),
      });
      setResult(data.data);
      toast.success(isAr ? 'تم' : 'Done');
      onDone?.();
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر التنفيذ' : 'Could not apply'));
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <div className="space-y-3 text-sm">
        <p className="rounded-xl bg-emerald-50 p-3 text-emerald-900">
          {result.updated > 0 && (isAr ? `تم تحديث ${result.updated} بائع. ` : `${result.updated} seller(s) updated. `)}
          {result.scheduled > 0 && (isAr ? `تمت جدولة التغيير لـ ${result.scheduled} بائع.` : `Scheduled for ${result.scheduled} seller(s).`)}
        </p>
        {result.failed.length > 0 && (
          <ul className="rounded-xl bg-red-50 p-3 text-red-800">
            {result.failed.map((f, i) => <li key={i}>{f.name ? `${f.name}: ` : ''}{f.message}</li>)}
          </ul>
        )}
        <Button size="sm" variant="outline" onClick={onCancel}>{isAr ? 'إغلاق' : 'Close'}</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-sm">
      <p className="rounded-xl bg-slate-50 p-3">
        {isAr ? `سيتغيّر الاتفاق لـ ${sellers.length} بائع: ` : `Changes the deal for ${sellers.length} seller(s): `}
        <span className="text-text-muted">{sellers.slice(0, 5).map((s) => (isAr ? s.nameAr : s.nameEn)).join('، ')}{sellers.length > 5 ? '…' : ''}</span>
      </p>

      <label className="block">
        <span className="mb-1 block font-medium">{isAr ? 'الباقة' : 'Plan'}</span>
        <select className={inputCls} value={form.feePlan} onChange={(e) => set('feePlan', e.target.value)}>
          <option value={KEEP}>{isAr ? 'بدون تغيير' : 'No change'}</option>
          <option value="">{isAr ? 'الافتراضية / بدون باقة' : 'Default / no plan'}</option>
          {plans.map((p) => <option key={p.key} value={p.key}>{isAr ? p.nameAr || p.nameEn : p.nameEn || p.nameAr}</option>)}
        </select>
      </label>

      <fieldset>
        <legend className="mb-1 font-medium">{isAr ? 'نسبة العمولة الخاصة' : 'Negotiated commission'}</legend>
        <div className="flex flex-wrap items-center gap-3">
          {[['keep', 'بدون تغيير', 'No change'], ['set', 'تعيين نسبة', 'Set to'], ['clear', 'إلغاؤها (الرجوع للنسب العامة)', 'Remove (use standard rates)']].map(([v, ar, en]) => (
            <label key={v} className="flex items-center gap-1.5"><input type="radio" checked={form.rateMode === v} onChange={() => set('rateMode', v)} />{isAr ? ar : en}</label>
          ))}
          {form.rateMode === 'set' && (
            <span className="relative">
              <input type="number" min="0" max="100" step="0.5" dir="ltr" className={`${inputCls} w-28 pr-7`} value={form.rate} onChange={(e) => set('rate', e.target.value)} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted">%</span>
            </span>
          )}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-1 font-medium">{isAr ? 'عرض بدون عمولة' : 'Commission-free offer'}</legend>
        <div className="flex flex-wrap items-center gap-3">
          {[['keep', 'بدون تغيير', 'No change'], ['set', 'حتى تاريخ', 'Until'], ['clear', 'إنهاء العرض', 'End the offer']].map(([v, ar, en]) => (
            <label key={v} className="flex items-center gap-1.5"><input type="radio" checked={form.freeMode === v} onChange={() => set('freeMode', v)} />{isAr ? ar : en}</label>
          ))}
          {form.freeMode === 'set' && <input type="date" className={`${inputCls} w-44`} value={form.freeUntil} onChange={(e) => set('freeUntil', e.target.value)} />}
        </div>
      </fieldset>

      <label className="block">
        <span className="mb-1 block font-medium">{isAr ? 'التحويل التلقائي للمستحقات' : 'Automatic payouts'}</span>
        <select className={inputCls} value={form.payoutFrequency} onChange={(e) => set('payoutFrequency', e.target.value)}>
          <option value={KEEP}>{isAr ? 'بدون تغيير' : 'No change'}</option>
          <option value="">{isAr ? 'حسب الإعداد العام' : 'Marketplace schedule'}</option>
          <option value="manual">{isAr ? 'يدوياً فقط' : 'Manual only'}</option>
          <option value="weekly">{isAr ? 'أسبوعياً' : 'Weekly'}</option>
          <option value="biweekly">{isAr ? 'كل أسبوعين' : 'Every two weeks'}</option>
          <option value="monthly">{isAr ? 'شهرياً' : 'Monthly'}</option>
        </select>
      </label>

      <div className="rounded-xl border border-border p-3">
        <p className="mb-2 font-medium">{isAr ? 'متى يبدأ؟' : 'When does it start?'}</p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5"><input type="radio" checked={form.when === 'now'} onChange={() => set('when', 'now')} />{isAr ? 'الآن' : 'Now'}</label>
          <label className="flex items-center gap-1.5"><input type="radio" checked={form.when === 'date'} onChange={() => set('when', 'date')} />{isAr ? 'من تاريخ' : 'From'}</label>
          {form.when === 'date' && <input type="date" min={minDate} className={`${inputCls} w-44`} value={form.date} onChange={(e) => set('date', e.target.value)} />}
        </div>
        <input className={`${inputCls} mt-3`} placeholder={isAr ? 'سبب / ملاحظة (تظهر في السجل)' : 'Reason / note (shown in history)'} value={form.note} onChange={(e) => set('note', e.target.value)} />
        <p className="mt-2 text-xs text-text-muted">{isAr ? 'تطبق على الطلبات الجديدة فقط، ويصل كل بائع تنبيه.' : 'Applies to new orders only; each seller is notified.'}</p>
      </div>

      <div className="flex gap-2">
        <Button size="sm" disabled={!valid || busy} onClick={submit}>
          {busy ? (isAr ? 'جارٍ التنفيذ…' : 'Applying…') : form.when === 'date' ? (isAr ? 'جدولة' : 'Schedule') : (isAr ? 'تطبيق الآن' : 'Apply now')}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>{isAr ? 'إلغاء' : 'Cancel'}</Button>
      </div>
    </div>
  );
}
