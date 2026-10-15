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
    handlingDays: String(s.handlingDays ?? 2),
    internalNote: s.internalNote || '',
  };
}

const TABS = [
  { id: 'overview', ar: 'نظرة عامة', en: 'Overview' },
  { id: 'documents', ar: 'المستندات', en: 'Documents' },
  { id: 'rules', ar: 'العمولة والقواعد', en: 'Commission & rules' },
  { id: 'payouts', ar: 'المدفوعات', en: 'Payouts' },
  { id: 'logins', ar: 'الدخول', en: 'Logins' },
  { id: 'history', ar: 'السجل', en: 'History' },
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

export default function SellerDetailPanel({ sellerId, isAr, canWrite, canSeeMoney, onChanged, onDirtyChange }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [seller, setSeller] = useState(null);
  const [form, setForm] = useState(null);
  const [initialForm, setInitialForm] = useState(null);
  const [categories, setCategories] = useState([]);
  const [balance, setBalance] = useState(null);
  const [tab, setTab] = useState('overview');
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reasonFor, setReasonFor] = useState('');
  const [docReject, setDocReject] = useState(null); // { id, note } while typing a rejection note

  const load = useCallback(() => adminApi.getSeller(sellerId)
    .then(({ data }) => {
      const s = data.data;
      setSeller(s);
      const f = formFromSeller(s);
      setForm(f);
      setInitialForm(f);
    })
    .catch(() => toast.error(isAr ? 'تعذّر تحميل البائع' : 'Could not load seller')), [sellerId, isAr, toast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    categoryService.getAll().then(({ data }) => setCategories(data.data || [])).catch(() => {});
  }, []);
  useEffect(() => {
    if (tab !== 'payouts' || !canSeeMoney || balance) return;
    adminApi.getSellerLedger(sellerId, { limit: 1 }).then(({ data }) => setBalance(data.balance || {})).catch(() => setBalance({}));
  }, [tab, canSeeMoney, sellerId, balance]);

  const dirty = useMemo(() => Boolean(form && initialForm && JSON.stringify(form) !== JSON.stringify(initialForm)), [form, initialForm]);
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  const refresh = () => { load(); onChanged(); };

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
      await adminApi.updateSeller(sellerId, {
        commissionRate: form.commissionRate === '' ? null : Number(form.commissionRate),
        categoryCommissions: form.categoryCommissions.filter((r) => r.category && r.rate !== '').map((r) => ({ category: r.category, rate: Number(r.rate) })),
        allowedFulfillment: form.allowedFulfillment,
        autoApproveListings: form.autoApproveListings,
        handlingDays: Number(form.handlingDays),
        internalNote: form.internalNote,
      });
      toast.success(isAr ? 'تم الحفظ' : 'Saved');
      refresh();
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر الحفظ' : 'Save failed'));
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
  const roots = categories.filter((c) => !c.parentCategory);
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
          <Card title={isAr ? 'البيانات' : 'Details'}>
            <Row k={isAr ? 'المسؤول' : 'Contact'} v={seller.contactName} />
            <Row k={isAr ? 'البريد' : 'Email'} v={seller.email} ltr />
            <Row k={isAr ? 'الهاتف' : 'Phone'} v={seller.phone} ltr />
            <Row k={isAr ? 'العنوان' : 'Address'} v={[seller.address?.street, seller.address?.city, seller.address?.governorate].filter(Boolean).join('، ')} />
            <Row k={isAr ? 'الاسم القانوني' : 'Legal name'} v={seller.legalName} />
            <Row k={isAr ? 'السجل التجاري' : 'Commercial register'} v={seller.commercialRegisterNo} ltr />
            <Row k={isAr ? 'الرقم الضريبي' : 'Tax ID'} v={seller.taxId} ltr />
            <Row k={isAr ? 'تاريخ الطلب' : 'Applied'} v={fmtDate(seller.createdAt, isAr)} />
            <Row k={isAr ? 'تاريخ الاعتماد' : 'Approved'} v={fmtDate(seller.approvedAt, isAr)} />
            {(seller.intendedCategories || []).length > 0 && (
              <Row k={isAr ? 'الأقسام المطلوبة' : 'Wants to sell'} v={seller.intendedCategories.map((c) => (isAr ? c.nameAr : c.nameEn)).join('، ')} />
            )}
            {seller.applicationNote && <p className="mt-2 rounded-xl bg-slate-50 p-3 text-sm">{seller.applicationNote}</p>}
          </Card>

          <Card title={isAr ? 'المنتجات' : 'Products'}>
            {Object.keys(seller.listings || {}).length ? (
              <div className="flex flex-wrap gap-2 text-xs">
                {Object.entries(seller.listings).map(([k, n]) => (
                  <span key={k} className="rounded-full bg-slate-100 px-2.5 py-1">{label(LISTING_STATUS, k, isAr)}: <strong>{n}</strong></span>
                ))}
              </div>
            ) : <p className="text-sm text-text-muted">{isAr ? 'لم يضف البائع منتجات بعد.' : 'No products yet.'}</p>}
          </Card>

          {seller.performance && (
            <Card title={isAr ? `الأداء (آخر ${seller.performance.days} يوماً)` : `Performance (last ${seller.performance.days} days)`}>
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <p><span className="block text-xs text-text-muted">{isAr ? 'الشحنات' : 'Parcels'}</span><span className="font-bold">{seller.performance.shipments}</span></p>
                <p><span className="block text-xs text-text-muted">{isAr ? 'التقييم' : 'Rating'}</span><span className="font-bold">{seller.performance.ratingCount ? `${seller.performance.rating} ★ (${seller.performance.ratingCount})` : '—'}</span></p>
                <p><span className="block text-xs text-text-muted">{isAr ? 'إلغاء من البائع' : 'Seller cancels'}</span><span className="font-bold">{seller.performance.cancelRate}%</span></p>
                <p><span className="block text-xs text-text-muted">{isAr ? 'شحن متأخر' : 'Late shipping'}</span><span className="font-bold">{seller.performance.lateShipRate}%</span></p>
              </div>
            </Card>
          )}

          <SellerReviewsCard sellerId={seller._id} isAr={isAr} canWrite={canWrite} />
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
          <Card title={isAr ? 'العمولة' : 'Commission'}>
            <label className="mb-3 block text-sm">
              <span className="mb-1 block font-medium">{isAr ? 'نسبة العمولة %' : 'Commission %'}</span>
              <input type="number" min="0" max="100" step="0.5" className={inputCls} value={form.commissionRate} placeholder={isAr ? 'فارغ = النسبة العامة' : 'Empty = marketplace default'} onChange={(e) => setForm((f) => ({ ...f, commissionRate: e.target.value }))} disabled={!canWrite} />
            </label>
            <p className="mb-2 text-sm font-medium">{isAr ? 'عمولة خاصة لأقسام معينة' : 'Category-specific commission'}</p>
            {form.categoryCommissions.map((r, i) => (
              <div key={i} className="mb-2 flex gap-2">
                <select className={inputCls} value={r.category} onChange={(e) => setRule(i, 'category', e.target.value)} disabled={!canWrite}>
                  <option value="">{isAr ? 'اختر قسماً' : 'Choose a category'}</option>
                  {roots.map((c) => <option key={c._id} value={c._id}>{isAr ? c.nameAr : c.nameEn}</option>)}
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
              <p className="text-xs text-text-muted">{dirty ? (isAr ? 'لديك تغييرات غير محفوظة' : 'You have unsaved changes') : (isAr ? 'لا توجد تغييرات' : 'No changes')}</p>
              <div className="flex gap-2">
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

      {tab === 'logins' && <SellerAccessSection seller={seller} isAr={isAr} canWrite={canWrite} />}

      {tab === 'history' && (
        <Card title={isAr ? 'سجل الحالة' : 'Status history'}>
          {!(seller.statusHistory || []).length ? <p className="text-sm text-text-muted">—</p> : (
            <ol className="relative space-y-4 border-s border-border ps-4">
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
          )}
        </Card>
      )}

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
