import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ban, CheckCircle2, Circle, ExternalLink, RotateCcw, XCircle } from 'lucide-react';
import { Link } from '../../../app/router';
import Button from '../../../components/ui/Button';
import Loader from '../../../components/ui/Loader';
import { useConfirm, useToast } from '../index';
import { adminApi } from '../../adminApi';
import { categoryService } from '../../../services/apiServices';
import { ACCOUNT_HEALTH, DOCUMENT_STATUS, DOCUMENT_TYPES, FULFILLMENT, LISTING_STATUS, SELLER_STATUS, apiError, label } from '../../../seller/sellerLabels';
import StatusBadge from '../../../seller/StatusBadge';
import { formatDate, formatMoneyLatin } from '../../../utils/formatters';
import { SELLER_NEXT_ACTIONS, sellerChecklist } from '../../utils/sellerAdmin';
import SellerAccessSection from './SellerAccessSection';
import SellerReasonDialog from './SellerReasonDialog';
import SellerPenaltyForm from './SellerPenaltyForm';
import SellerProfileEditor from './SellerProfileEditor';
import SellerDealCard from './SellerDealCard';
import SellerHistoryCard from './SellerHistoryCard';
import ScheduledDealsCard from './ScheduledDealsCard';
import { splitDealPayload } from '../../utils/sellerDeal';
import { useAuth } from '../../../context/AuthContext';
import FeeCalculator from '../sellerFees/FeeCalculator';
import { cairoDate, cairoDayStart, categoryOptions, rangeFromPreset, toField, toNum } from '../../utils/sellerFeesAdmin';

const inputCls = 'w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:bg-slate-50';
const money = (n, isAr) => `${formatMoneyLatin(n || 0, { maximumFractionDigits: 0 })} ${isAr ? 'ج.م' : 'EGP'}`;
const fmtDate = (v, isAr) => (v ? formatDate(v, isAr ? 'ar-EG' : 'en-GB') : '—');

