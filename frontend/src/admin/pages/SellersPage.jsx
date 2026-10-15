import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, ClipboardList, Download, FileCheck2, Hourglass, PackageSearch, Plus, Store, Wallet,
} from 'lucide-react';
import { Link, useNavigate } from '../../app/router';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { adminApi } from '../adminApi';
import { useAdminListPage } from '../hooks/useAdminListPage';
import { AdminListPage, ListFilterSelect } from '../components/list';
import { useConfirm, useToast } from '../components';
import AdminSlidePanel from '../components/AdminSlidePanel';
import Button from '../../components/ui/Button';
import { useAdminStats } from '../context/AdminStatsContext';
import { hasPermission } from '../adminPermissions';
import { ACCOUNT_HEALTH, SELLER_STATUS, apiError, label } from '../../seller/sellerLabels';
import StatusBadge from '../../seller/StatusBadge';
import { formatDate, formatMoneyLatin } from '../../utils/formatters';
import { downloadBlob } from '../utils/downloadBlob';
import { sellerLoginUrl, sellersToCsv } from '../utils/sellerAdmin';
import SellerPortalCard from '../components/sellers/SellerPortalCard';
import SellerDetailPanel from '../components/sellers/SellerDetailPanel';
import CreateSellerPanel from '../components/sellers/CreateSellerPanel';

const count = (n) => formatMoneyLatin(n || 0, { maximumFractionDigits: 0 });
const money = (n, isAr) => `${formatMoneyLatin(n || 0, { maximumFractionDigits: 0 })} ${isAr ? 'ج.م' : 'EGP'}`;

