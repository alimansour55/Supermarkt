import { useCallback, useEffect, useState } from 'react';
import { Download, Landmark, Plus, Send, X } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { adminApi } from '../adminApi';
import Button from '../../components/ui/Button';
import Loader from '../../components/ui/Loader';
import AdminSlidePanel from '../components/AdminSlidePanel';
import { PageHeader, useToast } from '../components';
import { hasPermission } from '../adminPermissions';
import { downloadBlob } from '../utils/downloadBlob';
import { formatPrice } from '../../utils/formatters';
import { LEDGER_TYPE, PAYOUT_STATUS, apiError, label } from '../../seller/sellerLabels';
import StatusBadge from '../../seller/StatusBadge';

const inputCls = 'w-full rounded-xl border border-border bg-white px-3 py-2 text-sm';
const METHODS = {
  bank_transfer: { ar: 'تحويل بنكي', en: 'Bank transfer' },
  instapay: { ar: 'إنستاباي', en: 'InstaPay' },
  wallet: { ar: 'محفظة إلكترونية', en: 'Mobile wallet' },
  cash: { ar: 'نقداً', en: 'Cash' },
  other: { ar: 'أخرى', en: 'Other' },
};

function fmtDate(value, isAr) {
  return value ? new Date(value).toLocaleDateString(isAr ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
}

function SellerLedgerPanel({ sellerId, isAr, canWrite, onChanged }) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    adminApi.getSellerLedger(sellerId, { limit: 100 }).then(({ data: d }) => setData(d)).catch(() => toast.error(isAr ? 'تعذّر التحميل' : 'Could not load'));
  }, [sellerId, isAr, toast]);
  useEffect(() => { load(); }, [load]);

  const addAdjustment = async () => {
    setBusy(true);
    try {
      await adminApi.addSellerAdjustment(sellerId, { amount: Number(amount), note });
      setAmount('');
      setNote('');
      toast.success(isAr ? 'تمت التسوية' : 'Adjustment added');
      load();
      onChanged();
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّرت التسوية' : 'Adjustment failed'));
    } finally {
      setBusy(false);
    }
  };

  if (!data) return <div className="flex min-h-[200px] items-center justify-center"><Loader size="lg" /></div>;
  const b = data.balance;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 text-sm">
        {[
          [isAr ? 'متاح' : 'Available', b.available],
          [isAr ? 'قيد الانتظار' : 'On hold', b.pending],
          [isAr ? 'في تحويلات معلّقة' : 'In pending payouts', b.inPayout],
          [isAr ? 'حُوّل إجمالاً' : 'Paid out', b.paidOut],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl border border-border bg-white p-3">
            <p className="text-text-muted">{k}</p>
            <p className={`text-lg font-bold tabular-nums ${v < 0 ? 'text-red-700' : ''}`}>{formatPrice(v)}</p>
          </div>
        ))}
      </div>

      {canWrite && (
        <section className="rounded-2xl border border-border bg-white p-4">
          <h3 className="mb-1 font-bold">{isAr ? 'تسوية يدوية' : 'Manual adjustment'}</h3>
          <p className="mb-3 text-xs text-text-muted">{isAr ? 'موجب = مستحق للبائع، سالب = مستحق على البائع. مثال: البائع سدّد عمولة نقداً.' : 'Positive = owed to the seller, negative = owed by the seller. E.g. the seller paid commission in cash.'}</p>
          <div className="flex flex-wrap gap-2">
            <input type="number" step="0.01" className={`${inputCls} w-32`} placeholder={isAr ? 'المبلغ' : 'Amount'} value={amount} onChange={(e) => setAmount(e.target.value)} dir="ltr" />
            <input className={`${inputCls} flex-1`} placeholder={isAr ? 'السبب (مطلوب)' : 'Reason (required)'} value={note} onChange={(e) => setNote(e.target.value)} />
            <Button size="sm" disabled={busy || !Number(amount) || !note.trim()} onClick={addAdjustment}><Plus className="h-4 w-4" />{isAr ? 'إضافة' : 'Add'}</Button>
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-border bg-white">
        <h3 className="border-b border-border px-4 py-2 font-bold">{isAr ? 'كشف الحساب' : 'Statement'}</h3>
        <ul className="divide-y divide-border text-sm">
          {data.data.map((e) => (
            <li key={e._id} className="flex items-center gap-3 px-4 py-2">
              <span className="w-24 shrink-0 text-xs text-text-muted">{fmtDate(e.createdAt, isAr)}</span>
              <span className="min-w-0 flex-1">
                {label(LEDGER_TYPE, e.type, isAr)}
                <span className="block truncate text-xs text-text-muted" dir="auto">{[e.reference, e.note].filter(Boolean).join(' · ')}</span>
              </span>
              <span className={`font-semibold tabular-nums ${e.amount < 0 ? 'text-red-700' : 'text-emerald-700'}`} dir="ltr">{formatPrice(e.amount)}</span>
            </li>
          ))}
          {!data.data.length && <li className="p-4 text-text-muted">{isAr ? 'لا توجد حركات.' : 'No entries.'}</li>}
        </ul>
      </section>
    </div>
  );
}

