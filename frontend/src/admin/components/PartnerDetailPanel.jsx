import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  X, Building2, Landmark, FileText, BookOpen, Wallet, Printer, Loader2, Plus, Trash2,
} from 'lucide-react';
import { adminApi } from '../adminApi';
import { formatPrice } from '../../utils/formatters';
import { Skeleton } from './Skeleton';
import { LEDGER_TYPES, PARTNER_STATUS_OPTIONS } from '../constants/partnerRuleMeta';
import { partnerColor } from './PartnerPercentageBar';

function partnerKeyOf(p) {
  if (p.userId) return String(p.userId);
  if (p._id) return String(p._id);
  return null;
}

const TABS = [
  { id: 'profile', ar: 'الملف', en: 'Profile', Icon: Building2 },
  { id: 'statement', ar: 'كشف الحساب', en: 'Statement', Icon: FileText },
  { id: 'ledger', ar: 'التسويات', en: 'Ledger', Icon: BookOpen },
];

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-text-muted">{label}</span>
      {children}
    </label>
  );
}

function ProfileTab({ partner, isAr, canEdit, onChange }) {
  const p = partner;
  const set = (patch) => onChange(patch);
  const setBank = (patch) => onChange({ bank: { ...(p.bank || {}), ...patch } });
  const input = 'w-full rounded-lg border border-border px-3 py-2 text-sm disabled:bg-slate-100';

  return (
    <div className="space-y-5">
      <section>
        <h4 className="mb-2 text-sm font-bold text-text">{isAr ? 'الحالة والهوية' : 'Status & identity'}</h4>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={isAr ? 'الحالة' : 'Status'}>
            <select disabled={!canEdit} value={p.status || 'active'} onChange={(e) => set({ status: e.target.value })} className={input}>
              {PARTNER_STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{isAr ? s.labelAr : s.labelEn}</option>)}
            </select>
          </Field>
          <Field label={isAr ? 'وسوم (مفصولة بفاصلة)' : 'Tags (comma-separated)'}>
            <input className={input} disabled={!canEdit} value={(p.tags || []).join(', ')}
              onChange={(e) => set({ tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })} />
          </Field>
          <Field label={isAr ? 'الاسم القانوني' : 'Legal name'}>
            <input className={input} disabled={!canEdit} value={p.legalName || ''} onChange={(e) => set({ legalName: e.target.value })} />
          </Field>
          <Field label={isAr ? 'الرقم الضريبي' : 'Tax ID / VAT'}>
            <input className={input} disabled={!canEdit} value={p.taxId || ''} onChange={(e) => set({ taxId: e.target.value })} />
          </Field>
          <Field label={isAr ? 'السجل التجاري' : 'Commercial reg. no.'}>
            <input className={input} disabled={!canEdit} value={p.commercialRegNo || ''} onChange={(e) => set({ commercialRegNo: e.target.value })} />
          </Field>
          <Field label={isAr ? 'مسؤول التواصل' : 'Contact person'}>
            <input className={input} disabled={!canEdit} value={p.contactPerson || ''} onChange={(e) => set({ contactPerson: e.target.value })} />
          </Field>
          <Field label={isAr ? 'العنوان' : 'Address'}>
            <input className={input} disabled={!canEdit} value={p.address || ''} onChange={(e) => set({ address: e.target.value })} />
          </Field>
          <Field label={isAr ? 'المدينة' : 'City'}>
            <input className={input} disabled={!canEdit} value={p.city || ''} onChange={(e) => set({ city: e.target.value })} />
          </Field>
          <Field label={isAr ? 'الدولة' : 'Country'}>
            <input className={input} disabled={!canEdit} value={p.country || ''} onChange={(e) => set({ country: e.target.value })} />
          </Field>
          <Field label={isAr ? 'الموقع الإلكتروني' : 'Website'}>
            <input className={input} disabled={!canEdit} value={p.website || ''} onChange={(e) => set({ website: e.target.value })} />
          </Field>
          <Field label={isAr ? 'بريد كشف الحساب' : 'Statement email'}>
            <input className={input} disabled={!canEdit} value={p.statementEmail || ''} onChange={(e) => set({ statementEmail: e.target.value })} />
          </Field>
        </div>
      </section>

      <section>
        <h4 className="mb-2 flex items-center gap-2 text-sm font-bold text-text">
          <Landmark className="h-4 w-4" /> {isAr ? 'البيانات البنكية' : 'Bank details'}
        </h4>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={isAr ? 'اسم البنك' : 'Bank name'}>
            <input className={input} disabled={!canEdit} value={p.bank?.bankName || ''} onChange={(e) => setBank({ bankName: e.target.value })} />
          </Field>
          <Field label={isAr ? 'اسم صاحب الحساب' : 'Account holder'}>
            <input className={input} disabled={!canEdit} value={p.bank?.accountHolder || ''} onChange={(e) => setBank({ accountHolder: e.target.value })} />
          </Field>
          <Field label="IBAN">
            <input className={input} disabled={!canEdit} value={p.bank?.iban || ''} onChange={(e) => setBank({ iban: e.target.value })} />
          </Field>
          <Field label={isAr ? 'رقم الحساب' : 'Account number'}>
            <input className={input} disabled={!canEdit} value={p.bank?.accountNumber || ''} onChange={(e) => setBank({ accountNumber: e.target.value })} />
          </Field>
          <Field label="SWIFT / BIC">
            <input className={input} disabled={!canEdit} value={p.bank?.swift || ''} onChange={(e) => setBank({ swift: e.target.value })} />
          </Field>
          <Field label={isAr ? 'الفرع' : 'Branch'}>
            <input className={input} disabled={!canEdit} value={p.bank?.branch || ''} onChange={(e) => setBank({ branch: e.target.value })} />
          </Field>
        </div>
      </section>

      <section>
        <h4 className="mb-2 flex items-center gap-2 text-sm font-bold text-text">
          <Wallet className="h-4 w-4" /> {isAr ? 'ضوابط الدفع والعقد' : 'Payout & contract'}
        </h4>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={isAr ? 'طريقة الدفع' : 'Payout method'}>
            <select className={input} disabled={!canEdit} value={p.payoutMethod || ''} onChange={(e) => set({ payoutMethod: e.target.value })}>
              <option value="">—</option>
              <option value="bank_transfer">{isAr ? 'تحويل بنكي' : 'Bank transfer'}</option>
              <option value="cash">{isAr ? 'نقداً' : 'Cash'}</option>
              <option value="wallet">{isAr ? 'محفظة' : 'Wallet'}</option>
              <option value="cheque">{isAr ? 'شيك' : 'Cheque'}</option>
              <option value="other">{isAr ? 'أخرى' : 'Other'}</option>
            </select>
          </Field>
          <Field label={isAr ? 'العملة' : 'Currency'}>
            <input className={input} disabled={!canEdit} value={p.payoutCurrency || 'EGP'} onChange={(e) => set({ payoutCurrency: e.target.value.toUpperCase() })} />
          </Field>
          <Field label={isAr ? 'يوم الدفع الشهري (1–28)' : 'Monthly payout day (1–28)'}>
            <input type="number" min={1} max={28} className={input} disabled={!canEdit}
              value={p.payoutScheduleDay ?? ''} onChange={(e) => set({ payoutScheduleDay: e.target.value === '' ? null : Number(e.target.value) })} />
          </Field>
          <Field label={isAr ? 'أقل مبلغ للصرف' : 'Min payout threshold'}>
            <input type="number" min={0} className={input} disabled={!canEdit}
              value={p.minPayoutThreshold ?? 0} onChange={(e) => set({ minPayoutThreshold: Number(e.target.value) })} />
          </Field>
          <Field label={isAr ? 'أقصى صرف شهري (فارغ = بلا حد)' : 'Max monthly payout (blank = none)'}>
            <input type="number" min={0} className={input} disabled={!canEdit}
              value={p.maxMonthlyPayout ?? ''} onChange={(e) => set({ maxMonthlyPayout: e.target.value === '' ? null : Number(e.target.value) })} />
          </Field>
          <Field label={isAr ? 'عمولة افتراضية % (لقواعد جديدة)' : 'Default commission % (new rules)'}>
            <input type="number" min={0} max={100} className={input} disabled={!canEdit}
              value={p.defaultCommissionPercent ?? ''} onChange={(e) => set({ defaultCommissionPercent: e.target.value === '' ? null : Number(e.target.value) })} />
          </Field>
          <Field label={isAr ? 'بداية العقد' : 'Contract start'}>
            <input type="date" className={input} disabled={!canEdit} value={p.contractStartKey || ''} onChange={(e) => set({ contractStartKey: e.target.value })} />
          </Field>
          <Field label={isAr ? 'نهاية العقد' : 'Contract end'}>
            <input type="date" className={input} disabled={!canEdit} value={p.contractEndKey || ''} onChange={(e) => set({ contractEndKey: e.target.value })} />
          </Field>
        </div>
      </section>

      <section>
        <Field label={isAr ? 'ملاحظات الانضمام' : 'Onboarding notes'}>
          <textarea rows={3} className={input} disabled={!canEdit} value={p.onboardingNotes || ''} onChange={(e) => set({ onboardingNotes: e.target.value })} />
        </Field>
      </section>
    </div>
  );
}