function SummaryCard({ label: text, value, hint, icon: Icon, tone = 'slate', active, onClick, to }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-600',
    amber: 'bg-amber-100 text-amber-700',
    emerald: 'bg-emerald-100 text-emerald-700',
    red: 'bg-red-100 text-red-700',
    primary: 'bg-primary-100 text-primary-700',
  };
  const cls = [
    'group block rounded-2xl border px-4 py-3.5 text-start transition-all',
    active ? 'border-primary-400 bg-primary-50 shadow-sm ring-1 ring-primary-100' : 'border-border bg-white hover:border-primary-200 hover:bg-primary-50/30',
  ].join(' ');
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${active ? 'bg-primary-600 text-white' : tones[tone]}`}><Icon className="h-4 w-4" /></span>
        <p className="text-2xl font-bold tabular-nums text-text">{value}</p>
      </div>
      <p className={`mt-2 text-xs font-semibold ${active ? 'text-primary-800' : 'text-text-muted'}`}>{text}</p>
      {hint && <p className="text-[11px] text-text-muted">{hint}</p>}
    </>
  );
  if (to) return <Link to={to} className={cls}>{body}</Link>;
  return <button type="button" onClick={onClick} className={cls}>{body}</button>;
}

/** First-run guide: what the marketplace is and the steps to get the first seller selling. */
function HowItWorks({ isAr, canWrite, onAdd }) {
  const steps = isAr
    ? ['يقدّم التاجر طلباً من صفحة «بِع معنا» أو تضيفه أنت', 'تراجع بياناته ومستنداته ثم تعتمده', 'يدخل إلى مركز البائعين ويضيف منتجاته', 'توافق على منتجاته فتظهر للعملاء', 'تحوّل له مستحقاته بعد خصم العمولة']
    : ['A merchant applies on “Sell with us”, or you add them', 'You check their details and documents, then approve', 'They sign in to Seller Center and add products', 'You approve their products and customers see them', 'You pay them their earnings minus commission'];
  return (
    <div className="rounded-2xl border border-dashed border-border bg-white p-6">
      <div className="mx-auto max-w-xl text-center">
        <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary-700"><Store className="h-6 w-6" /></span>
        <p className="font-bold text-text">{isAr ? 'لا يوجد بائعون بعد' : 'No sellers yet'}</p>
        <p className="mt-1 text-sm text-text-muted">{isAr ? 'هكذا يعمل البيع عن طريق بائعين:' : 'This is how outside sellers work:'}</p>
      </div>
      <ol className="mx-auto mt-4 grid max-w-3xl gap-2 sm:grid-cols-5">
        {steps.map((s, i) => (
          <li key={s} className="rounded-xl bg-slate-50 p-3 text-xs text-text">
            <span className="mb-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary-600 text-[11px] font-bold text-white">{i + 1}</span>
            {s}
          </li>
        ))}
      </ol>
      {canWrite && (
        <div className="mt-5 text-center">
          <Button onClick={onAdd} className="gap-1.5"><Plus className="h-4 w-4" />{isAr ? 'إضافة أول بائع' : 'Add your first seller'}</Button>
        </div>
      )}
    </div>
  );
}

export default function SellersPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const { refreshStats } = useAdminStats();
  const navigate = useNavigate();
  const canWrite = hasPermission(user, 'sellers:write');
  const canSeeMoney = hasPermission(user, 'reports:read');
  const canEditSettings = hasPermission(user, 'settings:write');

  const [counts, setCounts] = useState({});
  const [summary, setSummary] = useState({ pendingListings: 0 });
  const [owed, setOwed] = useState(null);
  const [settings, setSettings] = useState(null);
  const [openId, setOpenId] = useState('');
  const [creating, setCreating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const detailDirty = useRef(false);

  const fetchSellers = useCallback((params) => adminApi.listSellers(params).then((res) => {
    setCounts(res.data.counts || {});
    setSummary(res.data.summary || { pendingListings: 0 });
    return res;
  }), []);

  const list = useAdminListPage({
    fetchFn: fetchSellers,
    initialFilters: { status: '' },
    syncUrl: true,
  });

  useEffect(() => {
    adminApi.getMarketplaceSettings().then(({ data }) => setSettings(data.data)).catch(() => setSettings({}));
  }, []);

  const loadOwed = useCallback(() => {
    if (!canSeeMoney) return;
    adminApi.getSellerBalances()
      .then(({ data }) => setOwed((data.data || []).reduce((sum, r) => sum + Math.max(0, r.available || 0), 0)))
      .catch(() => setOwed(null));
  }, [canSeeMoney]);
  useEffect(() => { loadOwed(); }, [loadOwed]);

  const onChanged = () => { list.reload(); refreshStats(); };

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const waiting = (counts.applied || 0) + (counts.under_review || 0);
  const status = list.filters.status;
  const setStatus = (value) => list.patchFilters({ status: status === value ? '' : value });

  const closeDetail = useCallback(async () => {
    if (detailDirty.current) {
      const ok = await confirm({
        title: isAr ? 'تغييرات غير محفوظة' : 'Unsaved changes',
        message: isAr ? 'لم تحفظ تعديلات العمولة والقواعد. إغلاق بدون حفظ؟' : 'Your commission & rules edits are not saved. Close without saving?',
        confirmLabel: isAr ? 'إغلاق بدون حفظ' : 'Close without saving',
        cancelLabel: isAr ? 'متابعة التعديل' : 'Keep editing',
        variant: 'danger',
      });
      if (!ok) return;
    }
    detailDirty.current = false;
    setOpenId('');
  }, [confirm, isAr]);
  const onDirtyChange = useCallback((d) => { detailDirty.current = d; }, []);

  const quickStatus = async (s, next) => {
    const name = isAr ? s.nameAr : s.nameEn;
    const ok = await confirm({
      title: next === 'under_review' ? (isAr ? `بدء مراجعة ${name}؟` : `Start reviewing ${name}?`) : (isAr ? `تفعيل ${name}؟` : `Activate ${name}?`),
      message: next === 'under_review'
        ? (isAr ? 'سيرى البائع أن طلبه قيد المراجعة.' : 'The seller will see their application is being reviewed.')
        : (isAr ? 'ستظهر منتجاته المعتمدة في المتجر فوراً.' : 'Their approved products go live right away.'),
      confirmLabel: isAr ? 'تأكيد' : 'Confirm',
      cancelLabel: isAr ? 'إلغاء' : 'Cancel',
      variant: 'primary',
    });
    if (!ok) return;
    try {
      await adminApi.setSellerStatus(s._id, { status: next });
      toast.success(isAr ? 'تم تحديث الحالة' : 'Status updated');
      onChanged();
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر التحديث' : 'Update failed'));
    }
  };

  const copy = async (text, done) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(done);
    } catch {
      toast.error(isAr ? 'تعذر النسخ' : 'Could not copy');
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const rows = [];
      const base = { ...list.queryParams, limit: 100 };
      for (let page = 1; page <= 50; page += 1) {
        const { data } = await adminApi.listSellers({ ...base, page });
        rows.push(...(data.data || []));
        if (page >= (data.pagination?.pages || 1)) break;
      }
      downloadBlob(new Blob([sellersToCsv(rows, { isAr })], { type: 'text/csv;charset=utf-8' }), `sellers-${new Date().toISOString().slice(0, 10)}.csv`);
    } catch {
      toast.error(isAr ? 'فشل التصدير' : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const storeCell = (s) => {
    const name = isAr ? s.nameAr : s.nameEn;
    return (
      <div className="flex items-center gap-3">
        {s.logoUrl
          ? <img src={s.logoUrl} alt="" className="h-9 w-9 shrink-0 rounded-lg border border-border object-cover" />
          : <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-sm font-bold text-primary-700">{(name || '?').trim().charAt(0)}</span>}
        <div className="min-w-0">
          <p className="truncate font-semibold text-text">{name}</p>
          <p className="truncate text-xs text-text-muted">{[s.address?.city, s.contactName].filter(Boolean).join(' · ')}</p>
        </div>
      </div>
    );
  };

  const healthCell = (s) => {
    const h = s.health && ACCOUNT_HEALTH[s.health];
    if (!h) return <span className="text-xs text-text-muted">—</span>;
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${h.tone}`}>
        <h.Icon className="h-3.5 w-3.5" />{isAr ? h.ar : h.en}
      </span>
    );
  };

  const productsCell = (s) => (
    <div className="text-sm">
      <span className="font-semibold tabular-nums">{s.products.live}</span>
      <span className="ms-1 text-xs text-text-muted">{isAr ? 'معروض' : 'live'}</span>
      {s.products.pending > 0 && (
        <span className="ms-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">{s.products.pending} {isAr ? 'للمراجعة' : 'to review'}</span>
      )}
    </div>
  );

  const columns = [
    { key: 'name', header: isAr ? 'المتجر' : 'Store', sortKey: 'name', render: storeCell },
    {
      key: 'email',
      header: isAr ? 'البريد' : 'Email',
      headerClassName: 'hidden xl:table-cell',
      cellClassName: 'hidden xl:table-cell',
      render: (s) => <span dir="ltr" className="text-sm text-text-muted">{s.email}</span>,
    },
    { key: 'status', header: isAr ? 'الحالة' : 'Status', render: (s) => <StatusBadge map={SELLER_STATUS} value={s.status} isAr={isAr} /> },
    { key: 'health', header: isAr ? 'الأداء' : 'Health', headerClassName: 'hidden lg:table-cell', cellClassName: 'hidden lg:table-cell', render: healthCell },
    { key: 'products', header: isAr ? 'المنتجات' : 'Products', render: productsCell },
    {
      key: 'rating',
      header: isAr ? 'التقييم' : 'Rating',
      sortKey: 'rating',
      headerClassName: 'hidden lg:table-cell',
      cellClassName: 'hidden lg:table-cell',
      render: (s) => (s.ratingCount ? <span className="text-sm tabular-nums">{s.rating} <span className="text-amber-500">★</span> <span className="text-xs text-text-muted">({s.ratingCount})</span></span> : <span className="text-xs text-text-muted">—</span>),
    },
    {
      key: 'commission',
      header: isAr ? 'العمولة' : 'Commission',
      sortKey: 'commission',
      headerClassName: 'hidden md:table-cell',
      cellClassName: 'hidden md:table-cell',
      render: (s) => (s.commissionRate != null ? <span className="tabular-nums">{s.commissionRate}%</span> : <span className="text-xs text-text-muted">{isAr ? 'النسبة العامة' : 'Default'}</span>),
    },
    {
      key: 'createdAt',
      header: isAr ? 'تاريخ الطلب' : 'Applied',
      sortKey: 'createdAt',
      headerClassName: 'hidden md:table-cell',
      cellClassName: 'hidden md:table-cell',
      render: (s) => <span className="whitespace-nowrap text-sm text-text-muted">{s.createdAt ? formatDate(s.createdAt, isAr ? 'ar-EG' : 'en-GB') : '—'}</span>,
    },
  ];

  const renderMobileCard = (s) => (
    <div className="space-y-2">
      {storeCell(s)}
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge map={SELLER_STATUS} value={s.status} isAr={isAr} />
        {s.health && healthCell(s)}
      </div>
      {productsCell(s)}
    </div>
  );

  const rowActions = (s) => {
    const actions = [{ label: isAr ? 'فتح الملف' : 'Open', onClick: () => setOpenId(s._id) }];
    if (s.status === 'active') {
      actions.push({ label: isAr ? 'عرض صفحة المتجر' : 'View store page', onClick: () => window.open(`/${isAr ? 'ar' : 'en'}/sellers/${s.slug}`, '_blank', 'noopener') });
    }
    actions.push({
      label: isAr ? 'نسخ رابط دخول البائع' : 'Copy seller sign-in link',
      onClick: () => copy(sellerLoginUrl(window.location.origin), isAr ? 'تم نسخ رابط الدخول' : 'Sign-in link copied'),
    });
    if (s.products.pending > 0) {
      actions.push({ label: isAr ? 'مراجعة منتجاته' : 'Review their products', onClick: () => navigate(`/admin/listing-review?seller=${s._id}`) });
    }
    if (canWrite && s.status === 'applied') actions.push({ label: isAr ? 'بدء المراجعة' : 'Start review', onClick: () => quickStatus(s, 'under_review') });
    return actions;
  };

  const filtering = Boolean(list.q.trim() || status);
  const firstRun = !list.loading && total === 0 && !filtering;

  return (
    <div className="space-y-5">
      <p className="max-w-2xl text-sm text-text-muted">
        {isAr
          ? 'تجار آخرون يبيعون منتجاتهم في متجرك. راجع طلبات الانضمام، وأرسل لهم رابط الدخول، وتابع أداءهم ومستحقاتهم.'
          : 'Other merchants selling in your store. Review applications, send them their sign-in link, and track performance and payouts.'}
      </p>

      {settings && settings.enabled === false && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 shrink-0" />{isAr ? 'البيع عن طريق بائعين متوقف — لن تظهر منتجات البائعين ولا يمكنهم الدخول للبيع.' : 'Outside sellers are switched off — seller products are hidden and sellers cannot sell.'}</p>
          {canEditSettings && <Link to="/admin/marketplace-settings" className="font-semibold underline">{isAr ? 'تشغيل' : 'Turn on'}</Link>}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <SummaryCard icon={Hourglass} tone="amber" label={isAr ? 'طلبات تنتظر قرارك' : 'Applications waiting'} value={count(waiting)} active={status === 'waiting'} onClick={() => setStatus('waiting')} hint={counts.under_review ? (isAr ? `${counts.under_review} قيد المراجعة` : `${counts.under_review} under review`) : null} />
        <SummaryCard icon={Store} tone="emerald" label={isAr ? 'بائعون نشطون' : 'Active sellers'} value={count(counts.active)} active={status === 'active'} onClick={() => setStatus('active')} />
        <SummaryCard icon={PackageSearch} tone="primary" label={isAr ? 'منتجات تنتظر الموافقة' : 'Products to approve'} value={count(summary.pendingListings)} to="/admin/listing-review" />
        <SummaryCard icon={AlertTriangle} tone="red" label={isAr ? 'موقوفون' : 'Suspended'} value={count(counts.suspended)} active={status === 'suspended'} onClick={() => setStatus('suspended')} />
        {canSeeMoney
          ? <SummaryCard icon={Wallet} tone="slate" label={isAr ? 'مستحق للبائعين الآن' : 'Owed to sellers now'} value={owed == null ? '—' : money(owed, isAr)} to="/admin/seller-payouts" />
          : <SummaryCard icon={ClipboardList} tone="slate" label={isAr ? 'كل البائعين' : 'All sellers'} value={count(total)} active={!status} onClick={() => list.patchFilters({ status: '' })} />}
      </div>

      <SellerPortalCard isAr={isAr} settings={settings} canEditSettings={canEditSettings} />

      {firstRun ? (
        <HowItWorks isAr={isAr} canWrite={canWrite} onAdd={() => setCreating(true)} />
      ) : (
        <AdminListPage
          isAr={isAr}
          actions={(
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="secondary" onClick={handleExport} disabled={exporting} className="gap-1.5">
                <Download className="h-4 w-4" />
                {exporting ? (isAr ? 'جاري التصدير…' : 'Exporting…') : (isAr ? 'تصدير CSV' : 'Export CSV')}
              </Button>
              {canWrite && (
                <Button size="sm" onClick={() => setCreating(true)} className="gap-1.5 shadow-sm">
                  <Plus className="h-4 w-4" />{isAr ? 'إضافة بائع' : 'Add seller'}
                </Button>
              )}
            </div>
          )}
          filters={(
            <ListFilterSelect
              label={isAr ? 'الحالة' : 'Status'}
              value={status}
              onChange={(v) => list.patchFilters({ status: v })}
              options={[
                { value: '', label: `${isAr ? 'الكل' : 'All'} (${total})` },
                { value: 'waiting', label: `${isAr ? 'تنتظر قرارك' : 'Waiting for you'} (${waiting})` },
                ...Object.keys(SELLER_STATUS).map((k) => ({ value: k, label: `${label(SELLER_STATUS, k, isAr)} (${counts[k] || 0})` })),
              ]}
            />
          )}
          searchPlaceholder={isAr ? 'اسم المتجر، البريد، الهاتف، السجل التجاري' : 'Store name, email, phone, register no.'}
          q={list.q}
          onSearchChange={list.setQ}
          columns={columns}
          data={list.data}
          loading={list.loading}
          sort={list.sort}
          onSort={list.toggleSort}
          rowActions={rowActions}
          onRowClick={(s) => setOpenId(s._id)}
          emptyIcon={FileCheck2}
          emptyTitle={isAr ? 'لا توجد نتائج' : 'No results'}
          emptyDescription={isAr ? 'جرّب كلمة بحث أو حالة مختلفة' : 'Try a different search or status'}
          pagination={list.pagination}
          onPageChange={list.setPage}
          renderMobileCard={renderMobileCard}
        />
      )}

      <AdminSlidePanel
        open={Boolean(openId)}
        onClose={closeDetail}
        title={(() => { const s = list.data.find((x) => x._id === openId); return s ? (isAr ? s.nameAr : s.nameEn) : (isAr ? 'البائع' : 'Seller'); })()}
        subtitle={list.data.find((x) => x._id === openId)?.email}
        width="max-w-2xl"
        isAr={isAr}
      >
        {openId && (
          <SellerDetailPanel
            key={openId}
            sellerId={openId}
            isAr={isAr}
            canWrite={canWrite}
            canSeeMoney={canSeeMoney}
            onChanged={() => { onChanged(); loadOwed(); }}
            onDirtyChange={onDirtyChange}
          />
        )}
      </AdminSlidePanel>

      <AdminSlidePanel open={creating} onClose={() => setCreating(false)} title={isAr ? 'إضافة بائع' : 'Add seller'} width="max-w-xl" isAr={isAr}>
        {creating && (
          <CreateSellerPanel
            isAr={isAr}
            onCreated={onChanged}
            onOpenSeller={(id) => { setCreating(false); setOpenId(id); }}
          />
        )}
      </AdminSlidePanel>
    </div>
  );
}
