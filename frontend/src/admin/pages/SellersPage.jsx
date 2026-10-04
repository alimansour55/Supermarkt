import { useCallback, useEffect, useState } from 'react';
import { Link } from '../../app/router';
import { Ban, CheckCircle2, ExternalLink, Plus, RotateCcw, Search, XCircle } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { adminApi } from '../adminApi';
import { categoryService } from '../../services/apiServices';
import Button from '../../components/ui/Button';
import Loader from '../../components/ui/Loader';
import AdminSlidePanel from '../components/AdminSlidePanel';
import { PageHeader, Pagination, useToast } from '../components';
import { useAdminStats } from '../context/AdminStatsContext';
import { hasPermission } from '../adminPermissions';
import { DOCUMENT_STATUS, DOCUMENT_TYPES, FULFILLMENT, LISTING_STATUS, SELLER_STATUS, apiError, label } from '../../seller/sellerLabels';
import StatusBadge from '../../seller/StatusBadge';

const TABS = ['', 'applied', 'under_review', 'active', 'suspended', 'rejected'];
const inputCls = 'w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100';

function fmtDate(value, isAr) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(isAr ? 'ar-EG' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function Row({ k, v }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-text-muted">{k}</span>
      <span className="text-end font-medium" dir="auto">{v || '—'}</span>
    </div>
  );
}

function StatusActions({ seller, isAr, onChanged, canWrite }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (!canWrite) return null;

  const change = async (status, needsReason) => {
    let reason = '';
    if (needsReason) {
      reason = window.prompt(isAr ? 'اكتب السبب (يظهر للبائع):' : 'Reason (shown to the seller):') || '';
      if (!reason.trim()) return;
    }
    setBusy(true);
    try {
      await adminApi.setSellerStatus(seller._id, { status, reason });
      toast.success(isAr ? 'تم تحديث الحالة' : 'Status updated');
      onChanged();
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر التحديث' : 'Update failed'));
    } finally {
      setBusy(false);
    }
  };

  const s = seller.status;
  return (
    <div className="flex flex-wrap gap-2">
      {['applied', 'under_review', 'rejected'].includes(s) && (
        <Button size="sm" disabled={busy} onClick={() => change('active')}><CheckCircle2 className="h-4 w-4" />{isAr ? 'اعتماد وتفعيل' : 'Approve & activate'}</Button>
      )}
      {['applied', 'under_review'].includes(s) && (
        <Button size="sm" variant="danger" disabled={busy} onClick={() => change('rejected', true)}><XCircle className="h-4 w-4" />{isAr ? 'رفض' : 'Reject'}</Button>
      )}
      {s === 'applied' && (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => change('under_review')}>{isAr ? 'بدء المراجعة' : 'Start review'}</Button>
      )}
      {s === 'active' && (
        <Button size="sm" variant="danger" disabled={busy} onClick={() => change('suspended', true)}><Ban className="h-4 w-4" />{isAr ? 'إيقاف المتجر' : 'Suspend'}</Button>
      )}
      {s === 'suspended' && (
        <Button size="sm" disabled={busy} onClick={() => change('active')}><RotateCcw className="h-4 w-4" />{isAr ? 'إعادة التفعيل' : 'Reactivate'}</Button>
      )}
    </div>
  );
}

