import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Award, ExternalLink, RefreshCw, Sparkles, Star, Tag,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { adminApi } from '../adminApi';
import { useAdminListPage } from '../hooks/useAdminListPage';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Textarea from '../../components/ui/Textarea';
import { AdminListPage, BulkActionsBar, ListFilterSelect } from '../components/list';
import { PageHeader, useConfirm, useToast } from '../components';
import { brandProductHref, getBrandLabel } from '../../utils/shopBrandHelpers';

const EMPTY_FORM = {
  nameAr: '',
  nameEn: '',
  slug: '',
  queryValue: '',
  emoji: '🏷️',
  logo: '',
  descriptionAr: '',
  descriptionEn: '',
  website: '',
  sortOrder: 0,
  isActive: true,
  isFeatured: false,
};

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
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [clearLogo, setClearLogo] = useState(false);
  const [viewMode, setViewMode] = useState('table');
  const [syncing, setSyncing] = useState(false);

  const list = useAdminListPage({
    fetchFn: (params) => adminApi.getBrands(params),
    initialFilters: { isActive: '', isFeatured: '' },
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

  const buildPayload = () => {
    if (logoFile || clearLogo) {
      const fd = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        if (value !== undefined && value !== null) fd.append(key, String(value));
      });
      if (logoFile) fd.append('logo', logoFile);
      if (clearLogo) fd.append('clearLogo', 'true');
      return fd;
    }
    return { ...form, sortOrder: Number(form.sortOrder) || 0 };
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditId(null);
    setShowForm(false);
    setLogoFile(null);
    setLogoPreview('');
    setClearLogo(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = buildPayload();
      if (editId) await adminApi.updateBrand(editId, payload);
      else await adminApi.createBrand(payload);
      toast.success(isAr ? 'تم حفظ العلامة' : 'Brand saved');
      resetForm();
      list.reload();
      loadStats();
    } catch (error) {
      toast.error(error.message || error.response?.data?.message || (isAr ? 'تعذر الحفظ' : 'Could not save'));
    }
  };

  const handleEdit = (brand) => {
    setEditId(brand._id);
    setForm({
      nameAr: brand.nameAr || '',
      nameEn: brand.nameEn || '',
      slug: brand.slug || '',
      queryValue: brand.queryValue || '',
      emoji: brand.emoji || '🏷️',
      logo: brand.logo || '',
      descriptionAr: brand.descriptionAr || '',
      descriptionEn: brand.descriptionEn || '',
      website: brand.website || '',
      sortOrder: brand.sortOrder ?? 0,
      isActive: brand.isActive !== false,
      isFeatured: !!brand.isFeatured,
    });
    setLogoPreview(brand.logo || '');
    setLogoFile(null);
    setClearLogo(false);
    setShowForm(true);
  };

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setClearLogo(false);
    setLogoPreview(URL.createObjectURL(file));
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
    { key: 'sortOrder', header: isAr ? 'الترتيب' : 'Order', sortKey: 'sortOrder' },
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
            <Button type="button" size="sm" onClick={() => { resetForm(); setShowForm(true); }}>
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

      {showForm && (
        <form onSubmit={handleSubmit} className="grid gap-4 rounded-2xl border border-border bg-white p-6 shadow-sm lg:grid-cols-2">
          <div className="lg:col-span-2 rounded-xl bg-violet-50 px-4 py-3 text-sm text-violet-950">
            {isAr
              ? '«قيمة الفلتر» يجب أن تطابق حقل brand في المنتجات — مثل Juhayna أو Pampers.'
              : 'Filter value must match the product brand field — e.g. Juhayna or Pampers.'}
          </div>
          <Input label={isAr ? 'الاسم (عربي)' : 'Name AR'} value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} required />
          <Input label={isAr ? 'الاسم (EN)' : 'Name EN'} value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} required />
          <Input label="Slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="juhayna" />
          <Input
            label={isAr ? 'قيمة فلتر المنتجات' : 'Product filter value'}
            value={form.queryValue}
            onChange={(e) => setForm({ ...form, queryValue: e.target.value })}
            placeholder={form.nameEn || 'Juhayna'}
          />
          <Input label={isAr ? 'أيقونة' : 'Emoji'} value={form.emoji} onChange={(e) => setForm({ ...form, emoji: e.target.value })} maxLength={4} />
          <Input label={isAr ? 'الترتيب' : 'Sort order'} type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} />
          <Input label={isAr ? 'الموقع (اختياري)' : 'Website (optional)'} value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} dir="ltr" className="lg:col-span-2" />
          <Textarea label={isAr ? 'وصف عربي' : 'Description AR'} value={form.descriptionAr} onChange={(e) => setForm({ ...form, descriptionAr: e.target.value })} rows={2} />
          <Textarea label={isAr ? 'وصف EN' : 'Description EN'} value={form.descriptionEn} onChange={(e) => setForm({ ...form, descriptionEn: e.target.value })} rows={2} />

          <div className="lg:col-span-2 space-y-3 rounded-xl border border-border bg-surface-muted/20 p-4">
            <p className="text-sm font-bold">{isAr ? 'شعار العلامة' : 'Brand logo'}</p>
            <Input label={isAr ? 'رابط الشعار' : 'Logo URL'} value={form.logo} onChange={(e) => { setForm({ ...form, logo: e.target.value }); setLogoPreview(e.target.value); setLogoFile(null); setClearLogo(false); }} dir="ltr" />
            <input type="file" accept="image/*" onChange={handleLogoChange} className="block w-full text-sm" />
            {(logoPreview || form.logo) && !clearLogo && (
              <div className="flex items-center gap-3">
                <img src={logoPreview || form.logo} alt="" className="h-16 w-16 rounded-xl border border-border object-contain bg-white p-1" />
                <Button type="button" variant="secondary" size="sm" onClick={() => { setClearLogo(true); setLogoFile(null); setLogoPreview(''); setForm({ ...form, logo: '' }); }}>
                  {isAr ? 'إزالة الشعار' : 'Remove logo'}
                </Button>
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
            {isAr ? 'نشطة على الموقع' : 'Active on storefront'}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isFeatured} onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })} />
            {isAr ? 'مميزة — تُفضّل في صف الرئيسية' : 'Featured — preferred in homepage row'}
          </label>

          <div className="flex gap-3 lg:col-span-2">
            <Button type="submit">{isAr ? 'حفظ العلامة' : 'Save brand'}</Button>
            <Button type="button" variant="secondary" onClick={resetForm}>{isAr ? 'إلغاء' : 'Cancel'}</Button>
          </div>
        </form>
      )}

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
          rowActions={(b) => [
            { label: isAr ? 'تعديل' : 'Edit', onClick: () => handleEdit(b) },
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
