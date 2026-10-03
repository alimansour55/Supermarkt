import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from '../../app/router';
import {
  ArrowDown, ArrowUp, Award, ExternalLink, RefreshCw, Sparkles, Star, Tag, Wrench,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { adminApi } from '../adminApi';
import { useAdminListPage } from '../hooks/useAdminListPage';
import Button from '../../components/ui/Button';
import { AdminListPage, BulkActionsBar, ListFilterSelect } from '../components/list';
import { PageHeader, useConfirm, useToast } from '../components';
import BrandFormModal from '../components/BrandFormModal';
import { brandProductHref, getBrandLabel } from '../../utils/shopBrandHelpers';

function StatCard({ label, value, icon: Icon, tone = 'primary' }) {
  const tones = {
    primary: 'border-primary-200 bg-primary-50/60 text-primary-900',
    emerald: 'border-emerald-200 bg-emerald-50/60 text-emerald-900',
    amber: 'border-amber-200 bg-amber-50/60 text-amber-900',
    slate: 'border-border bg-surface-muted/40 text-text',
  };
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${tones[tone] || tones.primary}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{label}</p>
        {Icon && <Icon className="h-4 w-4 opacity-70" aria-hidden />}
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

function BrandPreviewGrid({ brands, isAr }) {
  if (!brands.length) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-surface-muted/30 px-4 py-8 text-center text-sm text-text-muted">
        {isAr ? 'لا توجد علامات للمعاينة' : 'No brands to preview'}
      </p>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {brands.slice(0, 12).map((brand) => (
        <div
          key={brand._id}
          className="flex min-h-[100px] flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-white p-3 shadow-sm"
        >
          {brand.logo ? (
            <img src={brand.logo} alt="" className="h-8 w-12 object-contain" />
          ) : (
            <span className="text-2xl">{brand.emoji || '🏷️'}</span>
          )}
          <span className="line-clamp-2 text-center text-xs font-bold">{getBrandLabel(brand, isAr)}</span>
          {brand.isFeatured && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
              {isAr ? 'مميز' : 'Featured'}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export default function BrandsPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const confirm = useConfirm();
  const toast = useToast();
  const [stats, setStats] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState(null);
  const [viewMode, setViewMode] = useState('table');
  const [syncing, setSyncing] = useState(false);
  const [repairing, setRepairing] = useState(false);

  const list = useAdminListPage({
    fetchFn: (params) => adminApi.getBrands(params),
    initialFilters: { isActive: '', isFeatured: '' },
    initialSort: { field: 'sortOrder', order: 'asc' },
  });

  const loadStats = useCallback(async () => {
    try {
      const { data } = await adminApi.getBrandStats();
      setStats(data.data);
    } catch {
      setStats(null);
    }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats, list.data]);

  const activePreviewBrands = useMemo(
    () => list.data.filter((b) => b.isActive !== false),
    [list.data],
  );

  const openCreateForm = () => {
    setEditingBrand(null);
    setFormOpen(true);
  };

  const openEditForm = (brand) => {
    setEditingBrand(brand);
    setFormOpen(true);
  };

  const handleFormSaved = () => {
    setFormOpen(false);
    setEditingBrand(null);
    list.reload();
    loadStats();
  };

  const runBulk = async (action, title) => {
    const ok = await confirm({ title, confirmLabel: isAr ? 'تأكيد' : 'Confirm', variant: action === 'delete' ? 'danger' : 'primary' });
    if (!ok) return;
    await adminApi.bulkBrands(list.selectedIds, action);
    list.clearSelection();
    list.reload();
    loadStats();
    toast.success(isAr ? 'تم' : 'Done');
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data } = await adminApi.syncBrandsFromProducts();
      toast.success(data.message || (isAr ? 'تم الاستيراد' : 'Imported'));
      list.reload();
      loadStats();
    } catch (error) {
      toast.error(error.message || (isAr ? 'تعذر الاستيراد' : 'Import failed'));
    } finally {
      setSyncing(false);
    }
  };

  const handleRepairLinks = async () => {
    const ok = await confirm({
      title: isAr ? 'إصلاح روابط المنتجات؟' : 'Repair product links?',
      message: isAr
        ? 'يدمج العلامات المكررة ويحدّث حقل brand في المنتجات ليطابق الأسماء الصحيحة.'
        : 'Merges duplicate brands and updates each product’s brand field to match the canonical name.',
      confirmLabel: isAr ? 'إصلاح' : 'Repair',
    });
    if (!ok) return;
    setRepairing(true);
    try {
      const { data } = await adminApi.repairProductBrandLinks({ dryRun: false });
      toast.success(data.message || (isAr ? 'تم الإصلاح' : 'Repaired'));
      list.reload();
      loadStats();
    } catch (error) {
      toast.error(error.message || (isAr ? 'تعذر الإصلاح' : 'Repair failed'));
    } finally {
      setRepairing(false);
    }
  };

  const canReorder = list.sort.field === 'sortOrder' && list.sort.order === 'asc' && list.pagination.pages <= 1;

  const moveBrand = async (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= list.data.length) return;
    const reordered = [...list.data];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    try {
      await adminApi.reorderBrands(reordered.map((b) => b._id));
      list.reload();
    } catch (error) {
      toast.error(error.message || (isAr ? 'تعذر تغيير الترتيب' : 'Could not reorder'));
    }
  };

  const columns = [
    {
      key: 'brand',
      header: isAr ? 'العلامة' : 'Brand',
      sortKey: 'nameEn',
      render: (b) => (
        <div className="flex items-center gap-3">
          {b.logo ? (
            <img src={b.logo} alt="" className="h-10 w-10 rounded-xl border border-border object-contain bg-white p-1" />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-lg">{b.emoji || '🏷️'}</span>
          )}
          <div>
            <p className="font-bold">{isAr ? b.nameAr : b.nameEn}</p>
            <p className="text-xs text-text-muted">{b.slug}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'queryValue',
      header: isAr ? 'فلتر المنتجات' : 'Product filter',
      render: (b) => <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{b.queryValue}</code>,
    },
    {
      key: 'products',
      header: isAr ? 'منتجات' : 'Products',
      render: (b) => (
        <Link to={brandProductHref(b.queryValue)} target="_blank" rel="noreferrer" className="font-semibold text-primary-600 hover:underline">
          {b.productCount ?? 0}
        </Link>
      ),
    },
    {
      key: 'flags',
      header: isAr ? 'الحالة' : 'Status',
      render: (b) => (
        <div className="flex flex-wrap gap-1">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${b.isActive !== false ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
            {b.isActive !== false ? (isAr ? 'نشط' : 'Active') : (isAr ? 'مخفي' : 'Hidden')}
          </span>
          {b.isFeatured && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              {isAr ? 'مميز' : 'Featured'}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'sortOrder',
      header: isAr ? 'الترتيب' : 'Order',
      sortKey: 'sortOrder',
      render: (b) => {
        const index = list.data.findIndex((row) => row._id === b._id);
        return (
          <div className="flex items-center gap-2">
            <span>{b.sortOrder}</span>
            {canReorder && (
              <div className="flex flex-col">
                <button
                  type="button"
                  onClick={() => moveBrand(index, -1)}
                  disabled={index <= 0}
                  className="text-text-muted hover:text-text disabled:opacity-30"
                  aria-label={isAr ? 'تحريك لأعلى' : 'Move up'}
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => moveBrand(index, 1)}
                  disabled={index === -1 || index === list.data.length - 1}
                  className="text-text-muted hover:text-text disabled:opacity-30"
                  aria-label={isAr ? 'تحريك لأسفل' : 'Move down'}
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={isAr ? 'العلامات التجارية' : 'Brands'}
        description={
          isAr
            ? 'إدارة كل العلامات — تظهر في صفحة «كل العلامات» وصفحة العلامات في الرئيسية.'
            : 'Manage all brands — shown on /brands and the homepage brand row.'
        }
        action={(
          <div className="flex flex-wrap gap-2">
            <Link
              to="/brands"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-sm font-semibold text-text shadow-sm hover:bg-surface-muted"
            >
              <ExternalLink className="h-4 w-4" aria-hidden />
              {isAr ? 'معاينة المتجر' : 'Store preview'}
            </Link>
            <Button type="button" variant="secondary" size="sm" onClick={handleSync} disabled={syncing}>
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} aria-hidden />
              {isAr ? 'استيراد من المنتجات' : 'Import from products'}
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={handleRepairLinks} disabled={repairing}>
              <Wrench className={`h-4 w-4 ${repairing ? 'animate-pulse' : ''}`} aria-hidden />
              {isAr ? 'إصلاح روابط المنتجات' : 'Repair product links'}
            </Button>
            <Button type="button" size="sm" onClick={openCreateForm}>
              {isAr ? '+ علامة جديدة' : '+ New brand'}
            </Button>
          </div>
        )}
      />

      {stats && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label={isAr ? 'إجمالي العلامات' : 'Total brands'} value={stats.total} icon={Tag} />
          <StatCard label={isAr ? 'نشطة' : 'Active'} value={stats.active} icon={Sparkles} tone="emerald" />
          <StatCard label={isAr ? 'مميزة (الرئيسية)' : 'Featured (homepage)'} value={stats.featured} icon={Star} tone="amber" />
          <StatCard label={isAr ? 'قيم في المنتجات' : 'In product catalog'} value={stats.productBrandValues} icon={Award} tone="slate" />
        </div>
      )}

      <BrandFormModal
        open={formOpen}
        isAr={isAr}
        brand={editingBrand}
        onClose={() => setFormOpen(false)}
        onSaved={handleFormSaved}
        createBrand={adminApi.createBrand}
        updateBrand={adminApi.updateBrand}
      />

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant={viewMode === 'table' ? 'primary' : 'secondary'} onClick={() => setViewMode('table')}>
          {isAr ? 'جدول' : 'Table'}
        </Button>
        <Button type="button" size="sm" variant={viewMode === 'preview' ? 'primary' : 'secondary'} onClick={() => setViewMode('preview')}>
          {isAr ? 'معاينة المتجر' : 'Store preview'}
        </Button>
      </div>

      {viewMode === 'preview' && (
        <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
          <p className="mb-4 text-sm font-bold text-text">{isAr ? 'كما يراها العميل في /brands' : 'As customers see on /brands'}</p>
          <BrandPreviewGrid brands={activePreviewBrands} isAr={isAr} />
        </div>
      )}

      {viewMode === 'table' && (
        <AdminListPage
          isAr={isAr}
          q={list.q}
          onSearchChange={list.setQ}
          searchPlaceholder={isAr ? 'بحث بالاسم أو slug...' : 'Search name or slug...'}
          sort={list.sort}
          onSort={list.toggleSort}
          filters={(
            <>
              <ListFilterSelect
                label={isAr ? 'الحالة' : 'Status'}
                value={list.filters.isActive}
                onChange={(v) => list.setFilter('isActive', v)}
                options={[
                  { value: '', label: isAr ? 'الكل' : 'All' },
                  { value: 'true', label: isAr ? 'نشط' : 'Active' },
                  { value: 'false', label: isAr ? 'مخفي' : 'Hidden' },
                ]}
              />
              <ListFilterSelect
                label={isAr ? 'مميز' : 'Featured'}
                value={list.filters.isFeatured}
                onChange={(v) => list.setFilter('isFeatured', v)}
                options={[
                  { value: '', label: isAr ? 'الكل' : 'All' },
                  { value: 'true', label: isAr ? 'مميز' : 'Featured' },
                  { value: 'false', label: isAr ? 'عادي' : 'Regular' },
                ]}
              />
            </>
          )}
          bulkBar={list.selectedIds.length > 0 ? (
            <div className="space-y-2">
              <BulkActionsBar
                count={list.selectedIds.length}
                isAr={isAr}
                onActivate={() => runBulk('activate', isAr ? 'تفعيل' : 'Activate')}
                onDeactivate={() => runBulk('deactivate', isAr ? 'إخفاء' : 'Hide')}
                onDelete={() => runBulk('delete', isAr ? 'حذف' : 'Delete')}
                onClear={list.clearSelection}
              />
              <div className="flex flex-wrap gap-2 px-4 pb-3">
                <Button type="button" size="sm" variant="secondary" onClick={() => runBulk('feature', isAr ? 'تمييز' : 'Feature')}>
                  {isAr ? 'تمييز للرئيسية' : 'Mark featured'}
                </Button>
                <Button type="button" size="sm" variant="secondary" onClick={() => runBulk('unfeature', isAr ? 'إلغاء التمييز' : 'Unfeature')}>
                  {isAr ? 'إلغاء التمييز' : 'Unfeature'}
                </Button>
              </div>
            </div>
          ) : null}
          columns={columns}
          data={list.data}
          loading={list.loading}
          selectable
          selectedIds={list.selectedIds}
          onToggleSelect={list.toggleSelect}
          onToggleSelectAll={list.toggleSelectAll}
          allSelected={list.allSelected}
          pagination={list.pagination}
          onPageChange={list.setPage}
          emptyIcon={Tag}
          emptyTitle={isAr ? 'لا توجد علامات تجارية بعد' : 'No brands yet'}
          emptyDescription={isAr ? 'ابدأ بإنشاء علامة جديدة أو استوردها من المنتجات الحالية.' : 'Create your first brand, or import one from existing products.'}
          emptyAction={<Button type="button" size="sm" onClick={openCreateForm}>{isAr ? '+ علامة جديدة' : '+ New brand'}</Button>}
          rowActions={(b) => [
            { label: isAr ? 'تعديل' : 'Edit', onClick: () => openEditForm(b) },
            {
              label: isAr ? 'منتجات' : 'Products',
              onClick: () => window.open(brandProductHref(b.queryValue), '_blank'),
            },
            {
              label: isAr ? 'حذف' : 'Delete',
              variant: 'danger',
              onClick: async () => {
                const ok = await confirm({ title: isAr ? 'حذف العلامة؟' : 'Delete brand?', variant: 'danger' });
                if (!ok) return;
                await adminApi.deleteBrand(b._id);
                list.reload();
                loadStats();
              },
            },
          ]}
        />
      )}
    </div>
  );
}
