import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, ChevronLeft, ChevronRight, Download, FileCheck2, LineChart, MessageSquare, PackageSearch, Percent, Plus, Store, Wallet,
} from 'lucide-react';
import { Link, useNavigate } from '../../app/router';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { adminApi } from '../adminApi';
import { useAdminListPage } from '../hooks/useAdminListPage';
import { AdminListPage } from '../components/list';
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
import BulkDealForm from '../components/sellers/BulkDealForm';

const count = (n) => formatMoneyLatin(n || 0, { maximumFractionDigits: 0 });
const money = (n, isAr) => `${formatMoneyLatin(n || 0, { maximumFractionDigits: 0 })} ${isAr ? 'ج.م' : 'EGP'}`;

/** Status filter as tabs with counts — the one control for "which sellers am I looking at". */
function StatusTabs({ tabs, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1" role="tablist">
      {tabs.map((t) => {
        const active = value === t.value;
        return (
          <button
            key={t.value || 'all'}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${active ? 'bg-primary-600 font-semibold text-white' : 'text-text-muted hover:bg-slate-100 hover:text-text'}`}
          >
            {t.label}
            <span className={`rounded-full px-1.5 text-[11px] font-semibold leading-5 tabular-nums ${active ? 'bg-white/20 text-white' : t.attention ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-text-muted'}`}>
              {t.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** A small "needs you" link — rendered only when there is something to do. */
function NoticeChip({ to, icon: Icon, children, isAr }) {
  const Arrow = isAr ? ChevronLeft : ChevronRight;
  return (
    <Link to={to} className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100">
      <Icon className="h-3.5 w-3.5" />{children}<Arrow className="h-3.5 w-3.5" />
    </Link>
  );
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
  // Deep link from other screens: /admin/sellers?open=<id>&tab=rules|payouts
  const [deepLink] = useState(() => {
    const q = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);
    return { id: q.get('open') || '', tab: q.get('tab') || 'overview' };
  });
  const [openId, setOpenId] = useState(deepLink.id);
  const [creating, setCreating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [bulkDeal, setBulkDeal] = useState(false);
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

  const statusCell = (s) => (
    <div className="flex flex-wrap items-center gap-1.5">
      <StatusBadge map={SELLER_STATUS} value={s.status} isAr={isAr} />
      {/* Only flag health when it needs attention — "healthy" is the quiet default. */}
      {s.health && s.health !== 'good' && healthCell(s)}
      {s.unreadMessages > 0 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
          <MessageSquare className="h-3.5 w-3.5" />{s.unreadMessages}
        </span>
      )}
    </div>
  );

  const columns = [
    { key: 'name', header: isAr ? 'المتجر' : 'Store', sortKey: 'name', render: storeCell },
    { key: 'status', header: isAr ? 'الحالة' : 'Status', render: statusCell },
    { key: 'products', header: isAr ? 'المنتجات' : 'Products', render: productsCell },
    {
      key: 'createdAt',
      header: isAr ? 'انضم في' : 'Joined',
      sortKey: 'createdAt',
      headerClassName: 'hidden md:table-cell',
      cellClassName: 'hidden md:table-cell',
      render: (s) => <span className="whitespace-nowrap text-sm text-text-muted">{s.createdAt ? formatDate(s.createdAt, isAr ? 'ar-EG' : 'en-GB') : '—'}</span>,
    },
  ];

  const renderMobileCard = (s) => (
    <div className="space-y-2">
      {storeCell(s)}
      {statusCell(s)}
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

  const selectedSellers = list.data.filter((s) => list.selectedIds.includes(s._id));
  const bulkBar = list.selectedIds.length > 0 ? (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-primary-50/50 px-4 py-2.5 text-sm">
      <span className="font-semibold">{isAr ? `تم اختيار ${list.selectedIds.length}` : `${list.selectedIds.length} selected`}</span>
      {canEditSettings && (
        <Button size="sm" variant="secondary" onClick={() => setBulkDeal(true)} className="gap-1.5"><Percent className="h-4 w-4" />{isAr ? 'تغيير العمولة والرسوم' : 'Change commission & fees'}</Button>
      )}
      <button type="button" onClick={list.clearSelection} className="ms-auto text-xs font-semibold text-text-muted hover:text-text">{isAr ? 'إلغاء الاختيار' : 'Clear selection'}</button>
    </div>
  ) : null;

  const filtering = Boolean(list.q.trim() || status);
  const firstRun = !list.loading && total === 0 && !filtering;

  const statusTabs = [
    { value: '', label: isAr ? 'الكل' : 'All', count: total },
    { value: 'waiting', label: isAr ? 'تنتظر قرارك' : 'Waiting for you', count: waiting, attention: waiting > 0 },
    { value: 'active', label: label(SELLER_STATUS, 'active', isAr), count: counts.active || 0 },
    { value: 'suspended', label: label(SELLER_STATUS, 'suspended', isAr), count: counts.suspended || 0 },
    { value: 'rejected', label: label(SELLER_STATUS, 'rejected', isAr), count: counts.rejected || 0 },
  ];
  const showNotices = summary.pendingListings > 0 || summary.unreadMessages > 0 || canSeeMoney;

  return (
    <div className="space-y-4">
      {settings && settings.enabled === false && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          <p className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 shrink-0" />{isAr ? 'البيع عن طريق بائعين متوقف — منتجات البائعين مخفية.' : 'Outside sellers are switched off — seller products are hidden.'}</p>
          {canEditSettings && <Link to="/admin/marketplace-settings" className="font-semibold underline">{isAr ? 'تشغيل' : 'Turn on'}</Link>}
        </div>
      )}

      {/* One line: the links sellers need + the page actions. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SellerPortalCard isAr={isAr} settings={settings} canEditSettings={canEditSettings} />
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleExport}
            disabled={exporting || !total}
            className="!px-2.5"
            title={isAr ? 'تصدير CSV' : 'Export CSV'}
            aria-label={isAr ? 'تصدير CSV' : 'Export CSV'}
          >
            <Download className="h-4 w-4" />
          </Button>
          {canWrite && (
            <Button size="sm" onClick={() => setCreating(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />{isAr ? 'إضافة بائع' : 'Add seller'}
            </Button>
          )}
        </div>
      </div>

      {showNotices && (
        <div className="flex flex-wrap gap-2">
          {summary.pendingListings > 0 && (
            <NoticeChip to="/admin/listing-review" icon={PackageSearch} isAr={isAr}>
              {isAr ? `${count(summary.pendingListings)} منتج ينتظر موافقتك` : `${count(summary.pendingListings)} products waiting for approval`}
            </NoticeChip>
          )}
          {summary.unreadMessages > 0 && (
            <NoticeChip to="/admin/sellers" icon={MessageSquare} isAr={isAr}>
              {isAr ? `${count(summary.unreadMessages)} رد جديد من البائعين` : `${count(summary.unreadMessages)} new seller replies`}
            </NoticeChip>
          )}
          {canSeeMoney && owed > 0 && (
            <NoticeChip to="/admin/seller-payouts" icon={Wallet} isAr={isAr}>
              {isAr ? `${money(owed, isAr)} مستحق للبائعين` : `${money(owed, isAr)} owed to sellers`}
            </NoticeChip>
          )}
          {canSeeMoney && (
            <NoticeChip to="/admin/seller-profit" icon={LineChart} isAr={isAr}>
              {isAr ? 'أرباحك من البائعين' : 'Your profit from sellers'}
            </NoticeChip>
          )}
          {hasPermission(user, 'settings:write') && (
            <NoticeChip to="/admin/seller-fees" icon={Percent} isAr={isAr}>
              {isAr ? 'العمولات والرسوم' : 'Fees & commission'}
            </NoticeChip>
          )}
        </div>
      )}

      {firstRun ? (
        <HowItWorks isAr={isAr} canWrite={canWrite} onAdd={() => setCreating(true)} />
      ) : (
        <AdminListPage
          isAr={isAr}
          filters={<StatusTabs tabs={statusTabs} value={status} onChange={(v) => list.patchFilters({ status: v })} />}
          searchPlaceholder={isAr ? 'ابحث بالاسم أو البريد أو الهاتف' : 'Search name, email or phone'}
          q={list.q}
          onSearchChange={list.setQ}
          bulkBar={bulkBar}
          selectable={canWrite}
          selectedIds={list.selectedIds}
          onToggleSelect={list.toggleSelect}
          onToggleSelectAll={list.toggleSelectAll}
          allSelected={list.allSelected}
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
            initialTab={openId === deepLink.id ? deepLink.tab : 'overview'}
          />
        )}
      </AdminSlidePanel>

      <AdminSlidePanel open={bulkDeal} onClose={() => setBulkDeal(false)} title={isAr ? 'تغيير العمولة والرسوم' : 'Change commission & fees'} width="max-w-xl" isAr={isAr}>
        {bulkDeal && (
          <BulkDealForm
            sellers={selectedSellers}
            plans={settings?.plans || []}
            isAr={isAr}
            onDone={() => { list.clearSelection(); onChanged(); }}
            onCancel={() => setBulkDeal(false)}
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
