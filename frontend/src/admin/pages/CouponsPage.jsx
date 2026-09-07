import { useCallback, useMemo, useState } from 'react';
import {
  Calendar,
  Copy,
  Percent,
  Plus,
  Tag,
  Ticket,
  TrendingUp,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { adminApi } from '../adminApi';
import { useAdminListPage } from '../hooks/useAdminListPage';
import Button from '../../components/ui/Button';
import { AdminListPage, BulkActionsBar, ListFilterSelect } from '../components/list';
import { useConfirm, useToast } from '../components';
import AdminSlidePanel from '../components/AdminSlidePanel';
import CouponEditorPanel from '../components/CouponEditorPanel';
import {
  COUPON_STATUS_META,
  COUPON_TYPE_META,
  formatCouponDiscount,
  formatCouponExpiry,
  formatCouponTypeLabel,
  formatCouponUsage,
  formatMinSubtotal,
  getCouponLabel,
  getCouponLifecycle,
  getCouponType,
} from '../utils/couponHelpers';

const emptyCoupon = {
  code: '',
  discountType: 'percent',
  discountValue: 20,
  minSubtotal: 0,
  expiryDate: '',
  usageLimit: '',
  labelAr: '',
  labelEn: '',
  isActive: true,
};

function defaultExpiryDate() {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

function formatExpiryInput(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  return new Date(value).toISOString().slice(0, 10);
}

function SummaryCard({ label, value, hint, icon: Icon, active, onClick }) {
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={[
        'rounded-2xl border px-4 py-3.5 text-start transition-colors',
        active
          ? 'border-primary-300 bg-primary-50 shadow-sm'
          : 'border-border bg-white hover:border-primary-200 hover:bg-primary-50/40',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-2xl font-bold tabular-nums text-text" dir="ltr">
            {value}
          </p>
          <p className="mt-0.5 text-xs font-semibold text-text">{label}</p>
          {hint && <p className="mt-1 text-[11px] text-text-muted">{hint}</p>}
        </div>
        {Icon && (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
            <Icon className="h-4 w-4" aria-hidden />
          </span>
        )}
      </div>
    </Wrapper>
  );
}

function StatusBadge({ coupon, isAr }) {
  const lifecycle = getCouponLifecycle(coupon);
  const meta = COUPON_STATUS_META[lifecycle] || COUPON_STATUS_META.active;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${meta.className}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden />
      {isAr ? meta.ar : meta.en}
    </span>
  );
}

function DiscountCell({ coupon, isAr }) {
  const type = getCouponType(coupon);
  const meta = COUPON_TYPE_META[type] || COUPON_TYPE_META.percent;
  const label = getCouponLabel(coupon, isAr);

  return (
    <div className="min-w-[9rem] space-y-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold ${meta.chip}`}>
          {formatCouponTypeLabel(type, isAr)}
        </span>
        <span className="text-sm font-bold tabular-nums text-text" dir="ltr">
          {formatCouponDiscount(coupon, isAr)}
        </span>
      </div>
      {label && (
        <p className="line-clamp-1 text-[11px] text-text-muted">{label}</p>
      )}
      <p className="text-[11px] text-text-muted">
        {formatMinSubtotal(coupon.minSubtotal, isAr)}
      </p>
    </div>
  );
}

function UsageCell({ coupon, isAr }) {
  const { label, percent, unlimited } = formatCouponUsage(coupon, isAr);

  return (
    <div className="min-w-[7rem] space-y-1.5">
      <p className="text-sm font-semibold tabular-nums text-text" dir="ltr">
        {label}
      </p>
      {!unlimited && (
        <div className="h-1.5 w-full max-w-[7rem] overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all ${percent >= 90 ? 'bg-orange-500' : 'bg-primary-500'}`}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
      {unlimited && (
        <p className="text-[10px] font-medium text-text-muted">
          {isAr ? 'بدون حد' : 'No cap'}
        </p>
      )}
    </div>
  );
}

function CodeCell({ code, isAr, onCopy }) {
  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-xs font-bold tracking-wider text-slate-800">
        <Ticket className="h-3.5 w-3.5 text-primary-600" aria-hidden />
        <span dir="ltr">{code}</span>
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onCopy(code);
        }}
        className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-slate-100 hover:text-text"
        title={isAr ? 'نسخ الكود' : 'Copy code'}
        aria-label={isAr ? 'نسخ الكود' : 'Copy code'}
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export default function CouponsPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const confirm = useConfirm();
  const toast = useToast();
  const [form, setForm] = useState(emptyCoupon);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState({ total: 0, active: 0, expired: 0, redemptions: 0 });

  const fetchCoupons = useCallback(async (params) => {
    const res = await adminApi.getCoupons(params);
    if (res.data.summary) setSummary(res.data.summary);
    return res;
  }, []);

  const list = useAdminListPage({
    fetchFn: fetchCoupons,
    initialFilters: { isActive: '' },
  });

  const newCouponForm = useMemo(
    () => ({ ...emptyCoupon, expiryDate: defaultExpiryDate() }),
    [],
  );

  const openCreate = () => {
    setEditId(null);
    setForm(newCouponForm);
    setPanelOpen(true);
  };

  const openEdit = (coupon) => {
    setEditId(coupon._id || coupon.id);
    setForm({
      code: coupon.code,
      discountType: getCouponType(coupon),
      discountValue: coupon.discountValue ?? coupon.value ?? 0,
      minSubtotal: coupon.minSubtotal || 0,
      expiryDate: formatExpiryInput(coupon.expiryDate),
      usageLimit: coupon.usageLimit || '',
      labelAr: coupon.labelAr || '',
      labelEn: coupon.labelEn || '',
      isActive: coupon.isActive !== false,
    });
    setPanelOpen(true);
  };

  const closePanel = () => {
    setPanelOpen(false);
    setEditId(null);
    setForm(emptyCoupon);
  };

  const copyCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success(isAr ? 'تم نسخ الكود' : 'Code copied');
    } catch {
      toast.error(isAr ? 'تعذر النسخ' : 'Could not copy');
    }
  };

  const runBulk = async (action, title) => {
    const ok = await confirm({
      title,
      confirmLabel: isAr ? 'تأكيد' : 'Confirm',
      variant: action === 'delete' ? 'danger' : 'primary',
    });
    if (!ok) return;
    await adminApi.bulkCoupons(list.selectedIds, action);
    list.clearSelection();
    list.reload();
    toast.success(isAr ? 'تم' : 'Done');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        discountValue: Number(form.discountValue),
        minSubtotal: Number(form.minSubtotal) || 0,
        usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
      };
      if (editId) await adminApi.updateCoupon(editId, payload);
      else await adminApi.createCoupon(payload);
      closePanel();
      list.reload();
      toast.success(isAr ? 'تم حفظ الكوبون' : 'Coupon saved');
    } catch (err) {
      toast.error(err.response?.data?.message || (isAr ? 'حدث خطأ' : 'Error'));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (coupon) => {
    const next = coupon.isActive === false;
    try {
      await adminApi.updateCoupon(coupon._id || coupon.id, { isActive: next });
      list.reload();
      toast.success(next ? (isAr ? 'تم التفعيل' : 'Activated') : (isAr ? 'تم التعطيل' : 'Deactivated'));
    } catch (err) {
      toast.error(err.response?.data?.message || (isAr ? 'حدث خطأ' : 'Error'));
    }
  };

  const columns = [
    {
      key: 'code',
      header: isAr ? 'الكود' : 'Code',
      sortKey: 'code',
      render: (c) => <CodeCell code={c.code} isAr={isAr} onCopy={copyCode} />,
    },
    {
      key: 'discount',
      header: isAr ? 'الخصم' : 'Discount',
      render: (c) => <DiscountCell coupon={c} isAr={isAr} />,
    },
    {
      key: 'used',
      header: isAr ? 'الاستخدام' : 'Usage',
      render: (c) => <UsageCell coupon={c} isAr={isAr} />,
    },
    {
      key: 'expiry',
      header: isAr ? 'الانتهاء' : 'Expires',
      sortKey: 'expiryDate',
      render: (c) => (
        <div className="flex items-center gap-1.5 text-sm text-text">
          <Calendar className="h-3.5 w-3.5 shrink-0 text-text-muted" aria-hidden />
          <span className="tabular-nums" dir="ltr">
            {formatCouponExpiry(c.expiryDate, isAr)}
          </span>
        </div>
      ),
    },
    {
      key: 'isActive',
      header: isAr ? 'الحالة' : 'Status',
      render: (c) => <StatusBadge coupon={c} isAr={isAr} />,
    },
  ];

  const statusFilter = list.filters.isActive;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-text-muted">
            {isAr
              ? 'أنشئ أكواد خصم وتوصيل مجاني وتتبع استخدامها'
              : 'Create discount codes, free delivery offers, and track redemptions'}
          </p>
        </div>
        <Button onClick={openCreate} className="shrink-0 gap-2">
          <Plus className="h-4 w-4" aria-hidden />
          {isAr ? 'كوبون جديد' : 'New coupon'}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label={isAr ? 'إجمالي الكوبونات' : 'Total coupons'}
          value={summary.total}
          icon={Tag}
          active={statusFilter === ''}
          onClick={() => list.setFilter('isActive', '')}
        />
        <SummaryCard
          label={isAr ? 'نشطة' : 'Active'}
          value={summary.active}
          hint={isAr ? 'صالحة للاستخدام' : 'Currently redeemable'}
          icon={Percent}
          active={statusFilter === 'true'}
          onClick={() => list.setFilter('isActive', 'true')}
        />
        <SummaryCard
          label={isAr ? 'منتهية' : 'Expired'}
          value={summary.expired}
          icon={Calendar}
        />
        <SummaryCard
          label={isAr ? 'مرات الاستخدام' : 'Total redemptions'}
          value={summary.redemptions}
          icon={TrendingUp}
        />
      </div>

      <AdminListPage
        isAr={isAr}
        q={list.q}
        onSearchChange={list.setQ}
        searchPlaceholder={isAr ? 'بحث بالكود أو الوصف…' : 'Search code or label…'}
        sort={list.sort}
        onSort={list.toggleSort}
        filters={(
          <ListFilterSelect
            label={isAr ? 'الحالة' : 'Status'}
            value={list.filters.isActive}
            onChange={(v) => list.setFilter('isActive', v)}
            options={[
              { value: '', label: isAr ? 'الكل' : 'All' },
              { value: 'true', label: isAr ? 'نشط' : 'Active' },
              { value: 'false', label: isAr ? 'معطّل' : 'Inactive' },
            ]}
          />
        )}
        bulkBar={(
          <BulkActionsBar
            count={list.selectedIds.length}
            isAr={isAr}
            onActivate={() => runBulk('activate', isAr ? 'تفعيل المحدد' : 'Activate selected')}
            onDeactivate={() => runBulk('deactivate', isAr ? 'تعطيل المحدد' : 'Deactivate selected')}
            onDelete={() => runBulk('delete', isAr ? 'حذف المحدد' : 'Delete selected')}
            onClear={list.clearSelection}
          />
        )}
        columns={columns}
        data={list.data}
        loading={list.loading}
        selectable
        selectedIds={list.selectedIds}
        onToggleSelect={list.toggleSelect}
        onToggleSelectAll={list.toggleSelectAll}
        allSelected={list.allSelected}
        onRowClick={openEdit}
        rowActions={(c) => [
          { label: isAr ? 'تعديل' : 'Edit', onClick: () => openEdit(c) },
          {
            label: c.isActive !== false ? (isAr ? 'تعطيل' : 'Deactivate') : (isAr ? 'تفعيل' : 'Activate'),
            onClick: () => toggleActive(c),
          },
          {
            label: isAr ? 'نسخ الكود' : 'Copy code',
            onClick: () => copyCode(c.code),
          },
          {
            label: isAr ? 'حذف' : 'Delete',
            danger: true,
            onClick: async () => {
              const ok = await confirm({
                title: isAr ? 'حذف الكوبون' : 'Delete coupon',
                message: isAr ? `حذف ${c.code}؟` : `Delete ${c.code}?`,
                confirmLabel: isAr ? 'حذف' : 'Delete',
                variant: 'danger',
              });
              if (!ok) return;
              await adminApi.deleteCoupon(c._id || c.id);
              list.reload();
              toast.success(isAr ? 'تم الحذف' : 'Deleted');
            },
          },
        ]}
        pagination={list.pagination}
        onPageChange={list.setPage}
        emptyIcon={Tag}
        emptyTitle={isAr ? 'لا توجد كوبونات' : 'No coupons yet'}
        emptyDescription={isAr ? 'أنشئ أول كوبون خصم لعملائك' : 'Create your first coupon for customers'}
        emptyAction={(
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" aria-hidden />
            {isAr ? 'كوبون جديد' : 'New coupon'}
          </Button>
        )}
      />

      <AdminSlidePanel
        open={panelOpen}
        onClose={closePanel}
        title={editId ? (isAr ? 'تعديل الكوبون' : 'Edit coupon') : (isAr ? 'كوبون جديد' : 'New coupon')}
        subtitle={editId ? form.code : (isAr ? 'أدخل تفاصيل الكود والخصم' : 'Set code, discount, and limits')}
        isAr={isAr}
        width="max-w-xl"
      >
        <CouponEditorPanel
          key={editId || 'new'}
          form={form}
          setForm={setForm}
          onSubmit={handleSubmit}
          onCancel={closePanel}
          saving={saving}
          isAr={isAr}
          isEdit={Boolean(editId)}
        />
      </AdminSlidePanel>
    </div>
  );
}
