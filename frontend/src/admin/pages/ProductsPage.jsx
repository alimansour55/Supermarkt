import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Download, Package } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { adminApi } from '../adminApi';
import { useAdminListPage } from '../hooks/useAdminListPage';
import { downloadBlob } from '../utils/downloadBlob';
import Button from '../../components/ui/Button';
import { formatPrice } from '../../utils/formatters';
import { AdminListPage, BulkActionsBar, ListFilterSelect } from '../components/list';
import { useConfirm, useToast } from '../components';

export default function ProductsPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const navigate = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();
  const [categories, setCategories] = useState([]);
  const [exporting, setExporting] = useState(false);

  const list = useAdminListPage({
    fetchFn: (params) => adminApi.getProducts(params),
    initialFilters: { category: '', isActive: '', stock: '' },
  });

  useEffect(() => {
    adminApi.getCategories({ limit: 200 }).then(({ data }) => setCategories(data.data));
  }, []);

  const runBulk = async (action, title) => {
    const ok = await confirm({
      title,
      message: isAr ? `تطبيق على ${list.selectedIds.length} منتج؟` : `Apply to ${list.selectedIds.length} products?`,
      confirmLabel: isAr ? 'تأكيد' : 'Confirm',
      cancelLabel: isAr ? 'إلغاء' : 'Cancel',
      variant: action === 'delete' ? 'danger' : 'primary',
    });
    if (!ok) return;
    await adminApi.bulkProducts(list.selectedIds, action);
    list.clearSelection();
    list.reload();
    toast.success(isAr ? 'تم التحديث' : 'Updated');
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const { data } = await adminApi.exportProducts(list.queryParams);
      downloadBlob(data, 'products.csv');
    } catch {
      toast.error(isAr ? 'فشل التصدير' : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleDuplicate = async (id) => {
    const { data } = await adminApi.duplicateProduct(id);
    toast.success(isAr ? 'تم نسخ المنتج' : 'Product duplicated');
    navigate(`/admin/products/${data.data._id}/edit`);
  };

  const handleDeleteOne = async (id) => {
    const ok = await confirm({
      title: isAr ? 'حذف المنتج' : 'Delete product',
      confirmLabel: isAr ? 'حذف' : 'Delete',
      cancelLabel: isAr ? 'إلغاء' : 'Cancel',
    });
    if (!ok) return;
    await adminApi.deleteProduct(id);
    list.reload();
  };

  const columns = [
    {
      key: 'product',
      header: isAr ? 'المنتج' : 'Product',
      sortKey: 'nameEn',
      render: (p) => (
        <div className="flex items-center gap-2">
          <span className="text-xl">{p.emoji || '📦'}</span>
          <div>
            <p className="font-medium">{isAr ? p.nameAr || p.name : p.nameEn}</p>
            <p className="text-xs text-text-muted">{p.categorySlug}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'price',
      header: isAr ? 'سعر البيع' : 'Selling',
      sortKey: 'price',
      render: (p) => formatPrice(p.price),
    },
    {
      key: 'wholesale',
      header: isAr ? 'سعر الجملة' : 'Wholesale',
      render: (p) => formatPrice(p.wholesalePrice ?? 0),
    },
    {
      key: 'profit',
      header: isAr ? 'الربح/وحدة' : 'Profit/unit',
      render: (p) => {
        const profit = (p.price ?? 0) - (p.wholesalePrice ?? 0);
        return (
          <span className={profit >= 0 ? 'text-emerald-700 font-medium' : 'text-red-600 font-medium'}>
            {formatPrice(profit)}
          </span>
        );
      },
    },
    {
      key: 'stock',
      header: isAr ? 'المخزون' : 'Stock',
      sortKey: 'stock',
      render: (p) => (
        <span className={p.stock <= 10 ? 'font-bold text-red-600' : ''}>
          {p.stock}
          {p.stock <= 10 && p.stock > 0 ? ' ⚠' : ''}
        </span>
      ),
    },
    {
      key: 'status',
      header: isAr ? 'الحالة' : 'Status',
      render: (p) => (
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.isActive ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
          {p.isActive ? (isAr ? 'نشط' : 'Active') : (isAr ? 'معطل' : 'Inactive')}
        </span>
      ),
    },
  ];

  return (
    <AdminListPage
      isAr={isAr}
      q={list.q}
      onSearchChange={list.setQ}
      searchPlaceholder={isAr ? 'بحث...' : 'Search...'}
      sort={list.sort}
      onSort={list.toggleSort}
      actions={(
        <>
          <Button variant="secondary" size="sm" onClick={handleExport} disabled={exporting}>
            <Download className="h-4 w-4" />
            {isAr ? 'تصدير CSV' : 'Export CSV'}
          </Button>
          <Link to="/admin/products/new">
            <Button size="sm">{isAr ? '+ إضافة' : '+ Add'}</Button>
          </Link>
        </>
      )}
      filters={(
        <>
          <ListFilterSelect
            label={isAr ? 'القسم' : 'Category'}
            value={list.filters.category}
            onChange={(v) => list.setFilter('category', v)}
            options={[
              { value: '', label: isAr ? 'كل الأقسام' : 'All categories' },
              ...categories.map((c) => ({
                value: c._id,
                label: isAr ? c.nameAr : c.nameEn,
              })),
            ]}
          />
          <ListFilterSelect
            label={isAr ? 'الحالة' : 'Status'}
            value={list.filters.isActive}
            onChange={(v) => list.setFilter('isActive', v)}
            options={[
              { value: '', label: isAr ? 'كل الحالات' : 'All statuses' },
              { value: 'true', label: isAr ? 'نشط' : 'Active' },
              { value: 'false', label: isAr ? 'معطل' : 'Inactive' },
            ]}
          />
          <ListFilterSelect
            label={isAr ? 'المخزون' : 'Stock'}
            value={list.filters.stock}
            onChange={(v) => list.setFilter('stock', v)}
            options={[
              { value: '', label: isAr ? 'كل المخزون' : 'All stock' },
              { value: 'low', label: isAr ? 'منخفض (≤10)' : 'Low (≤10)' },
              { value: 'out', label: isAr ? 'نفد' : 'Out of stock' },
              { value: 'in', label: isAr ? 'متوفر' : 'In stock' },
            ]}
          />
        </>
      )}
      bulkBar={(
        <BulkActionsBar
          count={list.selectedIds.length}
          isAr={isAr}
          onActivate={() => runBulk('activate', isAr ? 'تفعيل المنتجات' : 'Activate products')}
          onDeactivate={() => runBulk('deactivate', isAr ? 'تعطيل المنتجات' : 'Deactivate products')}
          onDelete={() => runBulk('delete', isAr ? 'حذف المنتجات' : 'Delete products')}
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
      rowActions={(p) => [
        { label: isAr ? 'تعديل' : 'Edit', onClick: () => navigate(`/admin/products/${p._id}/edit`) },
        { label: isAr ? 'نسخ' : 'Duplicate', onClick: () => handleDuplicate(p._id) },
        { label: isAr ? 'حذف' : 'Delete', danger: true, onClick: () => handleDeleteOne(p._id) },
      ]}
      pagination={list.pagination}
      onPageChange={list.setPage}
      emptyIcon={Package}
      emptyTitle={isAr ? 'لا توجد منتجات' : 'No products'}
      emptyDescription={isAr ? 'أضف منتجاً أو غيّر الفلاتر' : 'Add a product or adjust filters'}
      emptyAction={(
        <Link to="/admin/products/new">
          <Button size="sm">{isAr ? 'إضافة منتج' : 'Add product'}</Button>
        </Link>
      )}
    />
  );
}