function AmountRows({ title, map, resolve }) {
  const entries = Object.entries(map || {}).sort((a, b) => b[1] - a[1]).slice(0, 12);
  if (!entries.length) return null;
  return (
    <div className="rounded-xl border border-border bg-white p-3">
      <p className="mb-2 text-xs font-bold text-text-muted">{title}</p>
      <ul className="space-y-1 text-sm">
        {entries.map(([k, v]) => (
          <li key={k} className="flex justify-between gap-3">
            <span className="truncate">{resolve ? resolve(k) : k}</span>
            <span className="shrink-0 font-semibold text-emerald-700">{formatPrice(v)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatementTab({ partnerKey, isAr, catalog }) {
  const [period, setPeriod] = useState('30d');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res } = await adminApi.getPartnerStatement(partnerKey, { period });
      setData(res.data);
    } catch { setData(null); } finally { setLoading(false); }
  }, [partnerKey, period]);

  useEffect(() => { load(); }, [load]);

  const ruleName = useMemo(() => {
    const m = {};
    (data?.ruleBreakdown || []).forEach((r) => { m[r.ruleId] = r.name; });
    return m;
  }, [data]);
  const zoneName = (id) => {
    const z = (catalog.deliveryZones || []).find((x) => String(x._id) === String(id));
    return z ? (isAr ? (z.areaAr || z.areaEn) : (z.areaEn || z.areaAr)) : id.slice(-6);
  };
  const productName = (id) => {
    const p = (catalog.products || []).find((x) => String(x._id) === String(id));
    return p ? (isAr ? (p.nameAr || p.nameEn) : (p.nameEn || p.nameAr)) : id.slice(-6);
  };

  if (loading) return <Skeleton className="h-72 rounded-2xl" />;
  if (!data) return <p className="text-sm text-text-muted">{isAr ? 'تعذر تحميل كشف الحساب' : 'Could not load statement'}</p>;

  const b = data.balance || {};
  return (
    <div className="space-y-4 print:space-y-3" id="partner-statement-print">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <div className="flex gap-1 rounded-xl border border-border bg-white p-1">
          {['7d', '30d', '90d', 'mtd'].map((pp) => (
            <button key={pp} type="button" onClick={() => setPeriod(pp)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${period === pp ? 'bg-primary-600 text-white' : 'text-text-muted hover:bg-slate-50'}`}>
              {pp}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-slate-50">
          <Printer className="h-3.5 w-3.5" /> {isAr ? 'طباعة' : 'Print'}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: isAr ? 'إيراد الفترة' : 'Earned (period)', value: formatPrice(b.earnedThisPeriod || 0), cls: 'border-emerald-200 bg-emerald-50/50' },
          { label: isAr ? 'مدفوع (كلي)' : 'Paid to date', value: formatPrice(b.paidToDate || 0), cls: 'border-border' },
          { label: isAr ? 'تسويات' : 'Adjustments', value: formatPrice(b.adjustmentsToDate || 0), cls: 'border-border' },
          { label: isAr ? 'المستحق تقديرياً' : 'Est. outstanding', value: formatPrice(b.outstanding || 0), cls: 'border-amber-200 bg-amber-50/50' },
        ].map((c) => (
          <div key={c.label} className={`rounded-xl border p-3 ${c.cls}`}>
            <p className="text-xs text-text-muted">{c.label}</p>
            <p className="mt-0.5 text-lg font-bold text-text">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <AmountRows title={isAr ? 'حسب القاعدة' : 'By rule'} map={data.earned?.byRule}
          resolve={(k) => ruleName[k] || k} />
        <AmountRows title={isAr ? 'حسب المنطقة' : 'By zone'} map={data.earned?.byZone} resolve={zoneName} />
        <AmountRows title={isAr ? 'حسب المنتج' : 'By product'} map={data.earned?.byProduct} resolve={productName} />
      </div>

      {(data.payouts || []).length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-text-muted">
              <tr>
                <th className="px-3 py-2 text-start">{isAr ? 'الفترة' : 'Period'}</th>
                <th className="px-3 py-2 text-start">{isAr ? 'المبلغ' : 'Amount'}</th>
                <th className="px-3 py-2 text-start">{isAr ? 'الحالة' : 'Status'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.payouts.slice(0, 10).map((p) => (
                <tr key={p._id}>
                  <td className="px-3 py-2 text-text-muted">{p.periodStartKey} → {p.periodEndKey}</td>
                  <td className="px-3 py-2 font-semibold">{formatPrice(p.amount)}</td>
                  <td className="px-3 py-2">{p.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function LedgerTab({ partnerKey, isAr, canEdit, toast }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ type: 'bonus', amount: '', dateKey: '', note: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res } = await adminApi.getPartnerLedger(partnerKey);
      setItems(res.data || []);
    } catch { setItems([]); } finally { setLoading(false); }
  }, [partnerKey]);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!(Number(form.amount) > 0)) return;
    setSaving(true);
    try {
      await adminApi.addPartnerLedgerEntry(partnerKey, { ...form, amount: Number(form.amount) });
      toast.success(isAr ? 'تمت الإضافة' : 'Entry added');
      setForm({ type: 'bonus', amount: '', dateKey: '', note: '' });
      load();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed'); } finally { setSaving(false); }
  };
  const remove = async (id) => {
    try { await adminApi.deletePartnerLedgerEntry(id); load(); } catch { /* noop */ }
  };

  const net = items.reduce((s, e) => {
    const sign = LEDGER_TYPES.find((t) => t.value === e.type)?.sign ?? 1;
    return s + sign * (e.amount || 0);
  }, 0);

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="grid gap-2 rounded-xl border border-border bg-slate-50 p-3 sm:grid-cols-5">
          <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            className="rounded-lg border border-border px-2 py-2 text-sm">
            {LEDGER_TYPES.map((t) => <option key={t.value} value={t.value}>{isAr ? t.labelAr : t.labelEn}</option>)}
          </select>
          <input type="number" min={0} step="any" placeholder={isAr ? 'المبلغ' : 'Amount'} value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            className="rounded-lg border border-border px-2 py-2 text-sm" />
          <input type="date" value={form.dateKey} onChange={(e) => setForm((f) => ({ ...f, dateKey: e.target.value }))}
            className="rounded-lg border border-border px-2 py-2 text-sm" />
          <input type="text" placeholder={isAr ? 'ملاحظة' : 'Note'} value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            className="rounded-lg border border-border px-2 py-2 text-sm" />
          <button type="button" onClick={add} disabled={saving || !(Number(form.amount) > 0)}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {isAr ? 'إضافة' : 'Add'}
          </button>
        </div>
      )}

      <p className="text-sm">
        {isAr ? 'صافي التسويات:' : 'Net adjustments:'}{' '}
        <span className={`font-bold ${net < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{formatPrice(net)}</span>
      </p>

      {loading ? <Skeleton className="h-40 rounded-xl" /> : items.length === 0 ? (
        <p className="rounded-xl border-2 border-dashed border-border py-8 text-center text-sm text-text-muted">
          {isAr ? 'لا توجد تسويات' : 'No ledger entries'}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-text-muted">
              <tr>
                <th className="px-3 py-2 text-start">{isAr ? 'النوع' : 'Type'}</th>
                <th className="px-3 py-2 text-start">{isAr ? 'المبلغ' : 'Amount'}</th>
                <th className="px-3 py-2 text-start">{isAr ? 'التاريخ' : 'Date'}</th>
                <th className="px-3 py-2 text-start">{isAr ? 'ملاحظة' : 'Note'}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((e) => {
                const meta = LEDGER_TYPES.find((t) => t.value === e.type);
                const sign = meta?.sign ?? 1;
                return (
                  <tr key={e._id}>
                    <td className="px-3 py-2">{isAr ? meta?.labelAr : meta?.labelEn}</td>
                    <td className={`px-3 py-2 font-semibold ${sign < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                      {sign < 0 ? '−' : '+'}{formatPrice(e.amount)}
                    </td>
                    <td className="px-3 py-2 text-text-muted">{e.dateKey || (e.createdAt || '').slice(0, 10)}</td>
                    <td className="px-3 py-2 text-text-muted">{e.note}</td>
                    <td className="px-3 py-2 text-end">
                      {canEdit && (
                        <button type="button" onClick={() => remove(e._id)} className="text-red-500 hover:text-red-700">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function PartnerDetailPanel({
  partner, partnerIndex = 0, isAr, canEdit, catalog = {}, onChange, onClose, toast,
}) {
  const [tab, setTab] = useState('profile');
  const key = partnerKeyOf(partner);
  const name = isAr ? (partner.nameAr || partner.nameEn) : (partner.nameEn || partner.nameAr);

  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-slate-900/40">
      <div className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <span className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg font-bold text-white ${partnerColor(partnerIndex)}`}>
              {(name || '?').charAt(0).toUpperCase()}
            </span>
            <div>
              <h2 className="text-lg font-bold text-text">{name || (isAr ? 'شريك جديد' : 'New partner')}</h2>
              {partner.tags?.length > 0 && (
                <p className="text-xs text-text-muted">{partner.tags.join(' · ')}</p>
              )}
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-text-muted hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex gap-1 border-b border-border px-3 py-2">
          {TABS.map(({ id, ar, en, Icon }) => (
            <button key={id} type="button" onClick={() => setTab(id)}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold ${tab === id ? 'bg-primary-600 text-white' : 'text-text-muted hover:bg-slate-50'}`}>
              <Icon className="h-4 w-4" /> {isAr ? ar : en}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'profile' && <ProfileTab partner={partner} isAr={isAr} canEdit={canEdit} onChange={onChange} />}
          {tab !== 'profile' && !key && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {isAr ? 'احفظ الشريك أولاً لعرض كشف الحساب والتسويات.' : 'Save the partner first to view statement and ledger.'}
            </p>
          )}
          {tab === 'statement' && key && <StatementTab partnerKey={key} isAr={isAr} catalog={catalog} />}
          {tab === 'ledger' && key && <LedgerTab partnerKey={key} isAr={isAr} canEdit={canEdit} toast={toast} />}
        </div>

        {tab === 'profile' && (
          <div className="border-t border-border px-5 py-3 text-xs text-text-muted">
            {isAr ? 'التعديلات تُحفظ مع زر «حفظ» في تبويب الشركاء.' : 'Changes save with the Save button in the Partners tab.'}
          </div>
        )}
      </div>
    </div>
  );
}
