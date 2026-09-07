import { useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Eye,
  Grid3X3,
  HelpCircle,
  LayoutList,
  Pause,
  Pencil,
  Play,
  RefreshCw,
  Sparkles,
  Upload,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { adminApi } from '../adminApi';
import { useAdminListPage } from '../hooks/useAdminListPage';
import { AdminListPage, BulkActionsBar, ListFilterSelect } from '../components/list';
import { useConfirm, useToast } from '../components';
import Input from '../../components/ui/Input';
import AdminSlidePanel from './AdminSlidePanel';
import AdminProductCategoryFilter from './AdminProductCategoryFilter';
import CatalogOfferEditPanel from './CatalogOfferEditPanel';
import { pickProductImage } from '../../utils/imageHelpers';

const QUICK_FILTERS = [
  { key: 'offerActive', value: 'true', labelAr: 'نشطة', labelEn: 'Active' },
  { key: 'offerActive', value: 'false', labelAr: 'متوقفة', labelEn: 'Paused' },
  { key: 'source', value: 'legacy', labelAr: 'من المنتجات', labelEn: 'From products' },
  { key: 'source', value: 'managed', labelAr: 'حملات', labelEn: 'Campaigns' },
  { key: 'minDiscount', value: '20', labelAr: 'خصم +20%', labelEn: '20%+ off' },
];

function ProductThumb({ row }) {
  const image = pickProductImage(row);
  const isUrl = image && (String(image).startsWith('http') || String(image).startsWith('/'));
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-white">
      {isUrl ? (
        <img src={image} alt="" className="h-full w-full object-contain p-1" loading="lazy" />
      ) : (
        <span className="text-xl">{row.emoji || '🛍️'}</span>
      )}
    </div>
  );
}

