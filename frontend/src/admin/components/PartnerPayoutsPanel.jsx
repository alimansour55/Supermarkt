import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Ban,
  CheckCircle2,
  Clock,
  Download,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import { adminApi } from '../adminApi';
import { formatPrice } from '../../utils/formatters';
import { EmptyState } from '../components';
import { Skeleton } from '../components/Skeleton';
import { partnerColor } from './PartnerPercentageBar';

const STATUS_FILTERS = [
  { value: '', labelAr: 'الكل', labelEn: 'All' },
  { value: 'pending', labelAr: 'قيد الانتظار', labelEn: 'Pending' },
  { value: 'paid', labelAr: 'مدفوع', labelEn: 'Paid' },
  { value: 'cancelled', labelAr: 'ملغي', labelEn: 'Cancelled' },
];

const PAYOUT_PERIODS = [
  { value: '7d', labelAr: '7 أيام', labelEn: '7 days' },
  { value: '30d', labelAr: '30 يوماً', labelEn: '30 days' },
  { value: '90d', labelAr: '90 يوماً', labelEn: '90 days' },
  { value: 'mtd', labelAr: 'هذا الشهر', labelEn: 'This month' },
];

const PAYMENT_METHODS = [
  { value: 'bank_transfer', labelAr: 'تحويل بنكي', labelEn: 'Bank transfer' },
  { value: 'cash', labelAr: 'نقداً', labelEn: 'Cash' },
  { value: 'wallet', labelAr: 'محفظة إلكترونية', labelEn: 'Mobile wallet' },
  { value: 'cheque', labelAr: 'شيك', labelEn: 'Cheque' },
  { value: 'other', labelAr: 'أخرى', labelEn: 'Other' },
];

function partnerKeyOf(p) {
  if (p.userId) return String(p.userId);
  if (p._id) return String(p._id);
  return null;
}

