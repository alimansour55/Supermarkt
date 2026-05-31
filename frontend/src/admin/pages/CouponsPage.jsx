import { useState } from 'react';
import { Tag } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { adminApi } from '../adminApi';
import { useAdminListPage } from '../hooks/useAdminListPage';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { AdminListPage, BulkActionsBar, ListFilterSelect } from '../components/list';
import { useConfirm, useToast } from '../components';

const emptyCoupon = {
  code: '',
  discountType: 'percent',
  discountValue: 10,
  minSubtotal: 0,
  expiryDate: '',
  usageLimit: '',
  labelAr: '',
  labelEn: '',
  isActive: true,
};

export default function CouponsPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const confirm = useConfirm();
  const toast = useToast();
  const [form, setForm] = useState(emptyCoupon);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);

  const list = useAdminListPage({
    fetchFn: (params) => adminApi.getCoupons(params),
    initialFilters: { isActive: '' },
  });

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
    const payload = {
      ...form,
      discountValue: Number(form.discountValue),
      minSubtotal: Number(form.minSubtotal) || 0,
      usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
    };
    if (editId) await adminApi.updateCoupon(editId, payload);
    else await adminApi.createCoupon(payload);
    setShowForm(false);
    setEditId(null);
    setForm(emptyCoupon);
    list.reload();
  };

  const handleEdit = (c) => {
    setEditId(c._id);
    setForm({
      code: c.code,
      discountType: c.discountType || c.type,
      discountValue: c.discountValue ?? c.value,
      minSubtotal: c.minSubtotal || 0,
      expiryDate: c.expiryDate ? c.expiryDate.slice(0, 10) : '',
      usageLimit: c.usageLimit || '',
      labelAr: c.labelAr || '',
      labelEn: c.labelEn || '',
      isActive: c.isActive !== false,
    });
    setShowForm(true);
  };

  const columns = [
    {
      key: 'code',
      header: 'Code',
      sortKey: 'code',
      render: (c) => <span className="font-bold">{c.code}</span>,
    },
    {
      key: 'discount',
      header: isAr ? 'الخصم' : 'Discount',
      render: (c) => `${c.discountType} — ${c.discountValue ?? c.value}`,
    },
    {
      key: 'used',
      header: isAr ? 'الاستخدام' : 'Used',
      render: (c) => `${c.usedCount || 0}${c.usageLimit ? ` / ${c.usageLimit}` : ''}`,
    },
    {
      key: 'isActive',
      header: isAr ? 'الحالة' : 'Status',
      render: (c) => (
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${c.isActive !== false ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
          {c.isActive !== false ? (isAr ? 'نشط' : 'Active') : (isAr ? 'معطل' : 'Inactive')}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {showForm && (
        <form onSubmit={handleSubmit} className="grid gap-4 rounded-2xl border border-border bg-white p-6 sm:grid-cols-2">
          <Input label="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} required disabled={!!editId} />
          <div>
            <label className="mb-1.5 block text-sm font-medium">{isAr ? 'النوع' : 'Type'}</label>
            <select className="w-full rounded-xl border border-border px-4 py-2.5" value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value })}>
              <option value="percent">{isAr ? 'نسبة' : 'Percent'}</option>
              <option value="fixed">{isAr ? 'مبلغ ثابت' : 'Fixed'}</option>
              <option value="free_delivery">{isAr ? 'توصيل مجاني' : 'Free delivery'}</option>
            </select>
          </div>
          <Input label={isAr ? 'القيمة' : 'Value'} type="number" value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: e.target.value })} required />
          <Input label={isAr ? 'حد أدنى' : 'Min subtotal'} type="number" value={form.minSubtotal} onChange={(e) => setForm({ ...form, minSubtotal: e.target.value })} />
          <Input label={isAr ? 'تاريخ الانتهاء' : 'Expiry'} type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} required />
          <Input label={isAr ? 'حد الاستخدام' : 'Usage limit'} type="number" value={form.usageLimit} onChange={(e) => setForm({ ...form, usageLimit: e.target.value })} />
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
            {isAr ? 'كوبون نشط' : 'Active coupon'}
          </label>
          <div className="flex gap-3 sm:col-span-2">
            <Button type="submit">{isAr ? 'حفظ' : 'Save'}</Button>
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>{isAr ? 'إلغاء' : 'Cancel'}</Button>
          </div>
        </form>
      )}

      <AdminListPage
        isAr={isAr}
        q={list.q}
        onSearchChange={list.setQ}
        searchPlaceholder={isAr ? 'بحث بالكود...' : 'Search code...'}
        sort={list.sort}
        onSort={list.toggleSort}
        actions={(
          <Button size="sm" onClick={() => { setShowForm(true); setEditId(null); setForm(emptyCoupon); }}>
            {isAr ? '+ كوبون' : '+ Coupon'}
          </Button>
        )}
        filters={(
          <ListFilterSelect
            label={isAr ? 'الحالة' : 'Status'}
            value={list.filters.isActive}
            onChange={(v) => list.setFilter('isActive', v)}
            options={[
              { value: '', label: isAr ? 'الكل' : 'All' },
              { value: 'true', label: isAr ? 'نشط' : 'Active' },
              { value: 'false', label: isAr ? 'معطل' : 'Inactive' },
            ]}
          />
        )}
        bulkBar={(
          <BulkActionsBar
            count={list.selectedIds.length}
            isAr={isAr}
            onActivate={() => runBulk('activate', isAr ? 'تفعيل' : 'Activate')}
            onDeactivate={() => runBulk('deactivate', isAr ? 'تعطيل' : 'Deactivate')}
            onDelete={() => runBulk('delete', isAr ? 'حذف' : 'Delete')}
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
        rowActions={(c) => [
          { label: isAr ? 'تعديل' : 'Edit', onClick: () => handleEdit(c) },
          {
            label: isAr ? 'حذف' : 'Delete',
            danger: true,
            onClick: async () => {
              const ok = await confirm({ title: isAr ? 'حذف' : 'Delete', confirmLabel: isAr ? 'حذف' : 'Delete' });
              if (!ok) return;
              await adminApi.deleteCoupon(c._id);
              list.reload();
            },
          },
        ]}
        pagination={list.pagination}
        onPageChange={list.setPage}
        emptyIcon={Tag}
        emptyTitle={isAr ? 'لا توجد كوبونات' : 'No coupons'}
        emptyDescription={isAr ? 'أنشئ كوبوناً جديداً' : 'Create a coupon'}
      />
    </div>
  );
}