function Card({ title, action, children }) {
  return (
    <section className="rounded-2xl border border-border bg-white p-4">
      {(title || action) && (
        <div className="mb-2 flex items-center justify-between gap-2">
          {title && <h3 className="font-bold">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

function Row({ k, v, ltr }) {
  if (!v || v === '—') return null;
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-2 text-sm last:border-0">
      <span className="text-text-muted">{k}</span>
      <span className="text-end font-medium" dir={ltr ? 'ltr' : 'auto'}>{v || '—'}</span>
    </div>
  );
}

function formFromSeller(s) {
  return {
    commissionRate: s.commissionRate ?? '',
    categoryCommissions: (s.categoryCommissions || []).map((r) => ({ category: String(r.category?._id || r.category), rate: String(r.rate) })),
    allowedFulfillment: s.allowedFulfillment || ['seller'],
    autoApproveListings: Boolean(s.autoApproveListings),
    defaultFulfillment: s.defaultFulfillment || (s.allowedFulfillment || ['seller'])[0],
    vacationOff: false,
    deliveryZones: (s.deliveryZones || []).map((z) => String(z?._id || z)),
    handlingDays: String(s.handlingDays ?? 2),
    internalNote: s.internalNote || '',
    feePlan: s.feePlan || '',
    feeOverrides: overridesForm(s.feeOverrides),
  };
}

const OVERRIDE_NUMBERS = ['fixedFeePerItem', 'fixedFeePerShipment', 'minCommissionPerItem', 'maxCommissionPerItem', 'storeFulfillmentFeePerItem', 'monthlyFee', 'payoutHoldDays'];

function overridesForm(o = {}) {
  return {
    ...Object.fromEntries(OVERRIDE_NUMBERS.map((k) => [k, toField(o?.[k])])),
    // Stored as the instant after the last free day.
    commissionFreeUntil: o?.commissionFreeUntil ? cairoDate(new Date(new Date(o.commissionFreeUntil).getTime() - 1)) : '',
    vatExempt: o?.vatExempt === true,
    payoutFrequency: o?.payoutFrequency || '',
  };
}

/** Panel form → the PUT payload (also used to diff against what was loaded). */
function payloadFromForm(form) {
  return {
    commissionRate: form.commissionRate === '' ? null : Number(form.commissionRate),
    categoryCommissions: form.categoryCommissions.filter((r) => r.category && r.rate !== '').map((r) => ({ category: r.category, rate: Number(r.rate) })),
    allowedFulfillment: form.allowedFulfillment,
    defaultFulfillment: form.allowedFulfillment.includes(form.defaultFulfillment) ? form.defaultFulfillment : form.allowedFulfillment[0],
    ...(form.vacationOff ? { vacationOff: true } : {}),
    deliveryZones: form.deliveryZones,
    autoApproveListings: form.autoApproveListings,
    handlingDays: Number(form.handlingDays),
    internalNote: form.internalNote,
    feePlan: form.feePlan,
    feeOverrides: overridesPayload(form.feeOverrides),
  };
}

function overridesPayload(o) {
  return {
    ...Object.fromEntries(OVERRIDE_NUMBERS.map((k) => [k, toNum(o[k])])),
    // "Free until" a date includes that whole day.
    commissionFreeUntil: o.commissionFreeUntil ? new Date(new Date(cairoDayStart(o.commissionFreeUntil)).getTime() + 86400000).toISOString() : null,
    vatExempt: o.vatExempt,
    payoutFrequency: o.payoutFrequency,
  };
}

const TABS = [
  { id: 'overview', ar: 'نظرة عامة', en: 'Overview' },
  { id: 'documents', ar: 'المستندات', en: 'Documents' },
  { id: 'rules', ar: 'العمولة والرسوم', en: 'Fees & rules' },
  { id: 'payouts', ar: 'الأرباح والمدفوعات', en: 'Money' },
  { id: 'logins', ar: 'الدخول وكلمات المرور', en: 'Logins & passwords' },
];

/** Approval checklist — advisory, shown while the seller is not yet active. */
function Checklist({ items, isAr }) {
  const remaining = items.filter((i) => !i.done).length;
  return (
    <div className="rounded-xl border border-border bg-white p-3">
      <p className="mb-2 text-sm font-semibold">
        {remaining
          ? (isAr ? `قبل الاعتماد — ${remaining} ناقص` : `Before you approve — ${remaining} to check`)
          : (isAr ? 'جاهز للاعتماد' : 'Ready to approve')}
      </p>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {items.map((i) => (
          <li key={i.key} className={`flex items-center gap-2 text-sm ${i.done ? 'text-emerald-800' : 'text-text-muted'}`}>
            {i.done ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> : <Circle className="h-4 w-4 shrink-0 text-slate-300" />}
            {isAr ? i.ar : i.en}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function SellerDetailPanel({ sellerId, isAr, canWrite, canSeeMoney, onChanged, onDirtyChange, initialTab = 'overview' }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [seller, setSeller] = useState(null);
  const [form, setForm] = useState(null);
  const [initialForm, setInitialForm] = useState(null);
  const [categories, setCategories] = useState([]);
  const [balance, setBalance] = useState(null);
  const [tab, setTab] = useState(TABS.some((t) => t.id === initialTab) ? initialTab : 'overview');
  const [plans, setPlans] = useState([]);
  const [zones, setZones] = useState([]);
  const [profit, setProfit] = useState(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reasonFor, setReasonFor] = useState('');
  const [docReject, setDocReject] = useState(null); // { id, note } while typing a rejection note
  const [editingProfile, setEditingProfile] = useState(false);
  const [deal, setDeal] = useState(null);
  const [historyKey, setHistoryKey] = useState(0);
  const [applyMode, setApplyMode] = useState({ when: 'now', date: '', note: '' });
  const [minScheduleDate] = useState(() => cairoDate(new Date(Date.now() + 86400000)));
  const { user: me } = useAuth();
  const isSuperAdmin = me?.role === 'super_admin';

  const load = useCallback(() => adminApi.getSeller(sellerId)
    .then(({ data }) => {
      const s = data.data;
      setSeller(s);
      const f = formFromSeller(s);
      setForm(f);
      setInitialForm(f);
    })
    .catch(() => toast.error(isAr ? 'تعذّر تحميل البائع' : 'Could not load seller')), [sellerId, isAr, toast]);

  const loadDeal = useCallback(() => adminApi.getSellerDeal(sellerId)
    .then(({ data }) => setDeal(data.data))
    .catch(() => setDeal({ error: true })), [sellerId]);

  useEffect(() => { load(); loadDeal(); }, [load, loadDeal]);
  useEffect(() => {
    categoryService.getAll().then(({ data }) => setCategories(data.data || [])).catch(() => {});
    adminApi.getMarketplaceSettings().then(({ data }) => setPlans(data.data?.plans || [])).catch(() => {});
    adminApi.getDeliveryZones().then(({ data }) => setZones((data.data || []).filter((z) => z.isActive !== false))).catch(() => {});
  }, []);
  const loadProfit = useCallback(() => Promise.all([
    adminApi.getSellerProfit({ sellerId, ...rangeFromPreset('30d') }),
    adminApi.getSellerProfit({ sellerId, from: '2000-01-01', to: cairoDate() }),
  ]).then(([recent, all]) => setProfit({ recent: recent.data.data.totals, all: all.data.data.totals })).catch(() => setProfit({})), [sellerId]);
  useEffect(() => {
    if (tab !== 'payouts' || !canSeeMoney || profit) return;
    loadProfit();
  }, [tab, canSeeMoney, profit, loadProfit]);
  useEffect(() => {
    if (tab !== 'payouts' || !canSeeMoney || balance) return;
    adminApi.getSellerLedger(sellerId, { limit: 1 }).then(({ data }) => setBalance(data.balance || {})).catch(() => setBalance({}));
  }, [tab, canSeeMoney, sellerId, balance]);

  const dirty = useMemo(() => Boolean(form && initialForm && JSON.stringify(form) !== JSON.stringify(initialForm)), [form, initialForm]);
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  const refresh = () => { load(); loadDeal(); setHistoryKey((k) => k + 1); onChanged(); };

  const changeStatus = async (status, reason = '') => {
    setBusy(true);
    try {
      await adminApi.setSellerStatus(seller._id, { status, reason });
      toast.success(isAr ? 'تم تحديث الحالة' : 'Status updated');
      setReasonFor('');
      refresh();
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر التحديث' : 'Update failed'));
    } finally {
      setBusy(false);
    }
  };

  const requestStatus = async (status) => {
    if (status === 'rejected' || status === 'suspended') { setReasonFor(status); return; }
    if (status === 'active') {
      const missing = sellerChecklist(seller).filter((i) => !i.done && i.key !== 'login');
      const name = isAr ? seller.nameAr : seller.nameEn;
      const ok = await confirm({
        title: seller.status === 'suspended' ? (isAr ? `إعادة تفعيل ${name}؟` : `Reactivate ${name}?`) : (isAr ? `اعتماد ${name}؟` : `Approve ${name}?`),
        message: missing.length
          ? (isAr ? `لم يكتمل بعد: ${missing.map((i) => i.ar).join('، ')}. ستظهر منتجاته المعتمدة في المتجر فوراً.` : `Still missing: ${missing.map((i) => i.en).join(', ')}. Their approved products go live right away.`)
          : (isAr ? 'ستظهر منتجاته المعتمدة في المتجر فوراً.' : 'Their approved products go live right away.'),
        confirmLabel: seller.status === 'suspended' ? (isAr ? 'إعادة التفعيل' : 'Reactivate') : (isAr ? 'اعتماد' : 'Approve'),
        cancelLabel: isAr ? 'إلغاء' : 'Cancel',
        variant: 'primary',
      });
      if (!ok) return;
    }
    changeStatus(status);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = payloadFromForm(form);
      if (applyMode.when === 'date') {
        // Deal fields wait for the date; everything else (operations, notes) saves now.
        const { deal: dealChanges, rest } = splitDealPayload(payload, payloadFromForm(initialForm));
        if (!applyMode.date) throw new Error(isAr ? 'اختر تاريخ التطبيق' : 'Choose the date it starts');
        if (!Object.keys(dealChanges).length) throw new Error(isAr ? 'لم تغيّر شيئاً في العمولة أو الرسوم لجدولته' : 'Nothing in commission or fees changed to schedule');
        if (Object.keys(rest).length) await adminApi.updateSeller(sellerId, rest);
        await adminApi.scheduleSellerDeal(sellerId, { applyAt: cairoDayStart(applyMode.date), changes: dealChanges, note: applyMode.note });
        toast.success(isAr ? 'تمت جدولة التغيير' : 'Change scheduled');
        setApplyMode({ when: 'now', date: '', note: '' });
      } else {
        await adminApi.updateSeller(sellerId, payload);
        toast.success(isAr ? 'تم الحفظ' : 'Saved');
      }
      refresh();
    } catch (err) {
      toast.error(err.response ? apiError(err, isAr ? 'تعذّر الحفظ' : 'Save failed') : err.message);
    } finally {
      setSaving(false);
    }
  };

  const reviewDoc = async (docId, status, note = '') => {
    try {
      await adminApi.reviewSellerDocument(sellerId, docId, { status, note });
      setDocReject(null);
      load();
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر التحديث' : 'Update failed'));
    }
  };

  if (!seller || !form) return <div className="flex min-h-[200px] items-center justify-center"><Loader size="lg" /></div>;

  const name = isAr ? seller.nameAr : seller.nameEn;
  const checklist = sellerChecklist(seller);
  const next = SELLER_NEXT_ACTIONS[seller.status] || [];
  const health = seller.performance?.health && ACCOUNT_HEALTH[seller.performance.health];
  const catOptions = categoryOptions(categories, isAr);
  const lookup = {
    category: (id) => { const c = categories.find((x) => String(x._id) === String(id)); return c ? (isAr ? c.nameAr : c.nameEn) : ''; },
    plan: (key) => { const p = plans.find((x) => x.key === key); return p ? (isAr ? p.nameAr || p.nameEn : p.nameEn || p.nameAr) : key; },
  };
  const setOverride = (k, v) => setForm((f) => ({ ...f, feeOverrides: { ...f.feeOverrides, [k]: v } }));
  const setRule = (i, key, value) => setForm((f) => ({ ...f, categoryCommissions: f.categoryCommissions.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)) }));
  const toggleMode = (mode) => setForm((f) => ({
    ...f,
    allowedFulfillment: f.allowedFulfillment.includes(mode) ? f.allowedFulfillment.filter((m) => m !== mode) : [...f.allowedFulfillment, mode],
  }));
  const pendingDocs = (seller.documents || []).filter((d) => d.status === 'pending').length;

  const actionButtons = canWrite && (
    <div className="flex flex-wrap gap-2">
      {next.includes('active') && (
        <Button size="sm" disabled={busy} onClick={() => requestStatus('active')} className="gap-1.5">
          {seller.status === 'suspended' ? <RotateCcw className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          {seller.status === 'suspended' ? (isAr ? 'إعادة التفعيل' : 'Reactivate') : (isAr ? 'اعتماد وتفعيل' : 'Approve & activate')}
        </Button>
      )}
      {seller.status === 'applied' && (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => requestStatus('under_review')}>{isAr ? 'بدء المراجعة' : 'Start review'}</Button>
      )}
      {seller.status === 'rejected' && (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => requestStatus('under_review')}>{isAr ? 'إعادة للمراجعة' : 'Back to review'}</Button>
      )}
      {next.includes('rejected') && (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => requestStatus('rejected')} className="gap-1.5 text-red-700"><XCircle className="h-4 w-4" />{isAr ? 'رفض' : 'Reject'}</Button>
      )}
      {next.includes('suspended') && (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => requestStatus('suspended')} className="gap-1.5 text-red-700"><Ban className="h-4 w-4" />{isAr ? 'إيقاف المتجر' : 'Suspend'}</Button>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="flex items-start gap-3">
        {seller.logoUrl
          ? <img src={seller.logoUrl} alt="" className="h-14 w-14 shrink-0 rounded-xl border border-border object-cover" />
          : <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-xl font-bold text-primary-700">{(name || '?').trim().charAt(0)}</span>}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge map={SELLER_STATUS} value={seller.status} isAr={isAr} />
            {health && seller.status === 'active' && (
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${health.tone}`}>
                <health.Icon className="h-3.5 w-3.5" />{isAr ? health.ar : health.en}
              </span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold">
            {seller.status === 'active' && (
              <a href={`/${isAr ? 'ar' : 'en'}/sellers/${seller.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary-700 hover:underline">
                <ExternalLink className="h-3.5 w-3.5" />{isAr ? 'صفحة المتجر' : 'Store page'}
              </a>
            )}
            <Link to={`/admin/listing-review?seller=${seller._id}`} className="text-primary-700 hover:underline">{isAr ? 'منتجات البائع' : 'Products'}</Link>
            <Link to={`/admin/seller-shipments?filter=&seller=${seller._id}`} className="text-primary-700 hover:underline">{isAr ? 'الشحنات' : 'Parcels'}</Link>
            {canSeeMoney && <Link to="/admin/seller-payouts" className="text-primary-700 hover:underline">{isAr ? 'المستحقات' : 'Payouts'}</Link>}
          </div>
        </div>
      </div>

      {seller.statusReason && ['rejected', 'suspended'].includes(seller.status) && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{isAr ? 'السبب: ' : 'Reason: '}{seller.statusReason}</p>
      )}
      {seller.status !== 'active' && <Checklist items={checklist} isAr={isAr} />}
      {actionButtons}

      {/* Tabs */}
      <nav className="-mx-1 flex gap-1 overflow-x-auto border-b border-border px-1 scrollbar-none" aria-label={isAr ? 'أقسام البائع' : 'Seller sections'}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? 'page' : undefined}
            className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-2.5 pb-2 pt-1 text-sm transition-colors ${tab === t.id ? 'border-primary-600 font-semibold text-text' : 'border-transparent text-text-muted hover:text-text'}`}
          >
            {isAr ? t.ar : t.en}
            {t.id === 'documents' && pendingDocs > 0 && <span className="rounded-full bg-amber-100 px-1.5 text-[11px] font-semibold text-amber-900">{pendingDocs}</span>}
            {t.id === 'rules' && dirty && <span className="h-2 w-2 rounded-full bg-amber-500" aria-label={isAr ? 'تغييرات غير محفوظة' : 'Unsaved changes'} />}
          </button>
        ))}
      </nav>

      {tab === 'overview' && (
        <div className="space-y-4">
          <Card>
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <p><span className="block text-xs text-text-muted">{isAr ? 'منتجات معروضة' : 'Live products'}</span><span className="text-lg font-bold">{seller.listings?.approved || 0}</span></p>
              <p><span className="block text-xs text-text-muted">{isAr ? 'التقييم' : 'Rating'}</span><span className="text-lg font-bold">{seller.performance?.ratingCount ? `${seller.performance.rating} ★` : '—'}</span></p>
              <p><span className="block text-xs text-text-muted">{isAr ? 'إلغاء من البائع' : 'Seller cancels'}</span><span className="text-lg font-bold">{seller.performance ? `${seller.performance.cancelRate}%` : '—'}</span></p>
              <p><span className="block text-xs text-text-muted">{isAr ? 'شحن متأخر' : 'Late shipping'}</span><span className="text-lg font-bold">{seller.performance ? `${seller.performance.lateShipRate}%` : '—'}</span></p>
            </div>
            {Object.entries(seller.listings || {}).some(([k, n]) => k !== 'approved' && n > 0) && (
              <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3 text-xs">
                {Object.entries(seller.listings).filter(([k, n]) => k !== 'approved' && n > 0).map(([k, n]) => (
                  <span key={k} className="rounded-full bg-slate-100 px-2.5 py-1">{label(LISTING_STATUS, k, isAr)}: <strong>{n}</strong></span>
                ))}
              </div>
            )}
          </Card>

          {deal && !deal.error && <SellerDealCard deal={deal} isAr={isAr} onEdit={canWrite ? () => setTab('rules') : undefined} />}

          {editingProfile ? (
            <Card title={isAr ? 'تعديل بيانات المتجر' : 'Edit store details'}>
              <SellerProfileEditor
                seller={seller}
                isAr={isAr}
                isSuperAdmin={isSuperAdmin}
                onCancel={() => setEditingProfile(false)}
                onSaved={({ keepEditing } = {}) => { if (!keepEditing) setEditingProfile(false); refresh(); }}
              />
            </Card>
          ) : (
          <Card
            title={isAr ? 'البيانات' : 'Details'}
            action={canWrite && <button type="button" onClick={() => setEditingProfile(true)} className="text-xs font-semibold text-primary-700 hover:underline">{isAr ? 'تعديل' : 'Edit'}</button>}
          >
            <Row k={isAr ? 'المسؤول' : 'Contact'} v={seller.contactName} />
            <Row k={isAr ? 'البريد' : 'Email'} v={seller.email} ltr />
            <Row k={isAr ? 'الهاتف' : 'Phone'} v={seller.phone} ltr />
            <Row k={isAr ? 'العنوان' : 'Address'} v={[seller.address?.street, seller.address?.city, seller.address?.governorate].filter(Boolean).join('، ')} />
            <Row k={isAr ? 'الاسم القانوني' : 'Legal name'} v={seller.legalName} />
            <Row k={isAr ? 'السجل التجاري' : 'Commercial register'} v={seller.commercialRegisterNo} ltr />
            <Row k={isAr ? 'الرقم الضريبي' : 'Tax ID'} v={seller.taxId} ltr />
            <Row k={isAr ? 'تاريخ الطلب' : 'Applied'} v={seller.createdAt && fmtDate(seller.createdAt, isAr)} />
            <Row k={isAr ? 'تاريخ الاعتماد' : 'Approved'} v={seller.approvedAt && fmtDate(seller.approvedAt, isAr)} />
            {(seller.intendedCategories || []).length > 0 && (
              <Row k={isAr ? 'الأقسام المطلوبة' : 'Wants to sell'} v={seller.intendedCategories.map((c) => (isAr ? c.nameAr : c.nameEn)).join('، ')} />
            )}
            {seller.applicationNote && <p className="mt-2 rounded-xl bg-slate-50 p-3 text-sm">{seller.applicationNote}</p>}
          </Card>
          )}

          <SellerReviewsCard sellerId={seller._id} isAr={isAr} canWrite={canWrite} />

          {(seller.statusHistory || []).length > 0 && (
            <details className="group rounded-2xl border border-border bg-white p-4">
              <summary className="cursor-pointer list-none font-bold marker:hidden">
                {isAr ? 'سجل الحالة' : 'Status history'}
                <span className="ms-2 text-xs font-normal text-text-muted">({seller.statusHistory.length})</span>
              </summary>
              <ol className="relative mt-3 space-y-4 border-s border-border ps-4">
                {[...seller.statusHistory].reverse().map((h, i) => (
                  <li key={i} className="relative">
                    <span className="absolute -start-[1.4rem] top-1 h-2.5 w-2.5 rounded-full bg-primary-500 ring-4 ring-white" />
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge map={SELLER_STATUS} value={h.status} isAr={isAr} />
                      <span className="text-xs text-text-muted">{fmtDate(h.changedAt, isAr)}</span>
                      <span className="text-xs text-text-muted">· {h.changedBy?.name || (isAr ? 'البائع / النظام' : 'Seller / system')}</span>
                    </div>
                    {h.reason && <p className="mt-1 text-sm">{h.reason}</p>}
                  </li>
                ))}
              </ol>
            </details>
          )}

          <SellerHistoryCard sellerId={seller._id} isAr={isAr} lookup={lookup} refreshKey={historyKey} />
        </div>
      )}

      {tab === 'documents' && (
        <Card title={isAr ? 'المستندات' : 'Documents'}>
          {!(seller.documents || []).length ? (
            <p className="text-sm text-text-muted">{isAr ? 'لم يرفع البائع مستندات بعد. يرفعها من «بيانات المتجر» في مركز البائعين.' : 'No documents yet. Sellers upload them from Store profile in Seller Center.'}</p>
          ) : (
            <ul className="space-y-2">
              {seller.documents.map((d) => (
                <li key={d._id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-2 text-sm">
                  <a href={d.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-primary-700">
                    <img src={d.url} alt="" className="h-12 w-12 rounded-lg border border-border object-cover" />
                    <span>
                      <span className="block font-medium">{label(DOCUMENT_TYPES, d.type, isAr)}</span>
                      {d.note && <span className="block text-xs text-text-muted">{d.note}</span>}
                    </span>
                  </a>
                  <div className="flex items-center gap-1.5">
                    <StatusBadge map={DOCUMENT_STATUS} value={d.status} isAr={isAr} />
                    {canWrite && d.status !== 'accepted' && <button type="button" onClick={() => reviewDoc(d._id, 'accepted')} className="rounded-lg px-2 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-50">{isAr ? 'قبول' : 'Accept'}</button>}
                    {canWrite && d.status !== 'rejected' && <button type="button" onClick={() => setDocReject({ id: d._id, note: '' })} className="rounded-lg px-2 py-1 text-xs font-semibold text-red-700 ring-1 ring-red-200 hover:bg-red-50">{isAr ? 'رفض' : 'Reject'}</button>}
                  </div>
                  {docReject?.id === d._id && (
                    <form
                      className="flex w-full gap-2"
                      onSubmit={(e) => { e.preventDefault(); if (docReject.note.trim()) reviewDoc(d._id, 'rejected', docReject.note.trim()); }}
                    >
                      <input
                        autoFocus
                        className={inputCls}
                        maxLength={500}
                        value={docReject.note}
                        placeholder={isAr ? 'سبب الرفض — يظهر للبائع (مثلاً: الصورة غير واضحة)' : 'Why? The seller sees this (e.g. photo is blurry)'}
                        onChange={(e) => setDocReject({ id: d._id, note: e.target.value })}
                      />
                      <Button type="submit" size="sm" variant="danger" disabled={!docReject.note.trim()}>{isAr ? 'رفض' : 'Reject'}</Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => setDocReject(null)}>{isAr ? 'إلغاء' : 'Cancel'}</Button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === 'rules' && (
        <div className="space-y-4 pb-16">
          <ScheduledDealsCard sellerId={seller._id} scheduled={deal?.scheduled || []} isAr={isAr} canWrite={canWrite} lookup={lookup} onChanged={refresh} />
          <Card title={isAr ? 'العمولة' : 'Commission'} action={<Link to="/admin/seller-fees" className="text-xs font-semibold text-primary-700 hover:underline">{isAr ? 'الرسوم العامة' : 'Standard fees'}</Link>}>
            <div className="mb-3 grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block font-medium">{isAr ? 'الباقة' : 'Plan'}</span>
                <select className={inputCls} value={form.feePlan} onChange={(e) => setForm((f) => ({ ...f, feePlan: e.target.value }))} disabled={!canWrite}>
                  <option value="">{(() => { const d = plans.find((p) => p.isDefault); return d ? `${isAr ? 'الافتراضية' : 'Default'} (${isAr ? d.nameAr || d.nameEn : d.nameEn || d.nameAr})` : (isAr ? 'بدون باقة (الرسوم العامة)' : 'No plan (standard fees)'); })()}</option>
                  {plans.map((p) => <option key={p.key} value={p.key}>{isAr ? p.nameAr || p.nameEn : p.nameEn || p.nameAr}{p.monthlyFee ? ` · ${money(p.monthlyFee, isAr)}/${isAr ? 'شهر' : 'mo'}` : ''}</option>)}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">{isAr ? 'نسبة عمولة خاصة %' : 'Negotiated commission %'}</span>
                <input type="number" min="0" max="100" step="0.5" className={inputCls} value={form.commissionRate} placeholder={isAr ? 'فارغ = حسب القسم/الباقة' : 'Empty = category / plan rate'} onChange={(e) => setForm((f) => ({ ...f, commissionRate: e.target.value }))} disabled={!canWrite} />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block font-medium">{isAr ? 'بدون عمولة حتى (عرض ترحيبي)' : 'No commission until (welcome offer)'}</span>
                <input type="date" className={inputCls} value={form.feeOverrides.commissionFreeUntil} onChange={(e) => setOverride('commissionFreeUntil', e.target.value)} disabled={!canWrite} />
              </label>
            </div>
            <p className="mb-2 text-sm font-medium">{isAr ? 'عمولة خاصة لأقسام معينة' : 'Category-specific commission'}</p>
            {form.categoryCommissions.map((r, i) => (
              <div key={i} className="mb-2 flex gap-2">
                <select className={inputCls} value={r.category} onChange={(e) => setRule(i, 'category', e.target.value)} disabled={!canWrite}>
                  <option value="">{isAr ? 'اختر قسماً' : 'Choose a category'}</option>
                  {catOptions.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                <input type="number" min="0" max="100" className={`${inputCls} w-24`} value={r.rate} onChange={(e) => setRule(i, 'rate', e.target.value)} disabled={!canWrite} aria-label="%" />
                {canWrite && <button type="button" onClick={() => setForm((f) => ({ ...f, categoryCommissions: f.categoryCommissions.filter((_, idx) => idx !== i) }))} className="px-2 text-red-600" aria-label={isAr ? 'حذف' : 'Remove'}>×</button>}
              </div>
            ))}
            {canWrite && (
              <button type="button" onClick={() => setForm((f) => ({ ...f, categoryCommissions: [...f.categoryCommissions, { category: '', rate: '' }] }))} className="text-sm font-semibold text-primary-700">
                + {isAr ? 'إضافة قسم' : 'Add category'}
              </button>
            )}
          </Card>

          <Card title={isAr ? 'شروط خاصة بهذا البائع' : 'This seller’s deal'}>
            <p className="mb-3 text-xs text-text-muted">{isAr ? 'اترك الخانة فارغة لتأخذ قيمة الباقة أو الرسوم العامة.' : 'Leave a field empty to use the plan or standard value.'}</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                ['fixedFeePerItem', 'رسوم لكل قطعة', 'Fee per item'],
                ['fixedFeePerShipment', 'رسوم لكل شحنة', 'Fee per shipment'],
                ['minCommissionPerItem', 'أقل عمولة للقطعة', 'Min commission / item'],
                ['maxCommissionPerItem', 'أقصى عمولة للقطعة', 'Max commission / item'],
                ['storeFulfillmentFeePerItem', 'رسوم الشحن من مخزنك', 'Fulfillment fee / item'],
                ['monthlyFee', 'اشتراك شهري', 'Monthly fee'],
                ['payoutHoldDays', 'أيام الانتظار قبل التحويل', 'Hold before payout (days)'],
              ].map(([k, ar, en]) => (
                <label key={k} className="block text-sm">
                  <span className="mb-1 block text-xs font-medium">{isAr ? ar : en}</span>
                  <input type="number" min="0" step={k === 'payoutHoldDays' ? 1 : 0.5} className={inputCls} value={form.feeOverrides[k]} placeholder={isAr ? 'تلقائي' : 'Auto'} onChange={(e) => setOverride(k, e.target.value)} disabled={!canWrite} dir="ltr" />
                </label>
              ))}
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium">{isAr ? 'التحويل التلقائي' : 'Automatic payouts'}</span>
                <select className={inputCls} value={form.feeOverrides.payoutFrequency} onChange={(e) => setOverride('payoutFrequency', e.target.value)} disabled={!canWrite}>
                  <option value="">{isAr ? 'حسب الإعداد العام' : 'Marketplace schedule'}</option>
                  <option value="manual">{isAr ? 'يدوياً فقط' : 'Manual only'}</option>
                  <option value="weekly">{isAr ? 'أسبوعياً' : 'Weekly'}</option>
                  <option value="biweekly">{isAr ? 'كل أسبوعين' : 'Every two weeks'}</option>
                  <option value="monthly">{isAr ? 'شهرياً' : 'Monthly'}</option>
                </select>
              </label>
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.feeOverrides.vatExempt} onChange={(e) => setOverride('vatExempt', e.target.checked)} disabled={!canWrite} />
              {isAr ? 'معفى من ضريبة القيمة المضافة على الرسوم' : 'Exempt from VAT on fees'}
            </label>
          </Card>

          <FeeCalculator
            compact
            sellerId={sellerId}
            seller={{
              commissionRate: form.commissionRate === '' ? null : Number(form.commissionRate),
              categoryCommissions: form.categoryCommissions.filter((r) => r.category && r.rate !== '').map((r) => ({ category: r.category, rate: Number(r.rate) })),
              feePlan: form.feePlan,
              feeOverrides: overridesPayload(form.feeOverrides),
            }}
            categories={catOptions}
            isAr={isAr}
          />

          <SellerHistoryCard
            sellerId={seller._id}
            isAr={isAr}
            onlyDeal
            lookup={lookup}
            refreshKey={historyKey}
            title={isAr ? 'سجل تغييرات العمولة والرسوم' : 'Commission & fee history'}
          />

          <Card title={isAr ? 'التشغيل' : 'Operations'}>
            <p className="mb-2 text-sm font-medium">{isAr ? 'من يشحن الطلبات؟' : 'Who ships orders?'}</p>
            <div className="mb-4 flex flex-wrap gap-3">
              {['seller', 'store'].map((mode) => (
                <label key={mode} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.allowedFulfillment.includes(mode)} onChange={() => toggleMode(mode)} disabled={!canWrite} />
                  {label(FULFILLMENT, mode, isAr)}
                </label>
              ))}
            </div>
            {form.allowedFulfillment.length > 1 && (
              <label className="mb-4 block text-sm">
                <span className="mb-1 block font-medium">{isAr ? 'الخيار الافتراضي للمنتجات الجديدة' : 'Default for new products'}</span>
                <select className={`${inputCls} sm:w-64`} value={form.defaultFulfillment} onChange={(e) => setForm((f) => ({ ...f, defaultFulfillment: e.target.value }))} disabled={!canWrite}>
                  {form.allowedFulfillment.map((m) => <option key={m} value={m}>{label(FULFILLMENT, m, isAr)}</option>)}
                </select>
              </label>
            )}
            {seller.vacation?.enabled && (
              <div className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-medium">
                  {isAr ? 'البائع في إجازة — منتجاته مخفية' : 'Seller is on vacation — products are hidden'}
                  {seller.vacation.until && ` (${isAr ? 'حتى' : 'until'} ${fmtDate(seller.vacation.until, isAr)})`}
                </p>
                {canWrite && (
                  <label className="mt-2 flex items-center gap-2">
                    <input type="checkbox" checked={form.vacationOff} onChange={(e) => setForm((f) => ({ ...f, vacationOff: e.target.checked }))} />
                    {isAr ? 'إنهاء الإجازة وإظهار المنتجات عند الحفظ' : 'End the vacation and show products on save'}
                  </label>
                )}
              </div>
            )}
            {form.allowedFulfillment.includes('seller') && zones.length > 0 && (
              <div className="mb-4">
                <p className="mb-1 text-sm font-medium">{isAr ? 'المناطق التي يشحن إليها البائع بنفسه' : 'Zones the seller ships to itself'}</p>
                <p className="mb-2 text-xs text-text-muted">{isAr ? 'بدون اختيار = كل المناطق النشطة.' : 'None selected = every active zone.'}</p>
                <div className="flex flex-wrap gap-2">
                  {zones.map((z) => {
                    const on = form.deliveryZones.includes(String(z._id));
                    return (
                      <button
                        key={z._id}
                        type="button"
                        disabled={!canWrite}
                        onClick={() => setForm((f) => ({ ...f, deliveryZones: on ? f.deliveryZones.filter((id) => id !== String(z._id)) : [...f.deliveryZones, String(z._id)] }))}
                        className={`rounded-full border px-3 py-1 text-xs ${on ? 'border-primary-500 bg-primary-50 font-semibold text-primary-800' : 'border-border text-text-muted'}`}
                      >
                        {isAr ? [z.cityAr, z.areaAr].filter(Boolean).join(' — ') : [z.cityEn, z.areaEn].filter(Boolean).join(' — ')}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <label className="mb-4 block text-sm">
              <span className="mb-1 block font-medium">{isAr ? 'مدة تجهيز الطلب (أيام)' : 'Handling time (days)'}</span>
              <input type="number" min="0" max="30" className={`${inputCls} w-28`} value={form.handlingDays} onChange={(e) => setForm((f) => ({ ...f, handlingDays: e.target.value }))} disabled={!canWrite} />
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={form.autoApproveListings} onChange={(e) => setForm((f) => ({ ...f, autoApproveListings: e.target.checked }))} disabled={!canWrite} />
              <span>
                <span className="block font-medium">{isAr ? 'بائع موثوق' : 'Trusted seller'}</span>
                <span className="block text-xs text-text-muted">{isAr ? 'تُنشر منتجاته الجديدة دون مراجعة.' : 'New products go live without review.'}</span>
              </span>
            </label>
          </Card>

          <Card title={isAr ? 'ملاحظات داخلية' : 'Internal notes'}>
            <textarea rows={3} className={inputCls} value={form.internalNote} placeholder={isAr ? 'لا يراها البائع' : 'Not visible to the seller'} onChange={(e) => setForm((f) => ({ ...f, internalNote: e.target.value }))} disabled={!canWrite} />
          </Card>

          {canWrite && (
            <div className="sticky bottom-0 -mx-5 flex items-center justify-between gap-3 border-t border-border bg-white/95 px-5 py-3 backdrop-blur">
              <div className="min-w-0 space-y-1.5">
                <p className="text-xs text-text-muted">{dirty ? (isAr ? 'لديك تغييرات غير محفوظة' : 'You have unsaved changes') : (isAr ? 'لا توجد تغييرات' : 'No changes')}</p>
                {dirty && (
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-medium">{isAr ? 'تطبيق العمولة والرسوم:' : 'Apply commission & fees:'}</span>
                    <select className="rounded-lg border border-border px-2 py-1" value={applyMode.when} onChange={(e) => setApplyMode((m) => ({ ...m, when: e.target.value }))}>
                      <option value="now">{isAr ? 'الآن' : 'Now'}</option>
                      <option value="date">{isAr ? 'من تاريخ…' : 'From a date…'}</option>
                    </select>
                    {applyMode.when === 'date' && (
                      <>
                        <input type="date" min={minScheduleDate} className="rounded-lg border border-border px-2 py-1" value={applyMode.date} onChange={(e) => setApplyMode((m) => ({ ...m, date: e.target.value }))} />
                        <input className="w-40 rounded-lg border border-border px-2 py-1" placeholder={isAr ? 'ملاحظة (اختياري)' : 'Note (optional)'} value={applyMode.note} onChange={(e) => setApplyMode((m) => ({ ...m, note: e.target.value }))} />
                      </>
                    )}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                {dirty && <Button size="sm" variant="outline" onClick={() => setForm(initialForm)}>{isAr ? 'تراجع' : 'Discard'}</Button>}
                <Button size="sm" disabled={saving || !dirty} onClick={save}>{saving ? (isAr ? 'جارٍ الحفظ…' : 'Saving…') : (isAr ? 'حفظ' : 'Save')}</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'payouts' && (
        <div className="space-y-4">
          {canSeeMoney && (
            <Card title={isAr ? 'الرصيد' : 'Balance'} action={<Link to="/admin/seller-payouts" className="text-xs font-semibold text-primary-700 hover:underline">{isAr ? 'صفحة المستحقات' : 'Payouts page'}</Link>}>
              {!balance ? <Loader size="sm" /> : (
                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                  <p><span className="block text-xs text-text-muted">{isAr ? 'مستحق الآن' : 'Due now'}</span><span className="font-bold">{money(balance.available, isAr)}</span></p>
                  <p><span className="block text-xs text-text-muted">{isAr ? 'في فترة الانتظار' : 'On hold'}</span><span className="font-bold">{money(balance.pending, isAr)}</span></p>
                  <p><span className="block text-xs text-text-muted">{isAr ? 'تم تحويله' : 'Paid out'}</span><span className="font-bold">{money(Math.abs(balance.paidOut || 0), isAr)}</span></p>
                </div>
              )}
            </Card>
          )}
          {canSeeMoney && (
            <Card title={isAr ? 'ربحك من هذا البائع' : 'Your profit from this seller'} action={<Link to="/admin/seller-profit" className="text-xs font-semibold text-primary-700 hover:underline">{isAr ? 'تقرير الأرباح' : 'Profit report'}</Link>}>
              {!profit ? <Loader size="sm" /> : !profit.all ? <p className="text-sm text-text-muted">{isAr ? 'تعذّر التحميل' : 'Could not load'}</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-text-muted"><tr><th className="py-1 text-start" /><th className="py-1 text-end">{isAr ? 'آخر ٣٠ يوماً' : 'Last 30 days'}</th><th className="py-1 text-end">{isAr ? 'منذ البداية' : 'All time'}</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {[
                        ['netSales', 'صافي المبيعات', 'Net sales'],
                        ['commission', 'العمولة', 'Commission'],
                        ['feeIncome', 'كل الرسوم', 'All fees'],
                        ['discountCost', 'خصومات دفعتها', 'Discounts you paid'],
                        ['netProfit', 'صافي ربحك', 'Net profit'],
                      ].map(([k, ar, en]) => (
                        <tr key={k} className={k === 'netProfit' ? 'font-bold' : ''}>
                          <td className="py-1.5">{isAr ? ar : en}</td>
                          <td className="py-1.5 text-end tabular-nums">{money(profit.recent?.[k], isAr)}</td>
                          <td className="py-1.5 text-end tabular-nums">{money(profit.all[k], isAr)}</td>
                        </tr>
                      ))}
                      <tr className="text-text-muted"><td className="py-1.5">{isAr ? 'نسبتك الفعلية' : 'Effective take rate'}</td><td className="py-1.5 text-end">{profit.recent?.takeRate ?? 0}%</td><td className="py-1.5 text-end">{profit.all.takeRate}%</td></tr>
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
          {canWrite && canSeeMoney && (
            <SellerPenaltyForm sellerId={sellerId} isAr={isAr} onCharged={(b) => { setBalance(b); setProfit(null); }} />
          )}
          <Card title={isAr ? 'بيانات استلام الأموال' : 'Payout details'}>
            <Row k={isAr ? 'البنك' : 'Bank'} v={seller.bank?.bankName} />
            <Row k={isAr ? 'صاحب الحساب' : 'Holder'} v={seller.bank?.accountName} />
            <Row k={isAr ? 'رقم الحساب' : 'Account'} v={seller.bank?.accountNumber} ltr />
            <Row k="IBAN" v={seller.bank?.iban} ltr />
            <Row k={isAr ? 'محفظة' : 'Wallet'} v={seller.bank?.walletPhone} ltr />
            {!(seller.bank?.accountNumber || seller.bank?.iban || seller.bank?.walletPhone) && (
              <p className="mt-2 text-xs text-amber-700">{isAr ? 'لم يضف البائع بيانات الدفع بعد — لن تستطيع تحويل مستحقاته.' : 'No payout details yet — you cannot pay this seller until they add them.'}</p>
            )}
          </Card>
        </div>
      )}

      {tab === 'logins' && <SellerAccessSection seller={seller} isAr={isAr} canWrite={canWrite} onTeamChange={(team) => setSeller((s) => ({ ...s, team }))} />}

      {reasonFor && (
      <SellerReasonDialog
        key={reasonFor}
        open
        status={reasonFor}
        sellerName={name}
        isAr={isAr}
        busy={busy}
        onCancel={() => setReasonFor('')}
        onConfirm={(reason) => changeStatus(reasonFor, reason)}
      />
      )}
    </div>
  );
}

function SellerReviewsCard({ sellerId, isAr, canWrite }) {
  const toast = useToast();
  const [reviews, setReviews] = useState(null);
  const load = useCallback(() => {
    adminApi.listSellerReviews({ seller: sellerId, limit: 20 }).then(({ data }) => setReviews(data.data || [])).catch(() => setReviews([]));
  }, [sellerId]);
  useEffect(() => { load(); }, [load]);
  if (!reviews?.length) return null;
  const toggle = async (r) => {
    try {
      await adminApi.setSellerReviewStatus(r._id, r.status === 'visible' ? 'hidden' : 'visible');
      load();
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر التحديث' : 'Update failed'));
    }
  };
  return (
    <Card title={isAr ? 'تقييمات العملاء' : 'Customer reviews'}>
      <ul className="space-y-2">
        {reviews.map((r) => (
          <li key={r._id} className={`flex items-start justify-between gap-3 rounded-xl border border-border p-2 text-sm ${r.status === 'hidden' ? 'opacity-60' : ''}`}>
            <div>
              <span className="font-semibold text-amber-600">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
              <span className="ms-2 text-xs text-text-muted">{r.userName}</span>
              {r.comment && <p className="mt-1">{r.comment}</p>}
            </div>
            {canWrite && (
              <button type="button" onClick={() => toggle(r)} className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold ring-1 ring-border">
                {r.status === 'visible' ? (isAr ? 'إخفاء' : 'Hide') : (isAr ? 'إظهار' : 'Show')}
              </button>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