export default function SellerPayoutsPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { user } = useAuth();
  const toast = useToast();
  const canWrite = hasPermission(user, 'sellers:write');

  const [balances, setBalances] = useState(null);
  const [minPayout, setMinPayout] = useState(0);
  const [payouts, setPayouts] = useState([]);
  const [payoutStatus, setPayoutStatus] = useState('pending');
  const [busyId, setBusyId] = useState('');
  const [ledgerSeller, setLedgerSeller] = useState(null);
  const [paying, setPaying] = useState(null);
  const [payForm, setPayForm] = useState({ method: 'bank_transfer', referenceNumber: '', note: '' });

  const load = useCallback(() => {
    adminApi.getSellerBalances().then(({ data }) => { setBalances(data.data || []); setMinPayout(data.minPayoutAmount || 0); })
      .catch(() => toast.error(isAr ? 'تعذّر تحميل الأرصدة' : 'Could not load balances'));
    adminApi.listSellerPayouts({ status: payoutStatus || undefined, limit: 50 }).then(({ data }) => setPayouts(data.data || [])).catch(() => {});
  }, [payoutStatus, isAr, toast]);
  useEffect(() => { load(); }, [load]);

  const generate = async (sellerId) => {
    setBusyId(sellerId);
    try {
      const { data } = await adminApi.generateSellerPayout(sellerId);
      toast.success(isAr ? `أُنشئ التحويل ${data.data.payoutNumber}` : `Payout ${data.data.payoutNumber} created`);
      setPayoutStatus('pending');
      load();
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر إنشاء التحويل' : 'Could not create payout'));
    } finally {
      setBusyId('');
    }
  };

  const confirmPaid = async () => {
    setBusyId(paying._id);
    try {
      await adminApi.markSellerPayoutPaid(paying._id, payForm);
      toast.success(isAr ? 'تم تسجيل التحويل' : 'Payout marked paid');
      setPaying(null);
      load();
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر التسجيل' : 'Could not mark paid'));
    } finally {
      setBusyId('');
    }
  };

  const cancel = async (payout) => {
    if (!window.confirm(isAr ? `إلغاء ${payout.payoutNumber}؟ ستعود المبالغ لرصيد البائع.` : `Cancel ${payout.payoutNumber}? The amounts go back to the seller balance.`)) return;
    setBusyId(payout._id);
    try {
      await adminApi.cancelSellerPayout(payout._id);
      load();
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر الإلغاء' : 'Could not cancel'));
    } finally {
      setBusyId('');
    }
  };

  const exportBatch = async () => {
    try {
      const res = await adminApi.exportSellerPayouts();
      downloadBlob(res.data, 'seller-payouts.csv');
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر التصدير' : 'Export failed'));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        description={isAr ? 'رصيد كل بائع بعد العمولة، وتحويل فلوسه بعد انتهاء فترة الانتظار.' : 'What each seller is owed after commission, and paying them once the waiting period ends.'}
        action={canWrite && <Button variant="outline" onClick={exportBatch}><Download className="h-4 w-4" />{isAr ? 'ملف التحويلات البنكية' : 'Bank batch CSV'}</Button>}
      />

      <section className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
        <h2 className="border-b border-border px-5 py-3 font-bold">{isAr ? 'الأرصدة' : 'Balances'}</h2>
        {!balances ? (
          <div className="flex min-h-[160px] items-center justify-center"><Loader size="lg" /></div>
        ) : !balances.length ? (
          <p className="p-6 text-sm text-text-muted">{isAr ? 'لا توجد أرصدة بعد — تظهر عند تسليم أول طلب لبائع.' : 'No balances yet — they appear when a seller’s first order is delivered.'}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-slate-50 text-xs text-text-muted">
                <tr>
                  <th className="px-5 py-2 text-start">{isAr ? 'البائع' : 'Seller'}</th>
                  <th className="px-5 py-2 text-end">{isAr ? 'متاح' : 'Available'}</th>
                  <th className="px-5 py-2 text-end">{isAr ? 'قيد الانتظار' : 'On hold'}</th>
                  <th className="px-5 py-2 text-end">{isAr ? 'حُوّل' : 'Paid out'}</th>
                  <th className="px-5 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {balances.map((r) => (
                  <tr key={r.seller._id}>
                    <td className="px-5 py-2.5">
                      <button type="button" onClick={() => setLedgerSeller(r.seller)} className="font-semibold text-primary-700 hover:underline">{isAr ? r.seller.nameAr : r.seller.nameEn}</button>
                      {!r.seller.hasBank && <span className="ms-2 rounded-full bg-amber-100 px-2 text-xs text-amber-900">{isAr ? 'بلا بيانات دفع' : 'no payout details'}</span>}
                    </td>
                    <td className={`px-5 py-2.5 text-end font-semibold tabular-nums ${r.available < 0 ? 'text-red-700' : ''}`}>{formatPrice(r.available)}</td>
                    <td className="px-5 py-2.5 text-end tabular-nums text-text-muted">{formatPrice(r.pending)}</td>
                    <td className="px-5 py-2.5 text-end tabular-nums text-text-muted">{formatPrice(r.paidOut)}</td>
                    <td className="px-5 py-2.5 text-end">
                      {canWrite && r.available >= Math.max(minPayout, 0.01) && (
                        <Button size="sm" disabled={busyId === r.seller._id} onClick={() => generate(r.seller._id)}>
                          <Send className="h-4 w-4" />{isAr ? 'إنشاء تحويل' : 'Create payout'}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
          <h2 className="font-bold">{isAr ? 'التحويلات' : 'Payouts'}</h2>
          <div className="flex gap-1.5">
            {['pending', 'paid', 'cancelled', ''].map((s) => (
              <button key={s || 'all'} type="button" onClick={() => setPayoutStatus(s)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${payoutStatus === s ? 'bg-primary-600 text-white' : 'bg-white ring-1 ring-border'}`}>
                {s ? label(PAYOUT_STATUS, s, isAr) : (isAr ? 'الكل' : 'All')}
              </button>
            ))}
          </div>
        </div>
        {!payouts.length ? (
          <p className="p-6 text-sm text-text-muted">{isAr ? 'لا توجد تحويلات.' : 'No payouts.'}</p>
        ) : (
          <ul className="divide-y divide-border">
            {payouts.map((p) => (
              <li key={p._id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                <span className="font-semibold" dir="ltr">{p.payoutNumber}</span>
                <span>{isAr ? p.seller.nameAr : p.seller.nameEn}</span>
                <span className="flex items-center gap-1 text-xs text-text-muted"><Landmark className="h-3.5 w-3.5" />{[p.bank?.bankName, p.bank?.accountNumber || p.bank?.iban || p.bank?.walletPhone].filter(Boolean).join(' · ') || '—'}</span>
                <span className="text-xs text-text-muted">{fmtDate(p.paidAt || p.createdAt, isAr)}{p.referenceNumber ? ` · ${p.referenceNumber}` : ''}</span>
                <span className="ms-auto font-bold tabular-nums">{formatPrice(p.amount)}</span>
                <StatusBadge map={PAYOUT_STATUS} value={p.status} isAr={isAr} />
                {canWrite && p.status === 'pending' && (
                  <>
                    <Button size="sm" disabled={busyId === p._id} onClick={() => { setPaying(p); setPayForm({ method: 'bank_transfer', referenceNumber: '', note: '' }); }}>{isAr ? 'تم التحويل' : 'Mark paid'}</Button>
                    <button type="button" disabled={busyId === p._id} onClick={() => cancel(p)} className="rounded-lg p-1.5 text-red-600 ring-1 ring-border hover:bg-red-50" aria-label={isAr ? 'إلغاء' : 'Cancel'}><X className="h-4 w-4" /></button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <AdminSlidePanel open={Boolean(paying)} onClose={() => setPaying(null)} title={isAr ? 'تسجيل التحويل' : 'Record payout'} subtitle={paying ? `${paying.payoutNumber} · ${formatPrice(paying.amount)}` : ''} isAr={isAr}>
        {paying && (
          <div className="space-y-3">
            <label className="block text-sm"><span className="mb-1 block font-medium">{isAr ? 'طريقة التحويل' : 'Method'}</span>
              <select className={inputCls} value={payForm.method} onChange={(e) => setPayForm((f) => ({ ...f, method: e.target.value }))}>
                {Object.keys(METHODS).map((m) => <option key={m} value={m}>{label(METHODS, m, isAr)}</option>)}
              </select>
            </label>
            <label className="block text-sm"><span className="mb-1 block font-medium">{isAr ? 'رقم المرجع البنكي' : 'Bank reference'}</span>
              <input className={inputCls} value={payForm.referenceNumber} onChange={(e) => setPayForm((f) => ({ ...f, referenceNumber: e.target.value }))} dir="ltr" />
            </label>
            <label className="block text-sm"><span className="mb-1 block font-medium">{isAr ? 'ملاحظة' : 'Note'}</span>
              <input className={inputCls} value={payForm.note} onChange={(e) => setPayForm((f) => ({ ...f, note: e.target.value }))} />
            </label>
            <Button disabled={busyId === paying._id} onClick={confirmPaid}>{isAr ? 'تأكيد التحويل' : 'Confirm paid'}</Button>
          </div>
        )}
      </AdminSlidePanel>

      <AdminSlidePanel open={Boolean(ledgerSeller)} onClose={() => setLedgerSeller(null)} title={ledgerSeller ? (isAr ? ledgerSeller.nameAr : ledgerSeller.nameEn) : ''} subtitle={isAr ? 'كشف حساب البائع' : 'Seller statement'} width="max-w-2xl" isAr={isAr}>
        {ledgerSeller && <SellerLedgerPanel key={ledgerSeller._id} sellerId={ledgerSeller._id} isAr={isAr} canWrite={canWrite} onChanged={load} />}
      </AdminSlidePanel>
    </div>
  );
}
