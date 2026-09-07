import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Download, Package, PackageX, Upload } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { adminApi } from '../adminApi';
import { useAdminListPage } from '../hooks/useAdminListPage';
import { downloadBlob } from '../utils/downloadBlob';
import Button from '../../components/ui/Button';
import { formatPrice } from '../../utils/formatters';
import { pickProductImage } from '../../utils/imageHelpers';
import { AdminListPage, BulkActionsBar, ListFilterSelect } from '../components/list';
import { useConfirm, useToast } from '../components';
import AdminProductCategoryFilter from '../components/AdminProductCategoryFilter';
import BulkProductCategoryPanel from '../components/BulkProductCategoryPanel';
import ProductCategoryIntegrityPanel from '../components/ProductCategoryIntegrityPanel';
import ProductRowCategory from '../components/ProductRowCategory';
import ProductStockFilter from '../components/ProductStockFilter';
import { useAdminStockAlertThreshold } from '../hooks/useAdminStockAlertThreshold';
import { localizeAdminApiError } from '../constants/productCategoryErrors';
import { DEFAULT_STOCK_THRESHOLD } from '../utils/stockThreshold';

function ProductThumbnail({ product }) {
  const [failed, setFailed] = useState(false);
  const src = !failed ? pickProductImage(product) : null;

  if (src) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className="h-11 w-11 shrink-0 rounded-xl border border-border bg-white object-cover"
      />
    );
  }

  return (
    <div
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-gradient-to-br from-slate-50 to-slate-100 text-xl"
      aria-hidden
    >
      {product.emoji || '📦'}
    </div>
  );
}