function StatusBadge({ status, isAr }) {
  const map = {
    pending: { cls: 'bg-amber-100 text-amber-800', Icon: Clock, ar: 'قيد الانتظار', en: 'Pending' },
    paid: { cls: 'bg-emerald-100 text-emerald-800', Icon: CheckCircle2, ar: 'مدفوع', en: 'Paid' },
    cancelled: { cls: 'bg-slate-200 text-slate-600', Icon: Ban, ar: 'ملغي', en: 'Cancelled' },
  };
  const meta = map[status] || map.pending;
  const { Icon } = meta;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${meta.cls}`}>
      <Icon className="h-3.5 w-3.5" />
      {isAr ? meta.ar : meta.en}
    </span>
  );
}

function Modal({ titleAr, titleEn, isAr, onClose, children, icon: Icon = Wallet, wide = false }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/50 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        className={`max-h-[90vh] w-full ${wide ? 'max-w-2xl' : 'max-w-md'} overflow-y-auto rounded-2xl border border-border bg-white shadow-xl`}
      >
        <div className="flex items-start justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
              <Icon className="h-5 w-5" />
            </span>
            <h2 className="text-lg font-bold text-text">{isAr ? titleAr : titleEn}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-text-muted hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function GeneratePayoutModal({ isAr, partners, onClose, onGenerate, saving }) {
  const [period, setPeriod] = useState('30d');
  const [useCustom, setUseCustom] = useState(false);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [selected, setSelected] = useState(() => new Set(partners.map(partnerKeyOf).filter(Boolean)));

  const toggle = (key) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const handleSubmit = () => {
    const payload = { partnerKeys: [...selected] };
    if (useCustom && start && end) {
      payload.start = start;
      payload.end = end;
    } else {
      payload.period = period;
    }
    onGenerate(payload);
  };

  return (
    <Modal isAr={isAr} titleAr="توليد مستحقات من التقرير" titleEn="Generate payouts from report" icon={Sparkles} onClose={onClose} wide>
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-sm font-semibold text-text">{isAr ? 'الفترة' : 'Period'}</p>
          <div className="flex flex-wrap gap-2">
            {PAYOUT_PERIODS.map((p) => (
              <button key={p.value} type="button"
                onClick={() => { setUseCustom(false); setPeriod(p.value); }}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${!useCustom && period === p.value ? 'bg-primary-600 text-white' : 'border border-border text-text-muted hover:bg-slate-50'}`}>
                {isAr ? p.labelAr : p.labelEn}
              </button>
            ))}
            <button type="button" onClick={() => setUseCustom(true)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${useCustom ? 'bg-primary-600 text-white' : 'border border-border text-text-muted hover:bg-slate-50'}`}>
              {isAr ? 'مخصص' : 'Custom'}
            </button>
          </div>
          {useCustom && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs text-text-muted">{isAr ? 'من' : 'From'}</span>
                <input type="date" value={start} onChange={(e) => setStart(e.target.value)}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-text-muted">{isAr ? 'إلى' : 'To'}</span>
                <input type="date" value={end} onChange={(e) => setEnd(e.target.value)}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
              </label>
            </div>
          )}
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-text">{isAr ? 'الشركاء' : 'Partners'}</p>
          <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-xl border border-border p-2">
            {partners.map((p, i) => {
              const key = partnerKeyOf(p);
              const name = isAr ? (p.nameAr || p.nameEn) : (p.nameEn || p.nameAr);
              return (
                <label key={key || i} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                  <input type="checkbox" checked={selected.has(key)} onChange={() => toggle(key)}
                    className="h-4 w-4 rounded text-primary-600" />
                  <span className={`flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold text-white ${partnerColor(i)}`}>
                    {(name || '?').charAt(0).toUpperCase()}
                  </span>
                  <span className="text-sm">{name}</span>
                </label>
              );
            })}
          </div>
        </div>

        <p className="rounded-lg bg-violet-50 px-3 py-2 text-xs text-violet-900">
          {isAr
            ? 'يُنشأ سجل «قيد الانتظار» لكل شريك بمبلغه المحسوب لهذه الفترة. الشركاء الذين لديهم سجل بنفس الفترة يُتجاهلون تلقائياً.'
            : 'Creates a "pending" record per partner for their computed amount this period. Partners with an existing record for the same period are skipped automatically.'}
        </p>

        <div className="flex justify-end gap-3 border-t border-border pt-4">
          <button type="button" onClick={onClose} className="rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-slate-50">
            {isAr ? 'إلغاء' : 'Cancel'}
          </button>
          <button type="button" disabled={saving || !selected.size} onClick={handleSubmit}
            className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isAr ? 'توليد المستحقات' : 'Generate payouts'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ManualPayoutModal({ isAr, partners, onClose, onSubmit, saving }) {
  const [partnerKey, setPartnerKey] = useState('');
  const [customName, setCustomName] = useState('');
  const [amount, setAmount] = useState('');
  const [periodLabel, setPeriodLabel] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = () => {
    const match = partners.find((p) => partnerKeyOf(p) === partnerKey);
    onSubmit({
      partnerKey: partnerKey || null,
      partnerNameAr: match ? match.nameAr : customName,
      partnerNameEn: match ? match.nameEn : customName,
      amount: Number(amount),
      periodLabel,
      notes,
    });
  };

  return (
    <Modal isAr={isAr} titleAr="إضافة مستحق يدوي" titleEn="Add manual payout" icon={Plus} onClose={onClose}>
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-text-muted">{isAr ? 'الشريك' : 'Partner'}</span>
          <select value={partnerKey} onChange={(e) => setPartnerKey(e.target.value)}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm">
            <option value="">{isAr ? '— شريك خارجي (اكتب الاسم) —' : '— External partner (type name) —'}</option>
            {partners.map((p, i) => {
              const key = partnerKeyOf(p);
              return (
                <option key={key || i} value={key}>{isAr ? (p.nameAr || p.nameEn) : (p.nameEn || p.nameAr)}</option>
              );
            })}
          </select>
        </label>
        {!partnerKey && (
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-text-muted">{isAr ? 'اسم الشريك' : 'Partner name'}</span>
            <input type="text" value={customName} onChange={(e) => setCustomName(e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
          </label>
        )}
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-text-muted">{isAr ? 'المبلغ' : 'Amount'}</span>
          <input type="number" min={0} step={0.01} value={amount} onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-text-muted">{isAr ? 'وصف الفترة (اختياري)' : 'Period label (optional)'}</span>
          <input type="text" value={periodLabel} onChange={(e) => setPeriodLabel(e.target.value)}
            placeholder={isAr ? 'مثال: مكافأة يناير' : 'e.g. January bonus'}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-text-muted">{isAr ? 'ملاحظات' : 'Notes'}</span>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
        </label>

        <div className="flex justify-end gap-3 border-t border-border pt-4">
          <button type="button" onClick={onClose} className="rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-slate-50">
            {isAr ? 'إلغاء' : 'Cancel'}
          </button>
          <button type="button" disabled={saving || !(Number(amount) > 0) || (!partnerKey && !customName.trim())} onClick={handleSubmit}
            className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isAr ? 'إضافة' : 'Add'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function MarkPaidModal({ isAr, payout, onClose, onSubmit, saving }) {
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');

  return (
    <Modal isAr={isAr} titleAr="تأكيد الدفع" titleEn="Confirm payment" icon={CheckCircle2} onClose={onClose}>
      <div className="space-y-4">
        <p className="rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900">
          {isAr
            ? `تأكيد دفع ${formatPrice(payout.amount)} إلى ${payout.partnerNameAr || payout.partnerNameEn}`
            : `Confirm payment of ${formatPrice(payout.amount)} to ${payout.partnerNameEn || payout.partnerNameAr}`}
        </p>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-text-muted">{isAr ? 'طريقة الدفع' : 'Payment method'}</span>
          <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm">
            {PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>{isAr ? m.labelAr : m.labelEn}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-text-muted">{isAr ? 'رقم مرجعي (اختياري)' : 'Reference number (optional)'}</span>
          <input type="text" value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-text-muted">{isAr ? 'ملاحظات' : 'Notes'}</span>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
        </label>
        <div className="flex justify-end gap-3 border-t border-border pt-4">
          <button type="button" onClick={onClose} className="rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-slate-50">
            {isAr ? 'إلغاء' : 'Cancel'}
          </button>
          <button type="button" disabled={saving} onClick={() => onSubmit({ paymentMethod, referenceNumber, notes })}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isAr ? 'تأكيد الدفع' : 'Confirm paid'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function exportPayoutsCsv(items, isAr) {
  if (!items?.length) return;
  const headers = isAr
    ? ['الشريك', 'الفترة', 'المبلغ', 'الحالة', 'طريقة الدفع', 'رقم مرجعي', 'تاريخ الإنشاء']
    : ['Partner', 'Period', 'Amount', 'Status', 'Method', 'Reference', 'Created'];
  const rows = items.map((p) => [
    isAr ? (p.partnerNameAr || p.partnerNameEn) : (p.partnerNameEn || p.partnerNameAr),
    p.periodLabel || `${p.periodStartKey || ''} → ${p.periodEndKey || ''}`,
    p.amount,
    p.status,
    p.paymentMethod || '',
    p.referenceNumber || '',
    p.createdAt ? new Date(p.createdAt).toISOString().slice(0, 10) : '',
  ]);
  const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'partner-payouts.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export default function PartnerPayoutsPanel({ isAr, canEdit, partners = [], toast }) {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showGenerate, setShowGenerate] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [markPaidTarget, setMarkPaidTarget] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: listRes }, { data: summaryRes }] = await Promise.all([
        adminApi.getPartnerPayouts({ status: statusFilter || undefined, q: search || undefined, limit: 100 }),
        adminApi.getPartnerPayoutSummary(),
      ]);
      setItems(listRes.data || []);
      setSummary(summaryRes.data || null);
    } catch {
      setItems([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => { load(); }, [load]);

  const activePartners = useMemo(() => partners.filter((p) => p.isActive !== false), [partners]);

  const handleGenerate = async (payload) => {
    setSaving(true);
    try {
      const { data: res } = await adminApi.generatePartnerPayouts(payload);
      const created = res.data?.created?.length || 0;
      const skipped = res.data?.skippedCount || 0;
      toast.success(isAr
        ? `تم إنشاء ${created} مستحق${skipped ? ` (تخطي ${skipped} موجود مسبقاً)` : ''}`
        : `Created ${created} payout(s)${skipped ? ` (skipped ${skipped} existing)` : ''}`);
      setShowGenerate(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || (isAr ? 'فشل التوليد' : 'Generation failed'));
    } finally {
      setSaving(false);
    }
  };

  const handleManualAdd = async (payload) => {
    setSaving(true);
    try {
      await adminApi.createPartnerPayout(payload);
      toast.success(isAr ? 'تمت الإضافة' : 'Payout added');
      setShowManual(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || (isAr ? 'فشلت الإضافة' : 'Add failed'));
    } finally {
      setSaving(false);
    }
  };

  const handleMarkPaid = async (payload) => {
    setSaving(true);
    try {
      await adminApi.setPartnerPayoutStatus(markPaidTarget._id, { status: 'paid', ...payload });
      toast.success(isAr ? 'تم تسجيل الدفع' : 'Marked as paid');
      setMarkPaidTarget(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || (isAr ? 'فشلت العملية' : 'Action failed'));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (id) => {
    setBusyId(id);
    try {
      await adminApi.setPartnerPayoutStatus(id, { status: 'cancelled' });
      toast.success(isAr ? 'تم الإلغاء' : 'Cancelled');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || (isAr ? 'فشلت العملية' : 'Action failed'));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id) => {
    setBusyId(id);
    try {
      await adminApi.deletePartnerPayout(id);
      toast.success(isAr ? 'تم الحذف' : 'Deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || (isAr ? 'فشل الحذف' : 'Delete failed'));
    } finally {
      setBusyId(null);
    }
  };

  const totals = summary?.totals || {};

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: isAr ? 'قيد الانتظار' : 'Pending', value: formatPrice(totals.pending || 0), sub: `${totals.pendingCount || 0} ${isAr ? 'سجل' : 'record(s)'}`, cls: 'border-amber-200 bg-amber-50/50' },
          { label: isAr ? 'مدفوع (إجمالي)' : 'Paid (total)', value: formatPrice(totals.paid || 0), sub: `${totals.paidCount || 0} ${isAr ? 'سجل' : 'record(s)'}`, cls: 'border-emerald-200 bg-emerald-50/50' },
          { label: isAr ? 'ملغي' : 'Cancelled', value: formatPrice(totals.cancelled || 0), sub: '', cls: 'border-border' },
          { label: isAr ? 'الشركاء النشطون' : 'Active partners', value: activePartners.length, sub: '', cls: 'border-border' },
        ].map((card) => (
          <div key={card.label} className={`rounded-2xl border p-5 shadow-sm ${card.cls}`}>
            <p className="text-sm text-text-muted">{card.label}</p>
            <p className="mt-1 text-2xl font-bold text-text">{card.value}</p>
            {card.sub && <p className="mt-0.5 text-xs text-text-muted">{card.sub}</p>}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-xl border border-border bg-white p-1">
            {STATUS_FILTERS.map((s) => (
              <button key={s.value} type="button" onClick={() => setStatusFilter(s.value)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${statusFilter === s.value ? 'bg-primary-600 text-white' : 'text-text-muted hover:bg-slate-50'}`}>
                {isAr ? s.labelAr : s.labelEn}
              </button>
            ))}
          </div>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={isAr ? 'بحث بالاسم أو الرقم المرجعي...' : 'Search name or reference...'}
            className="w-56 rounded-xl border border-border px-3 py-2 text-sm" />
        </div>
        <div className="flex flex-wrap gap-2">
          {items.length > 0 && (
            <button type="button" onClick={() => exportPayoutsCsv(items, isAr)}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50">
              <Download className="h-4 w-4" />
              CSV
            </button>
          )}
          {canEdit && (
            <>
              <button type="button" onClick={() => setShowManual(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50">
                <Plus className="h-4 w-4" />
                {isAr ? 'مستحق يدوي' : 'Manual payout'}
              </button>
              <button type="button" onClick={() => setShowGenerate(true)} disabled={!activePartners.length}
                className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-60">
                <Sparkles className="h-4 w-4" />
                {isAr ? 'توليد من التقرير' : 'Generate from report'}
              </button>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-72 rounded-2xl" />
      ) : !items.length ? (
        <EmptyState
          title={isAr ? 'لا توجد مستحقات بعد' : 'No payouts yet'}
          description={isAr ? 'ولّد مستحقات من تقرير فترة أو أضف مستحقاً يدوياً' : 'Generate payouts from a period report or add one manually'}
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-text-muted">
              <tr>
                <th className="px-4 py-3 text-start">{isAr ? 'الشريك' : 'Partner'}</th>
                <th className="px-4 py-3 text-start">{isAr ? 'الفترة' : 'Period'}</th>
                <th className="px-4 py-3 text-start">{isAr ? 'المبلغ' : 'Amount'}</th>
                <th className="px-4 py-3 text-start">{isAr ? 'الحالة' : 'Status'}</th>
                <th className="px-4 py-3 text-start">{isAr ? 'طريقة الدفع' : 'Method'}</th>
                <th className="px-4 py-3 text-start">{isAr ? 'إجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((p) => {
                const name = isAr ? (p.partnerNameAr || p.partnerNameEn) : (p.partnerNameEn || p.partnerNameAr);
                const busy = busyId === p._id;
                return (
                  <tr key={p._id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium">{name || '—'}</p>
                      {p.notes && <p className="mt-0.5 max-w-[220px] truncate text-xs text-text-muted" title={p.notes}>{p.notes}</p>}
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      {p.periodLabel && !p.periodStartKey ? p.periodLabel : (p.periodStartKey ? `${p.periodStartKey} → ${p.periodEndKey}` : '—')}
                    </td>
                    <td className="px-4 py-3 font-bold text-emerald-700">{formatPrice(p.amount)}</td>
                    <td className="px-4 py-3"><StatusBadge status={p.status} isAr={isAr} /></td>
                    <td className="px-4 py-3 text-text-muted">
                      {p.paymentMethod ? (isAr ? PAYMENT_METHODS.find((m) => m.value === p.paymentMethod)?.labelAr : PAYMENT_METHODS.find((m) => m.value === p.paymentMethod)?.labelEn) : '—'}
                      {p.referenceNumber && <span className="ms-1 text-xs">({p.referenceNumber})</span>}
                    </td>
                    <td className="px-4 py-3">
                      {canEdit && (
                        <div className="flex items-center gap-1.5">
                          {p.status === 'pending' && (
                            <>
                              <button type="button" disabled={busy} onClick={() => setMarkPaidTarget(p)}
                                title={isAr ? 'تأكيد الدفع' : 'Mark paid'}
                                className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50">
                                <CheckCircle2 className="h-4 w-4" />
                              </button>
                              <button type="button" disabled={busy} onClick={() => handleCancel(p._id)}
                                title={isAr ? 'إلغاء' : 'Cancel'}
                                className="rounded-lg p-1.5 text-amber-600 hover:bg-amber-50 disabled:opacity-50">
                                <Ban className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          {p.status !== 'paid' && (
                            <button type="button" disabled={busy} onClick={() => handleDelete(p._id)}
                              title={isAr ? 'حذف' : 'Delete'}
                              className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 disabled:opacity-50">
                              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showGenerate && (
        <GeneratePayoutModal
          isAr={isAr}
          partners={activePartners}
          saving={saving}
          onClose={() => setShowGenerate(false)}
          onGenerate={handleGenerate}
        />
      )}
      {showManual && (
        <ManualPayoutModal
          isAr={isAr}
          partners={activePartners}
          saving={saving}
          onClose={() => setShowManual(false)}
          onSubmit={handleManualAdd}
        />
      )}
      {markPaidTarget && (
        <MarkPaidModal
          isAr={isAr}
          payout={markPaidTarget}
          saving={saving}
          onClose={() => setMarkPaidTarget(null)}
          onSubmit={handleMarkPaid}
        />
      )}
    </div>
  );
}