function OfferGridCard({ row, isAr, onEdit, onToggle }) {
  const discount = row.discount || 0;
  return (
    <div
      className={`group flex flex-col rounded-2xl border bg-white p-4 shadow-sm transition hover:shadow-md ${
        row.offerActive !== false ? 'border-border' : 'border-slate-200 opacity-75'
      }`}
    >
      <div className="mb-3 flex items-start gap-3">
        <ProductThumb row={row} />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-bold text-text">{isAr ? row.nameAr : row.nameEn}</p>
          <p className="text-[10px] text-text-muted">{row.brand}</p>
        </div>
        {discount > 0 && (
          <span className="shrink-0 rounded-lg bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">-{discount}%</span>
        )}
      </div>
      <div className="mb-3 flex items-baseline gap-2 tabular-nums">
        <span className="text-lg font-black text-primary-700">{row.price}</span>
        <span className="text-xs text-text-muted">EGP</span>
        {row.oldPrice > row.price && (
          <span className="text-xs text-text-muted line-through">{row.oldPrice}</span>
        )}
      </div>
      <div className="mt-auto flex gap-2">
        <button
          type="button"
          onClick={() => onEdit(row)}
          className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-orange-600 py-2 text-xs font-semibold text-white hover:bg-orange-700"
        >
          <Pencil className="h-3.5 w-3.5" />
          {isAr ? 'تعديل' : 'Edit'}
        </button>
        <button
          type="button"
          onClick={() => onToggle(row)}
          className="rounded-lg border border-border p-2 hover:bg-slate-50"
        >
          {row.offerActive !== false ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        {row.slug && (
          <a
            href={`/products/${row.slug}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-border p-2 hover:bg-slate-50"
          >
            <Eye className="h-4 w-4" />
          </a>
        )}
      </div>
    </div>
  );
}

function HelpGuide({ isAr, open, onToggle }) {
  const tips = isAr ? [
    { title: 'تعديل سريع', body: 'انقر على أي صف أو «تعديل» — يفتح لوحة جانبية بدون إعادة تحميل الصفحة.' },
    { title: 'تفعيل / إيقاف', body: '⏸ يخفي العرض من المتجر فوراً. السعر يبقى كما هو.' },
    { title: 'خصم سريع', body: 'في لوحة التعديل: اختر -10% أو -20% لحساب السعر تلقائياً.' },
    { title: 'حملات متقدمة', body: '1+1 وجدولة — من تبويب «حملات العروض» أو «تحويل الكل».' },
  ] : [
    { title: 'Quick edit', body: 'Click any row or Edit — opens a side panel without reloading the page.' },
    { title: 'Activate / pause', body: 'Pause hides the offer on the storefront instantly. Price stays unchanged.' },
    { title: 'Quick discount', body: 'In the panel, tap -10% or -20% to auto-calculate sale price.' },
    { title: 'Advanced campaigns', body: 'BOGO and scheduling — Campaigns tab or Convert all.' },
  ];

  return (
    <div className="rounded-2xl border border-blue-200/80 bg-gradient-to-br from-blue-50/90 to-white overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-start"
      >
        <span className="flex items-center gap-2 text-sm font-bold text-blue-950">
          <HelpCircle className="h-4 w-4" />
          {isAr ? 'دليل سريع — كيف تستخدم هذه الصفحة' : 'Quick guide — how to use this page'}
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-blue-700" /> : <ChevronDown className="h-4 w-4 text-blue-700" />}
      </button>
      {open && (
        <div className="grid gap-3 border-t border-blue-100 px-4 pb-4 pt-3 sm:grid-cols-2">
          {tips.map((tip) => (
            <div key={tip.title} className="rounded-xl border border-blue-100 bg-white/80 p-3">
              <p className="text-xs font-bold text-blue-900">{tip.title}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-blue-950/80">{tip.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProductOffersCatalog({
  categories = [],
  onStatsChange,
  onImportComplete,
}) {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const confirm = useConfirm();
  const toast = useToast();

  const [view, setView] = useState('table');
  const [rows, setRows] = useState([]);
  const [editRow, setEditRow] = useState(null);
  const [helpOpen, setHelpOpen] = useState(true);
  const [showFilters, setShowFilters] = useState(true);

  const list = useAdminListPage({
    fetchFn: (params) => adminApi.getCatalogOffers(params),
    initialFilters: {
      source: '',
      offerActive: '',
      productActive: '',
      mainCategory: '',
      subCategory: '',
      brand: '',
      minDiscount: '',
      maxDiscount: '',
    },
    pageSize: 20,
  });

  useEffect(() => {
    setRows(list.data);
  }, [list.data]);

  const reload = () => {
    list.reload();
    onStatsChange?.();
  };

  const patchRowLocal = (updated) => {
    setRows((prev) => prev.map((r) => (String(r._id) === String(updated._id) ? { ...r, ...updated } : r)));
  };

  const runBulk = async (action, title) => {
    const ok = await confirm({
      title,
      confirmLabel: isAr ? 'تأكيد' : 'Confirm',
      variant: action === 'clear' ? 'danger' : 'primary',
    });
    if (!ok) return;
    await adminApi.bulkCatalogOffers(list.selectedIds, action);
    list.clearSelection();
    reload();
    toast.success(isAr ? 'تم' : 'Done');
  };

  const toggleOffer = async (row) => {
    const next = row.offerActive === false;
    patchRowLocal({ ...row, offerActive: next });
    try {
      const { data } = await adminApi.patchCatalogOffer(row._id, { offerActive: next });
      patchRowLocal(data.data);
      onStatsChange?.();
      toast.success(next ? (isAr ? 'تم التفعيل' : 'Activated') : (isAr ? 'تم الإيقاف' : 'Paused'));
    } catch {
      patchRowLocal(row);
      toast.error(isAr ? 'فشل التحديث' : 'Update failed');
    }
  };

  const handleSaved = (updated) => {
    patchRowLocal(updated);
    setEditRow(null);
    onStatsChange?.();
    toast.success(isAr ? 'تم الحفظ' : 'Saved');
  };

  const importAll = async () => {
    const ok = await confirm({
      title: isAr ? 'تحويل العروض إلى حملات؟' : 'Convert to managed campaigns?',
      message: isAr
        ? 'سيُنشئ حملة لكل منتج — يمكن جدولتها لاحقاً.'
        : 'Creates one campaign per product — schedulable later.',
    });
    if (!ok) return;
    const { data } = await adminApi.importCatalogOffers({ all: true });
    reload();
    onImportComplete?.();
    toast.success(isAr ? `تم استيراد ${data.created}` : `Imported ${data.created}`);
  };

  const applyQuickFilter = (filter) => {
    if (filter.key === 'minDiscount') {
      list.setFilter('minDiscount', filter.value);
      list.setFilter('offerActive', '');
      list.setFilter('source', '');
    } else {
      list.setFilter(filter.key, filter.value);
      if (filter.key !== 'minDiscount') list.setFilter('minDiscount', '');
    }
  };

  const activeQuickKey = useMemo(() => {
    if (list.filters.minDiscount === '20') return 'minDiscount:20';
    if (list.filters.offerActive === 'true') return 'offerActive:true';
    if (list.filters.offerActive === 'false') return 'offerActive:false';
    if (list.filters.source === 'legacy') return 'source:legacy';
    if (list.filters.source === 'managed') return 'source:managed';
    return '';
  }, [list.filters]);

  const columns = [
    {
      key: 'product',
      header: isAr ? 'المنتج' : 'Product',
      sortKey: 'nameEn',
      render: (row) => (
        <div className="flex items-center gap-3">
          <ProductThumb row={row} />
          <div className="min-w-0">
            <p className="font-semibold text-text">{isAr ? row.nameAr : row.nameEn}</p>
            <p className="text-xs text-text-muted">{row.brand || row.slug}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'price',
      header: isAr ? 'السعر' : 'Price',
      sortKey: 'price',
      render: (row) => (
        <div className="text-sm tabular-nums">
          <span className="font-bold text-primary-700">{row.price}</span>
          <span className="ms-1 text-xs text-text-muted">EGP</span>
          {row.oldPrice > row.price && (
            <div className="text-xs text-text-muted line-through">{row.oldPrice} EGP</div>
          )}
        </div>
      ),
    },
    {
      key: 'discount',
      header: isAr ? 'الخصم' : 'Off',
      sortKey: 'discount',
      render: (row) => (
        row.discount > 0 ? (
          <span className="inline-flex min-w-[3rem] justify-center rounded-lg bg-red-600 px-2 py-1 text-xs font-bold text-white">
            -{row.discount}%
          </span>
        ) : (
          <span className="rounded-lg bg-orange-100 px-2 py-1 text-xs font-bold text-orange-800">
            {isAr ? (row.offerBadgeAr || 'عرض') : (row.offerBadgeEn || 'Offer')}
          </span>
        )
      ),
    },
    {
      key: 'source',
      header: isAr ? 'المصدر' : 'Source',
      render: (row) => (
        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
          row.source === 'managed' ? 'bg-violet-100 text-violet-800' : 'bg-slate-100 text-slate-700'
        }`}
        >
          {row.source === 'managed' ? (isAr ? 'حملة' : 'Campaign') : (isAr ? 'منتج' : 'Product')}
        </span>
      ),
    },
    {
      key: 'status',
      header: isAr ? 'الحالة' : 'Status',
      render: (row) => (
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
          row.offerActive !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
        }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${row.offerActive !== false ? 'bg-emerald-500' : 'bg-slate-400'}`} />
          {row.offerActive !== false ? (isAr ? 'نشط' : 'Live') : (isAr ? 'متوقف' : 'Paused')}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setEditRow(row); }}
            className="rounded-lg p-2 text-orange-700 hover:bg-orange-50"
            title={isAr ? 'تعديل سريع' : 'Quick edit'}
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); toggleOffer(row); }}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
          >
            {row.offerActive !== false ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          {row.slug && (
            <a
              href={`/products/${row.slug}`}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
            >
              <Eye className="h-4 w-4" />
            </a>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <HelpGuide isAr={isAr} open={helpOpen} onToggle={() => setHelpOpen((v) => !v)} />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-orange-200/80 bg-gradient-to-r from-orange-50/80 via-white to-amber-50/50 px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-orange-950">
          <Sparkles className="h-4 w-4 shrink-0 text-orange-600" />
          <span>{isAr ? `${rows.length} عرض في هذه الصفحة — انقر للتعديل الفوري` : `${rows.length} offers on this page — click to edit instantly`}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={reload}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold hover:bg-slate-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${list.loading ? 'animate-spin' : ''}`} />
            {isAr ? 'تحديث' : 'Refresh'}
          </button>
          <button
            type="button"
            onClick={importAll}
            className="inline-flex items-center gap-1 rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-700"
          >
            <Upload className="h-3.5 w-3.5" />
            {isAr ? 'تحويل لحملات' : 'Convert to campaigns'}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-text-muted">{isAr ? 'فلتر سريع:' : 'Quick:'}</span>
        {QUICK_FILTERS.map((f) => {
          const id = f.key === 'minDiscount' ? 'minDiscount:20' : `${f.key}:${f.value}`;
          const active = activeQuickKey === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => applyQuickFilter(f)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                active ? 'bg-orange-600 text-white shadow-sm' : 'border border-border bg-white hover:border-orange-300'
              }`}
            >
              {isAr ? f.labelAr : f.labelEn}
            </button>
          );
        })}
        {activeQuickKey && (
          <button
            type="button"
            onClick={() => {
              list.setFilter('offerActive', '');
              list.setFilter('source', '');
              list.setFilter('minDiscount', '');
            }}
            className="text-xs font-semibold text-red-600 hover:underline"
          >
            {isAr ? 'مسح' : 'Clear'}
          </button>
        )}
        <div className="ms-auto flex rounded-lg border border-border p-0.5">
          <button
            type="button"
            onClick={() => setView('table')}
            className={`rounded-md p-1.5 ${view === 'table' ? 'bg-orange-100 text-orange-800' : 'text-slate-500'}`}
            title={isAr ? 'جدول' : 'Table'}
          >
            <LayoutList className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setView('grid')}
            className={`rounded-md p-1.5 ${view === 'grid' ? 'bg-orange-100 text-orange-800' : 'text-slate-500'}`}
            title={isAr ? 'شبكة' : 'Grid'}
          >
            <Grid3X3 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {view === 'grid' ? (
        <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
          {list.loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-44 animate-pulse rounded-2xl bg-slate-100" />
              ))}
            </div>
          ) : rows.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {rows.map((row) => (
                <OfferGridCard key={row._id} row={row} isAr={isAr} onEdit={setEditRow} onToggle={toggleOffer} />
              ))}
            </div>
          ) : (
            <p className="py-12 text-center text-sm text-text-muted">{isAr ? 'لا منتجات' : 'No products'}</p>
          )}
        </div>
      ) : (
        <AdminListPage
          isAr={isAr}
          q={list.q}
          onSearchChange={list.setQ}
          searchPlaceholder={isAr ? 'بحث اسم، ماركة، SKU...' : 'Search name, brand, SKU...'}
          sort={list.sort}
          onSort={list.toggleSort}
          onRowClick={(row) => setEditRow(row)}
          rowClassName={() => 'cursor-pointer hover:bg-orange-50/40'}
          filters={showFilters ? (
            <div className="flex w-full flex-wrap items-end gap-2">
              <button
                type="button"
                onClick={() => setShowFilters(false)}
                className="mb-2 text-xs font-semibold text-text-muted hover:text-text lg:hidden"
              >
                {isAr ? 'إخفاء الفلاتر' : 'Hide filters'}
              </button>
              <ListFilterSelect
                label={isAr ? 'المصدر' : 'Source'}
                value={list.filters.source}
                onChange={(v) => list.setFilter('source', v)}
                options={[
                  { value: '', label: isAr ? 'الكل' : 'All' },
                  { value: 'legacy', label: isAr ? 'منتج' : 'Product' },
                  { value: 'managed', label: isAr ? 'حملة' : 'Campaign' },
                ]}
              />
              <ListFilterSelect
                label={isAr ? 'العرض' : 'Offer'}
                value={list.filters.offerActive}
                onChange={(v) => list.setFilter('offerActive', v)}
                options={[
                  { value: '', label: isAr ? 'الكل' : 'All' },
                  { value: 'true', label: isAr ? 'نشط' : 'Live' },
                  { value: 'false', label: isAr ? 'متوقف' : 'Paused' },
                ]}
              />
              <AdminProductCategoryFilter
                categories={categories}
                mainCategory={list.filters.mainCategory}
                subCategory={list.filters.subCategory}
                onChange={({ mainCategory, subCategory }) => list.patchFilters({ mainCategory, subCategory })}
                isAr={isAr}
              />
              <div className="w-24">
                <Input
                  label={isAr ? 'ماركة' : 'Brand'}
                  value={list.filters.brand}
                  onChange={(e) => list.setFilter('brand', e.target.value)}
                  dir="ltr"
                />
              </div>
              <div className="w-16">
                <Input
                  label="Min %"
                  type="number"
                  value={list.filters.minDiscount}
                  onChange={(e) => list.setFilter('minDiscount', e.target.value)}
                />
              </div>
              <div className="w-16">
                <Input
                  label="Max %"
                  type="number"
                  value={list.filters.maxDiscount}
                  onChange={(e) => list.setFilter('maxDiscount', e.target.value)}
                />
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowFilters(true)}
              className="text-xs font-semibold text-orange-700"
            >
              {isAr ? '+ فلاتر متقدمة' : '+ Advanced filters'}
            </button>
          )}
          bulkBar={(
            <BulkActionsBar
              count={list.selectedIds.length}
              isAr={isAr}
              onActivate={() => runBulk('activate', isAr ? 'تفعيل' : 'Activate')}
              onDeactivate={() => runBulk('pause', isAr ? 'إيقاف' : 'Pause')}
              onDelete={() => runBulk('clear', isAr ? 'إزالة الخصم' : 'Remove discount')}
              onClear={list.clearSelection}
            />
          )}
          columns={columns}
          data={rows}
          loading={list.loading}
          selectable
          selectedIds={list.selectedIds}
          onToggleSelect={list.toggleSelect}
          onToggleSelectAll={list.toggleSelectAll}
          allSelected={list.allSelected}
          pagination={list.pagination}
          onPageChange={list.setPage}
          emptyTitle={isAr ? 'لا منتجات بخصم' : 'No discounted products'}
          emptyDescription={isAr ? 'أضف oldPrice في صفحة المنتجات' : 'Set oldPrice on product pages'}
        />
      )}

      {view === 'grid' && list.pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            disabled={list.pagination.page <= 1}
            onClick={() => list.setPage(list.pagination.page - 1)}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
          >
            {isAr ? 'السابق' : 'Prev'}
          </button>
          <span className="text-xs text-text-muted tabular-nums">
            {isAr
              ? `${list.pagination.page} / ${list.pagination.pages}`
              : `${list.pagination.page} / ${list.pagination.pages}`}
          </span>
          <button
            type="button"
            disabled={list.pagination.page >= list.pagination.pages}
            onClick={() => list.setPage(list.pagination.page + 1)}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
          >
            {isAr ? 'التالي' : 'Next'}
          </button>
        </div>
      )}

      <AdminSlidePanel
        open={!!editRow}
        onClose={() => setEditRow(null)}
        title={isAr ? 'تعديل العرض' : 'Edit offer'}
        subtitle={editRow ? (isAr ? editRow.nameAr : editRow.nameEn) : ''}
        isAr={isAr}
        width="max-w-md"
      >
        <CatalogOfferEditPanel
          isAr={isAr}
          row={editRow}
          onSaved={handleSaved}
          onClose={() => setEditRow(null)}
        />
      </AdminSlidePanel>
    </div>
  );
}