export default function ProductsPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const navigate = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();
  const [categories, setCategories] = useState([]);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [bulkCategoryOpen, setBulkCategoryOpen] = useState(false);
  const [bulkCategoryApplying, setBulkCategoryApplying] = useState(false);
  const fileInputRef = useRef(null);
  const { thresholdString, ready: thresholdReady } = useAdminStockAlertThreshold();

  const list = useAdminListPage({
    fetchFn: (params) => adminApi.getProducts(params),
    initialFilters: {
      mainCategory: '',
      subCategory: '',
      isActive: '',
      isOurProduct: '',
      stock: '',
      stockMax: thresholdString,
    },
  });

  useEffect(() => {
    if (!thresholdReady) return;
    list.patchFilters({ stockMax: thresholdString });
  }, [thresholdReady, thresholdString]);

  const stockThreshold = Number(list.filters.stockMax) || DEFAULT_STOCK_THRESHOLD;

  useEffect(() => {
    adminApi.getCategories({ limit: 500 }).then(({ data }) => setCategories(data.data || []));
  }, []);

  const runBulk = async (action, title, payload = {}) => {
    const ok = await confirm({
      title,
      message: isAr ? `تطبيق على ${list.selectedIds.length} منتج؟` : `Apply to ${list.selectedIds.length} products?`,
      confirmLabel: isAr ? 'تأكيد' : 'Confirm',
      cancelLabel: isAr ? 'إلغاء' : 'Cancel',
      variant: action === 'delete' ? 'danger' : 'primary',
    });
    if (!ok) return;
    try {
      await adminApi.bulkProducts(list.selectedIds, action, payload);
      list.clearSelection();
      list.reload();
      toast.success(isAr ? 'تم التحديث' : 'Updated');
    } catch (err) {
      toast.error(err.response?.data?.message || (isAr ? 'فشل التحديث' : 'Update failed'));
    }
  };

  const handleBulkCategoryApply = async (categoryPayload) => {
    setBulkCategoryApplying(true);
    try {
      await adminApi.bulkProducts(list.selectedIds, 'setCategory', categoryPayload);
      list.clearSelection();
      list.reload();
      setBulkCategoryOpen(false);
      toast.success(isAr ? 'تم تحديث أقسام المنتجات' : 'Product categories updated');
    } catch (err) {
      toast.error(localizeAdminApiError(
        err,
        isAr,
        'Could not change categories — check the selection and try again.',
        'تعذّر تغيير الأقسام — تحقق من الاختيار وحاول مرة أخرى.',
      ));
    } finally {
      setBulkCategoryApplying(false);
    }
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

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const csv = await file.text();
      const { data } = await adminApi.importProducts(csv);
      list.reload();
      toast.success(
        isAr
          ? `تم: ${data.created} جديد، ${data.updated} محدّث`
          : `Done: ${data.created} created, ${data.updated} updated`,
      );
      if (data.errors?.length) {
        const first = data.errors[0];
        const detail = first?.message
          ? (isAr ? ` — ${first.message}` : ` — ${first.message}`)
          : '';
        toast.error(
          `${data.errors.length} ${isAr ? 'صفوف فشلت' : 'rows failed'}${detail}`,
        );
      }
    } catch (err) {
      toast.error(err.response?.data?.message || (isAr ? 'فشل الاستيراد' : 'Import failed'));
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const handleDuplicate = async (id) => {
    const { data } = await adminApi.duplicateProduct(id);
    toast.success(isAr ? 'تم إنشاء نسخة — عدّل ما تحتاج ثم احفظ' : 'Copy created — edit what you need, then save');
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
        <div className="flex min-w-0 items-center gap-3">
          <ProductThumbnail product={p} />
          <div className="min-w-0">
            <p className="truncate font-medium">{isAr ? p.nameAr || p.name : p.nameEn}</p>
            <p className="truncate text-xs text-text-muted">{p.slug}</p>
            {p.isOurProduct && (
              <span className="mt-1 inline-flex rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-semibold text-primary-800">
                {isAr ? 'منتجنا' : 'Our product'}
              </span>
            )}
          </div>
        </div>
      ),
      cellClassName: 'max-w-[13rem] sm:max-w-[16rem] md:max-w-[20rem]',
    },
    {
      key: 'category',
      header: isAr ? 'القسم' : 'Category',
      render: (p) => <ProductRowCategory product={p} isAr={isAr} />,
      headerClassName: 'hidden sm:table-cell',
      cellClassName: 'hidden sm:table-cell',
    },
    {
      key: 'sku',
      header: 'SKU',
      render: (p) => <span className="font-mono text-xs">{p.sku || '—'}</span>,
      headerClassName: 'hidden lg:table-cell',
      cellClassName: 'hidden lg:table-cell',
    },
    {
      key: 'price',
      header: isAr ? 'سعر البيع' : 'Selling',
      sortKey: 'price',
      render: (p) => <span className="font-medium tabular-nums">{formatPrice(p.price)}</span>,
    },
    {
      key: 'wholesale',
      header: isAr ? 'سعر الجملة' : 'Wholesale',
      render: (p) => <span className="tabular-nums">{formatPrice(p.wholesalePrice ?? 0)}</span>,
      headerClassName: 'hidden xl:table-cell',
      cellClassName: 'hidden xl:table-cell',
    },
    {
      key: 'profit',
      header: isAr ? 'الربح/وحدة' : 'Profit/unit',
      render: (p) => {
        const profit = (p.price ?? 0) - (p.wholesalePrice ?? 0);
        return (
          <span className={`font-medium tabular-nums ${profit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
            {formatPrice(profit)}
          </span>
        );
      },
      headerClassName: 'hidden xl:table-cell',
      cellClassName: 'hidden xl:table-cell',
    },
    {
      key: 'stock',
      header: isAr ? 'المخزون' : 'Stock',
      sortKey: 'stock',
      render: (p) => (
        <span className={`tabular-nums ${
          p.stock <= 0
            ? 'font-bold text-red-600'
            : p.stock <= stockThreshold
              ? 'font-bold text-amber-700'
              : ''
        }`}>
          {p.stock}
          {p.stock <= 0 ? ' ✕' : p.stock <= stockThreshold ? ' ⚠' : ''}
        </span>
      ),
    },
    {
      key: 'status',
      header: isAr ? 'الحالة' : 'Status',
      render: (p) => (
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${p.isActive ? 'bg-green-100 text-green-800 ring-green-200' : 'bg-slate-100 text-slate-600 ring-slate-200'}`}>
          {p.isActive ? (isAr ? 'نشط' : 'Active') : (isAr ? 'معطل' : 'Inactive')}
        </span>
      ),
      headerClassName: 'hidden md:table-cell',
      cellClassName: 'hidden md:table-cell',
    },
  ];

  return (
    <>
      <ProductCategoryIntegrityPanel isAr={isAr} onRepaired={list.reload} />
      <AdminListPage
        isAr={isAr}
        q={list.q}
        onSearchChange={list.setQ}
        searchPlaceholder={isAr ? 'بحث...' : 'Search...'}
        sort={list.sort}
        onSort={list.toggleSort}
        actions={(
          <>
            <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleImportFile} />
            <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} disabled={importing}>
              <Upload className="h-4 w-4" />
              {isAr ? 'استيراد CSV' : 'Import CSV'}
            </Button>
            <Button variant="secondary" size="sm" onClick={handleExport} disabled={exporting}>
              <Download className="h-4 w-4" />
              {isAr ? 'تصدير CSV' : 'Export CSV'}
            </Button>
            <Link to="/admin/stock-alerts">
              <Button variant="secondary" size="sm">
                <PackageX className="h-4 w-4" />
                {isAr ? 'تنبيهات المخزون' : 'Stock alerts'}
              </Button>
            </Link>
            <Link to="/admin/products/new">
              <Button size="sm">{isAr ? '+ إضافة' : '+ Add'}</Button>
            </Link>
          </>
        )}
        filters={(
          <>
            <AdminProductCategoryFilter
              categories={categories}
              mainCategory={list.filters.mainCategory}
              subCategory={list.filters.subCategory}
              isAr={isAr}
              onChange={(next) => list.patchFilters(next)}
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
              label={isAr ? 'منتجنا' : 'Our product'}
              value={list.filters.isOurProduct}
              onChange={(v) => list.setFilter('isOurProduct', v)}
              options={[
                { value: '', label: isAr ? 'الكل' : 'All' },
                { value: 'true', label: isAr ? 'منتجاتنا فقط' : 'Our products only' },
                { value: 'false', label: isAr ? 'غير منتجاتنا' : 'Not our products' },
              ]}
            />
            <ProductStockFilter
              isAr={isAr}
              stock={list.filters.stock}
              stockMax={list.filters.stockMax}
              onStockChange={(v) => list.setFilter('stock', v)}
              onStockMaxChange={(v) => list.setFilter('stockMax', v)}
            />
          </>
        )}
        bulkBar={(
          <BulkActionsBar
            count={list.selectedIds.length}
            isAr={isAr}
            onChangeCategory={() => setBulkCategoryOpen(true)}
            onMarkOurProduct={() => runBulk('markOurProduct', isAr ? 'تعيين كمنتجنا' : 'Mark as our product')}
            onUnmarkOurProduct={() => runBulk('unmarkOurProduct', isAr ? 'إلغاء منتجنا' : 'Unmark our product')}
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

      <BulkProductCategoryPanel
        open={bulkCategoryOpen}
        onClose={() => setBulkCategoryOpen(false)}
        count={list.selectedIds.length}
        categories={categories}
        isAr={isAr}
        applying={bulkCategoryApplying}
        onApply={handleBulkCategoryApply}
      />
    </>
  );
}