function SellerDetail({ sellerId, isAr, onChanged, canWrite }) {
  const toast = useToast();
  const [seller, setSeller] = useState(null);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    adminApi.getSeller(sellerId)
      .then(({ data }) => {
        const s = data.data;
        setSeller(s);
        setForm({
          commissionRate: s.commissionRate ?? '',
          categoryCommissions: (s.categoryCommissions || []).map((r) => ({ category: String(r.category?._id || r.category), rate: String(r.rate) })),
          allowedFulfillment: s.allowedFulfillment || ['seller'],
          autoApproveListings: s.autoApproveListings,
          handlingDays: String(s.handlingDays ?? 2),
          internalNote: s.internalNote || '',
        });
      })
      .catch(() => toast.error(isAr ? 'تعذّر تحميل البائع' : 'Could not load seller'));
  }, [sellerId, isAr, toast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    categoryService.getAll().then(({ data }) => setCategories(data.data || [])).catch(() => {});
  }, []);

  const refresh = () => { load(); onChanged(); };

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

  const reviewDoc = async (docId, status) => {
    let note = '';
    if (status === 'rejected') {
      note = window.prompt(isAr ? 'سبب رفض المستند:' : 'Why is this document rejected?') || '';
      if (!note.trim()) return;
    }
    try {
      await adminApi.reviewSellerDocument(sellerId, docId, { status, note });
      load();
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر التحديث' : 'Update failed'));
    }
  };

  if (!seller || !form) return <div className="flex min-h-[200px] items-center justify-center"><Loader size="lg" /></div>;

  const toggleMode = (mode) => setForm((f) => ({
    ...f,
    allowedFulfillment: f.allowedFulfillment.includes(mode)
      ? f.allowedFulfillment.filter((m) => m !== mode)
      : [...f.allowedFulfillment, mode],
  }));
  const setRule = (i, key, value) => setForm((f) => ({ ...f, categoryCommissions: f.categoryCommissions.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)) }));
  const roots = categories.filter((c) => !c.parentCategory);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge map={SELLER_STATUS} value={seller.status} isAr={isAr} />
        {seller.status === 'active' && (
          <a href={`/${isAr ? 'ar' : 'en'}/sellers/${seller.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:underline">
            <ExternalLink className="h-3.5 w-3.5" />{isAr ? 'صفحة المتجر' : 'Store page'}
          </a>
        )}
        <Link to={`/admin/listing-review?seller=${seller._id}`} className="text-xs font-semibold text-primary-700 hover:underline">
          {isAr ? 'منتجات البائع' : 'Seller listings'}
        </Link>
      </div>
      {seller.statusReason && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{isAr ? 'السبب: ' : 'Reason: '}{seller.statusReason}</p>}
      <StatusActions seller={seller} isAr={isAr} onChanged={refresh} canWrite={canWrite} />

      <section className="rounded-2xl border border-border bg-white p-4">
        <h3 className="mb-2 font-bold">{isAr ? 'البيانات' : 'Details'}</h3>
        <Row k={isAr ? 'المسؤول' : 'Contact'} v={seller.contactName} />
        <Row k={isAr ? 'البريد' : 'Email'} v={seller.email} />
        <Row k={isAr ? 'الهاتف' : 'Phone'} v={seller.phone} />
        <Row k={isAr ? 'العنوان' : 'Address'} v={[seller.address?.street, seller.address?.city, seller.address?.governorate].filter(Boolean).join('، ')} />
        <Row k={isAr ? 'الاسم القانوني' : 'Legal name'} v={seller.legalName} />
        <Row k={isAr ? 'السجل التجاري' : 'Commercial register'} v={seller.commercialRegisterNo} />
        <Row k={isAr ? 'الرقم الضريبي' : 'Tax ID'} v={seller.taxId} />
        <Row k={isAr ? 'تاريخ الطلب' : 'Applied'} v={fmtDate(seller.createdAt, isAr)} />
        <Row k={isAr ? 'تاريخ الاعتماد' : 'Approved'} v={fmtDate(seller.approvedAt, isAr)} />
        {seller.applicationNote && <p className="mt-2 rounded-xl bg-slate-50 p-3 text-sm">{seller.applicationNote}</p>}
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {Object.entries(seller.listings || {}).map(([k, n]) => (
            <span key={k} className="rounded-full bg-slate-100 px-2.5 py-1">{label(LISTING_STATUS, k, isAr)}: {n}</span>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-white p-4">
        <h3 className="mb-2 font-bold">{isAr ? 'المستندات' : 'Documents'}</h3>
        {!(seller.documents || []).length ? (
          <p className="text-sm text-text-muted">{isAr ? 'لم يرفع البائع مستندات بعد.' : 'No documents uploaded yet.'}</p>
        ) : (
          <ul className="space-y-2">
            {seller.documents.map((d) => (
              <li key={d._id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-2 text-sm">
                <a href={d.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-primary-700">
                  <img src={d.url} alt="" className="h-10 w-10 rounded-lg object-cover" />
                  {label(DOCUMENT_TYPES, d.type, isAr)}
                </a>
                <div className="flex items-center gap-1.5">
                  <StatusBadge map={DOCUMENT_STATUS} value={d.status} isAr={isAr} />
                  {canWrite && d.status !== 'accepted' && <button type="button" onClick={() => reviewDoc(d._id, 'accepted')} className="rounded-lg px-2 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">{isAr ? 'قبول' : 'Accept'}</button>}
                  {canWrite && d.status !== 'rejected' && <button type="button" onClick={() => reviewDoc(d._id, 'rejected')} className="rounded-lg px-2 py-1 text-xs font-semibold text-red-700 ring-1 ring-red-200">{isAr ? 'رفض' : 'Reject'}</button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-white p-4">
        <h3 className="mb-3 font-bold">{isAr ? 'العمولة والتشغيل' : 'Commission & operations'}</h3>
        <label className="mb-3 block text-sm">
          <span className="mb-1 block font-medium">{isAr ? 'نسبة العمولة % (فارغ = الافتراضي العام)' : 'Commission % (empty = marketplace default)'}</span>
          <input type="number" min="0" max="100" step="0.5" className={inputCls} value={form.commissionRate} onChange={(e) => setForm((f) => ({ ...f, commissionRate: e.target.value }))} disabled={!canWrite} />
        </label>
        <p className="mb-2 text-sm font-medium">{isAr ? 'عمولة خاصة لأقسام معينة' : 'Category-specific commission'}</p>
        {form.categoryCommissions.map((r, i) => (
          <div key={i} className="mb-2 flex gap-2">
            <select className={inputCls} value={r.category} onChange={(e) => setRule(i, 'category', e.target.value)} disabled={!canWrite}>
              <option value="">{isAr ? 'اختر قسماً' : 'Choose a category'}</option>
              {roots.map((c) => <option key={c._id} value={c._id}>{isAr ? c.nameAr : c.nameEn}</option>)}
            </select>
            <input type="number" min="0" max="100" className={`${inputCls} w-24`} value={r.rate} onChange={(e) => setRule(i, 'rate', e.target.value)} disabled={!canWrite} />
            {canWrite && <button type="button" onClick={() => setForm((f) => ({ ...f, categoryCommissions: f.categoryCommissions.filter((_, idx) => idx !== i) }))} className="px-2 text-red-600">×</button>}
          </div>
        ))}
        {canWrite && (
          <button type="button" onClick={() => setForm((f) => ({ ...f, categoryCommissions: [...f.categoryCommissions, { category: '', rate: '' }] }))} className="mb-4 text-sm font-semibold text-primary-700">
            + {isAr ? 'إضافة قسم' : 'Add category'}
          </button>
        )}

        <p className="mb-2 text-sm font-medium">{isAr ? 'طرق الشحن المسموحة' : 'Allowed fulfillment'}</p>
        <div className="mb-4 flex flex-wrap gap-3">
          {['seller', 'store'].map((mode) => (
            <label key={mode} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.allowedFulfillment.includes(mode)} onChange={() => toggleMode(mode)} disabled={!canWrite} />
              {label(FULFILLMENT, mode, isAr)}
            </label>
          ))}
        </div>
        <label className="mb-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.autoApproveListings} onChange={(e) => setForm((f) => ({ ...f, autoApproveListings: e.target.checked }))} disabled={!canWrite} />
          {isAr ? 'بائع موثوق — تُنشر منتجاته دون مراجعة' : 'Trusted seller — listings publish without review'}
        </label>
        <label className="mb-3 block text-sm">
          <span className="mb-1 block font-medium">{isAr ? 'ملاحظات داخلية (لا يراها البائع)' : 'Internal notes (not visible to the seller)'}</span>
          <textarea rows={3} className={inputCls} value={form.internalNote} onChange={(e) => setForm((f) => ({ ...f, internalNote: e.target.value }))} disabled={!canWrite} />
        </label>
        {canWrite && <Button size="sm" disabled={saving} onClick={save}>{isAr ? 'حفظ' : 'Save'}</Button>}
      </section>

      <section className="rounded-2xl border border-border bg-white p-4">
        <h3 className="mb-2 font-bold">{isAr ? 'بيانات الدفع' : 'Payout details'}</h3>
        <Row k={isAr ? 'البنك' : 'Bank'} v={seller.bank?.bankName} />
        <Row k={isAr ? 'صاحب الحساب' : 'Holder'} v={seller.bank?.accountName} />
        <Row k={isAr ? 'رقم الحساب' : 'Account'} v={seller.bank?.accountNumber} />
        <Row k="IBAN" v={seller.bank?.iban} />
        <Row k={isAr ? 'محفظة' : 'Wallet'} v={seller.bank?.walletPhone} />
      </section>

      <section className="rounded-2xl border border-border bg-white p-4">
        <h3 className="mb-2 font-bold">{isAr ? 'حسابات الدخول' : 'Logins'}</h3>
        {(seller.team || []).map((u) => (
          <Row key={u._id} k={u.name} v={`${u.email} · ${u.role === 'seller_owner' ? (isAr ? 'مالك' : 'owner') : (isAr ? 'موظف' : 'staff')}`} />
        ))}
      </section>
    </div>
  );
}

function CreateSellerPanel({ isAr, onCreated }) {
  const toast = useToast();
  const [form, setForm] = useState({ nameAr: '', nameEn: '', contactName: '', email: '', phone: '', password: '', city: '', activate: true });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const submit = async () => {
    setSaving(true);
    try {
      const { data } = await adminApi.createSeller(form);
      toast.success(isAr ? 'تم إنشاء البائع' : 'Seller created');
      onCreated(data.data._id);
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر الإنشاء' : 'Could not create seller'));
    } finally {
      setSaving(false);
    }
  };
  const fields = [
    ['nameAr', isAr ? 'اسم المتجر (عربي)' : 'Store name (Arabic)'],
    ['nameEn', isAr ? 'اسم المتجر (إنجليزي)' : 'Store name (English)'],
    ['contactName', isAr ? 'اسم المسؤول' : 'Contact name'],
    ['email', isAr ? 'البريد (للدخول)' : 'Email (sign-in)'],
    ['phone', isAr ? 'الهاتف' : 'Phone'],
    ['password', isAr ? 'كلمة مرور مبدئية (8+)' : 'Initial password (8+)'],
    ['city', isAr ? 'المدينة' : 'City'],
  ];
  return (
    <div className="space-y-3">
      {fields.map(([k, text]) => (
        <label key={k} className="block text-sm">
          <span className="mb-1 block font-medium">{text}</span>
          <input className={inputCls} type={k === 'password' ? 'password' : 'text'} value={form[k]} onChange={set(k)} dir={['email', 'phone', 'password', 'nameEn'].includes(k) ? 'ltr' : undefined} />
        </label>
      ))}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.activate} onChange={set('activate')} />
        {isAr ? 'تفعيل المتجر مباشرة' : 'Activate immediately'}
      </label>
      <Button disabled={saving} onClick={submit}>{isAr ? 'إنشاء' : 'Create seller'}</Button>
    </div>
  );
}

export default function SellersPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { user } = useAuth();
  const toast = useToast();
  const { refreshStats } = useAdminStats();
  const canWrite = hasPermission(user, 'sellers:write');

  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({});
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    adminApi.listSellers({ status: status || undefined, q: q || undefined, page, limit: 25 })
      .then(({ data }) => {
        setItems(data.data || []);
        setCounts(data.counts || {});
        setPagination(data.pagination);
      })
      .catch(() => toast.error(isAr ? 'تعذّر تحميل البائعين' : 'Could not load sellers'))
      .finally(() => setLoading(false));
  }, [status, q, page, isAr, toast]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const onChanged = () => { load(); refreshStats(); };
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const openSeller = items.find((s) => s._id === openId);

  return (
    <div className="space-y-6">
      <PageHeader
        title={isAr ? 'البائعون' : 'Sellers'}
        description={isAr ? 'بائعون خارجيون يعرضون منتجاتهم في متجرك.' : 'Third-party sellers listing their products in your store.'}
        action={canWrite && <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" />{isAr ? 'إضافة بائع' : 'Add seller'}</Button>}
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((tab) => (
            <button
              key={tab || 'all'}
              type="button"
              onClick={() => { setPage(1); setStatus(tab); }}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${status === tab ? 'bg-primary-600 text-white' : 'bg-white text-text ring-1 ring-border'}`}
            >
              {tab ? label(SELLER_STATUS, tab, isAr) : (isAr ? 'الكل' : 'All')} ({tab ? counts[tab] || 0 : total})
            </button>
          ))}
        </div>
        <label className="relative ms-auto w-full sm:w-72">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} placeholder={isAr ? 'اسم، بريد، هاتف، سجل تجاري' : 'Name, email, phone, register no.'} className={`${inputCls} ps-9`} />
        </label>
      </div>

      <section className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
        {loading ? (
          <div className="flex min-h-[200px] items-center justify-center"><Loader size="lg" /></div>
        ) : items.length === 0 ? (
          <p className="p-8 text-center text-sm text-text-muted">{isAr ? 'لا يوجد بائعون هنا.' : 'No sellers here.'}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-slate-50 text-xs text-text-muted">
                <tr>
                  <th className="px-4 py-3 text-start">{isAr ? 'المتجر' : 'Store'}</th>
                  <th className="px-4 py-3 text-start">{isAr ? 'التواصل' : 'Contact'}</th>
                  <th className="px-4 py-3 text-start">{isAr ? 'المنتجات' : 'Products'}</th>
                  <th className="px-4 py-3 text-start">{isAr ? 'العمولة' : 'Commission'}</th>
                  <th className="px-4 py-3 text-start">{isAr ? 'الحالة' : 'Status'}</th>
                  <th className="px-4 py-3 text-start">{isAr ? 'التاريخ' : 'Date'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((s) => (
                  <tr key={s._id} onClick={() => setOpenId(s._id)} className="cursor-pointer hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-semibold">{isAr ? s.nameAr : s.nameEn}</p>
                      <p className="text-xs text-text-muted">{s.address?.city}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p>{s.contactName}</p>
                      <p className="text-xs text-text-muted" dir="ltr">{s.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      {s.products.live} {isAr ? 'معروض' : 'live'}
                      {s.products.pending > 0 && <span className="ms-1 rounded-full bg-amber-100 px-2 text-xs text-amber-900">{s.products.pending} {isAr ? 'للمراجعة' : 'to review'}</span>}
                    </td>
                    <td className="px-4 py-3">{s.commissionRate != null ? `${s.commissionRate}%` : (isAr ? 'افتراضي' : 'Default')}</td>
                    <td className="px-4 py-3"><StatusBadge map={SELLER_STATUS} value={s.status} isAr={isAr} /></td>
                    <td className="px-4 py-3 text-xs text-text-muted">{fmtDate(s.createdAt, isAr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {pagination?.pages > 1 && <Pagination page={page} pages={pagination.pages} total={pagination.total} limit={pagination.limit} onPageChange={setPage} isAr={isAr} />}

      <AdminSlidePanel
        open={Boolean(openId)}
        onClose={() => setOpenId('')}
        title={openSeller ? (isAr ? openSeller.nameAr : openSeller.nameEn) : (isAr ? 'البائع' : 'Seller')}
        subtitle={openSeller?.email}
        width="max-w-2xl"
        isAr={isAr}
      >
        {openId && <SellerDetail key={openId} sellerId={openId} isAr={isAr} onChanged={onChanged} canWrite={canWrite} />}
      </AdminSlidePanel>

      <AdminSlidePanel open={creating} onClose={() => setCreating(false)} title={isAr ? 'إضافة بائع' : 'Add seller'} isAr={isAr}>
        {creating && <CreateSellerPanel isAr={isAr} onCreated={(id) => { setCreating(false); onChanged(); setOpenId(id); }} />}
      </AdminSlidePanel>
    </div>
  );
}
