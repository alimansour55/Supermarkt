import { useState } from 'react';
import { Palmtree } from 'lucide-react';
import { useToast } from '../../components/ui/Toast';
import { sellerApi } from '../../services/sellerApi';
import { apiError } from '../sellerLabels';
import { fmtDate } from '../sellerUtils';

const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100';
const dayKey = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

/** Hide every listing while away (holidays, Ramadan break); optional automatic return date. */
export default function VacationSettings({ seller, isAr, reload }) {
  const toast = useToast();
  const v = seller.vacation || {};
  const [until, setUntil] = useState(dayKey(v.until));
  const [messageAr, setMessageAr] = useState(v.messageAr || '');
  const [messageEn, setMessageEn] = useState(v.messageEn || '');
  const [busy, setBusy] = useState(false);

  const save = async (enabled) => {
    if (enabled && !v.enabled && !window.confirm(isAr ? 'ستختفي كل منتجاتك من المتجر حتى تعود. المتابعة؟' : 'All your products will be hidden until you return. Continue?')) return;
    setBusy(true);
    try {
      await sellerApi.setVacation({ enabled, until: enabled && until ? `${until}T09:00:00+02:00` : null, messageAr, messageEn });
      toast.success(enabled ? (isAr ? 'تم تفعيل وضع الإجازة' : 'Vacation mode is on') : (isAr ? 'مرحباً بعودتك — منتجاتك معروضة' : 'Welcome back — your products are visible'));
      reload();
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر الحفظ' : 'Could not save'));
    } finally {
      setBusy(false);
    }
  };

  const tomorrow = dayKey(new Date(Date.now() + 86400000));

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="flex items-center gap-2 font-bold"><Palmtree className="h-5 w-5 text-emerald-600" />{isAr ? 'وضع الإجازة' : 'Vacation mode'}</h2>
      <p className="mt-1 text-sm text-slate-500">
        {isAr
          ? 'يُخفي كل منتجاتك من المتجر مؤقتاً دون إيقاف كل منتج على حدة. الطلبات الحالية تبقى كما هي — أكمل شحنها.'
          : 'Temporarily hides all your products without pausing each one. Orders you already have stay — keep shipping them.'}
      </p>

      {v.enabled && (
        <div className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900 ring-1 ring-emerald-200">
          {isAr ? 'متجرك في إجازة الآن' : 'Your store is on vacation'}
          {v.until ? (isAr ? ` حتى ${fmtDate(v.until, true)} (يعود تلقائياً).` : ` until ${fmtDate(v.until, false)} (returns automatically).`) : '.'}
        </div>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{isAr ? 'العودة تلقائياً في' : 'Return automatically on'}</span>
          <input type="date" min={tomorrow} value={until} onChange={(e) => setUntil(e.target.value)} className={inputCls} />
          <span className="mt-1 block text-xs text-slate-500">{isAr ? 'اختياري — حتى 120 يوماً' : 'Optional — up to 120 days'}</span>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{isAr ? 'رسالة للعملاء (عربي)' : 'Message to customers (Arabic)'}</span>
          <input value={messageAr} onChange={(e) => setMessageAr(e.target.value)} maxLength={300} className={inputCls} placeholder="نعود بعد العيد 🌙" dir="rtl" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{isAr ? 'رسالة للعملاء (إنجليزي)' : 'Message to customers (English)'}</span>
          <input value={messageEn} onChange={(e) => setMessageEn(e.target.value)} maxLength={300} className={inputCls} placeholder="Back after Eid 🌙" dir="ltr" />
        </label>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {v.enabled ? (
          <>
            <button type="button" disabled={busy} onClick={() => save(false)} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{isAr ? 'إنهاء الإجازة الآن' : 'End vacation now'}</button>
            <button type="button" disabled={busy} onClick={() => save(true)} className="rounded-xl px-4 py-2.5 text-sm font-semibold ring-1 ring-slate-300 disabled:opacity-50">{isAr ? 'تحديث التاريخ والرسالة' : 'Update date & message'}</button>
          </>
        ) : (
          <button type="button" disabled={busy} onClick={() => save(true)} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{isAr ? 'بدء الإجازة' : 'Start vacation'}</button>
        )}
      </div>
    </section>
  );
}
