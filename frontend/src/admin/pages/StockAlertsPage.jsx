import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from '../../app/router';
import {
  Download, ExternalLink, Package, RefreshCw, RotateCcw, X,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { adminApi } from '../adminApi';
import { useAdminListPage } from '../hooks/useAdminListPage';
import { downloadBlob } from '../utils/downloadBlob';
import Button from '../../components/ui/Button';
import { formatPrice } from '../../utils/formatters';
import { AdminListPage, ListFilterSelect } from '../components/list';
import { PageHeader, useToast } from '../components';
import AdminProductCategoryFilter from '../components/AdminProductCategoryFilter';
import ProductRowCategory from '../components/ProductRowCategory';
import QuickRestockInput from '../components/stockAlerts/QuickRestockInput';
import StockAlertThresholdPanel from '../components/stockAlerts/StockAlertThresholdPanel';
import StockAlertsAttentionBanner from '../components/stockAlerts/StockAlertsAttentionBanner';
import StockAlertsScopeBar from '../components/stockAlerts/StockAlertsScopeBar';
import StockAlertsViewTabs from '../components/stockAlerts/StockAlertsViewTabs';
import StockLevelMeter from '../components/stockAlerts/StockLevelMeter';
import { useAdminStockAlertThreshold } from '../hooks/useAdminStockAlertThreshold';
import { DEFAULT_ALERT_STOCK_VIEW, DEFAULT_STOCK_THRESHOLD, stockStatusLabel, stockStatusTone } from '../utils/stockThreshold';

function formatDateTime(value, isAr) {
  if (!value) return '';
  return new Date(value).toLocaleString(isAr ? 'ar-EG' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function StockStatusBadge({ stock, threshold, isAr }) {
  const tone = stockStatusTone(stock, threshold);
  const label = stockStatusLabel(stock, threshold, isAr);
  const classes = {
    danger: 'bg-red-100 text-red-800 ring-red-200',
    warning: 'bg-amber-100 text-amber-800 ring-amber-200',
    success: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  };

  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${classes[tone]}`}>
      {label}
    </span>
  );
}

function ActiveFilterChips({ isAr, filters, categories, onClear, onRemove }) {
  const chips = [];

  if (filters.isActive === 'false') {
    chips.push({ key: 'inactive', label: isAr ? 'معطل فقط' : 'Inactive only' });
  } else if (filters.isActive === '') {
    chips.push({ key: 'allStatus', label: isAr ? 'كل الحالات' : 'All statuses' });
  }

  if (filters.mainCategory) {
    const main = categories.find((c) => c.slug === filters.mainCategory);
    chips.push({
      key: 'mainCategory',
      label: isAr ? (main?.nameAr || filters.mainCategory) : (main?.nameEn || filters.mainCategory),
    });
  }
  if (filters.subCategory) {
    const sub = categories.find((c) => c.slug === filters.subCategory);
    chips.push({
      key: 'subCategory',
      label: isAr ? (sub?.nameAr || filters.subCategory) : (sub?.nameEn || filters.subCategory),
    });
  }

  if (!chips.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-text-muted">
        {isAr ? 'فلاتر نشطة:' : 'Active filters:'}
      </span>
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={() => onRemove(chip.key)}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-white px-2.5 py-1 text-xs font-medium text-text shadow-sm transition hover:border-red-200 hover:text-red-700"
        >
          {chip.label}
          <X className="h-3 w-3" />
        </button>
      ))}
      <button
        type="button"
        onClick={onClear}
        className="text-xs font-medium text-primary-600 hover:underline"
      >
        {isAr ? 'مسح الكل' : 'Clear all'}
      </button>
    </div>
  );
}

function InventoryHealthCard({ isAr, summary, threshold, loading }) {
  const total = summary?.totalProducts ?? 0;
  const needsAttention = summary?.belowThreshold ?? 0;
  const pct = total > 0 ? Math.round((needsAttention / total) * 100) : 0;
  const healthy = total > 0 && needsAttention === 0;

  return (
    <section className="rounded-2xl border border-border bg-white p-5 shadow-sm">
      <h3 className="text-sm font-bold text-text">
        {isAr ? 'صحة المخزون' : 'Inventory health'}
      </h3>
      <p className="mt-1 text-xs text-text-muted">
        {isAr ? 'نسبة المنتجات النشطة التي تحتاج انتباه' : 'Share of active products needing attention'}
      </p>
      <div className="mt-4">
        <div className="flex items-end justify-between gap-2">
          <span className={`text-3xl font-bold tabular-nums ${healthy ? 'text-emerald-600' : pct > 20 ? 'text-red-600' : 'text-amber-600'}`}>
            {loading ? '…' : `${pct}%`}
          </span>
          <span className="pb-1 text-xs text-text-muted">
            {loading ? '…' : `${needsAttention} / ${total}`}
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all ${healthy ? 'bg-emerald-500' : pct > 20 ? 'bg-red-500' : 'bg-amber-500'}`}
            style={{ width: `${loading ? 0 : Math.min(100, pct)}%` }}
          />
        </div>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-text-muted">
        {healthy
          ? (isAr ? 'ممتاز — لا منتجات تحت حد التنبيه حالياً.' : 'Great — no products at or below your alert threshold.')
          : (isAr
            ? `القائمة تعرض المنتجات ≤ ${threshold} تلقائياً بعد حفظ الإعدادات.`
            : `The list automatically shows products ≤ ${threshold} after you save settings.`)}
      </p>
    </section>
  );
}

const STOCK_FILTER_MODES = new Set(['out', 'low', 'below', 'in']);

const VIEW_EMPTY = {
  out: {
    ar: { title: 'لا منتجات نافدة', desc: 'جميع المنتجات النشطة متوفرة — عمل رائع!' },
    en: { title: 'Nothing out of stock', desc: 'All active products are available — well done!' },
  },
  below: {
    ar: { title: 'لا تنبيهات مخزون', desc: 'لا منتجات عند أو تحت حد التنبيه الحالي.' },
    en: { title: 'No stock alerts', desc: 'No products at or below your current alert threshold.' },
  },
  low: {
    ar: { title: 'لا مخزون منخفض', desc: 'لا منتجات بمخزون منخفض (بدون نفاد).' },
    en: { title: 'No low stock', desc: 'No products with low but non-zero stock.' },
  },
  in: {
    ar: { title: 'لا منتجات بكميات كافية', desc: 'جرّب تغيير الفلاتر أو خفض حد التنبيه.' },
    en: { title: 'No well-stocked products', desc: 'Try changing filters or lowering the alert threshold.' },
  },
};

export default function StockAlertsPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const [categories, setCategories] = useState([]);
  const [exporting, setExporting] = useState(false);
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const {
    threshold,
    thresholdString,
    ready: thresholdReady,
    saving: savingThreshold,
    saveThreshold,
  } = useAdminStockAlertThreshold();

  const stockFromUrl = searchParams.get('stock');
  const initialStock = STOCK_FILTER_MODES.has(stockFromUrl) ? stockFromUrl : DEFAULT_ALERT_STOCK_VIEW;

  const list = useAdminListPage({
    fetchFn: (params) => adminApi.getProducts(params),
    initialFilters: {
      mainCategory: '',
      subCategory: '',
      isActive: 'true',
      stock: initialStock,
      stockMax: thresholdString,
    },
    initialSort: { field: 'stock', order: 'asc' },
  });

  useEffect(() => {
    if (!thresholdReady) return;
    const urlStock = searchParams.get('stock');
    const patch = { stockMax: thresholdString };
    if (!STOCK_FILTER_MODES.has(urlStock)) {
      patch.stock = DEFAULT_ALERT_STOCK_VIEW;
    }
    list.patchFilters(patch);
  }, [thresholdReady, thresholdString]);

  const activeThreshold = Number(list.filters.stockMax) || threshold || DEFAULT_STOCK_THRESHOLD;
  const activeView = list.filters.stock || DEFAULT_ALERT_STOCK_VIEW;

  const syncViewToUrl = useCallback((stock) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (stock && stock !== DEFAULT_ALERT_STOCK_VIEW) next.set('stock', stock);
      else next.delete('stock');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const applyView = (stock) => {
    list.patchFilters({ stock });
    syncViewToUrl(stock);
  };

  const loadSummary = useCallback(() => {
    setSummaryLoading(true);
    const params = {
      stockMax: activeThreshold,
      isActive: list.filters.isActive || 'true',
    };
    if (list.filters.mainCategory) params.mainCategory = list.filters.mainCategory;
    if (list.filters.subCategory) params.subCategory = list.filters.subCategory;

    adminApi.getStockSummary(params)
      .then(({ data }) => setSummary(data.data))
      .catch(() => setSummary(null))
      .finally(() => setSummaryLoading(false));
  }, [activeThreshold, list.filters.isActive, list.filters.mainCategory, list.filters.subCategory]);

  useEffect(() => {
    adminApi.getCategories({ limit: 500 }).then(({ data }) => setCategories(data.data || []));
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const { data } = await adminApi.exportProducts(list.queryParams);
      downloadBlob(data, 'stock-alerts.csv');
      toast.success(isAr ? 'تم تصدير القائمة' : 'List exported');
    } catch {
      toast.error(isAr ? 'فشل التصدير' : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleThresholdSave = async (value) => {
    try {
      await saveThreshold(value);
      list.patchFilters({ stockMax: String(value), stock: DEFAULT_ALERT_STOCK_VIEW });
      syncViewToUrl(DEFAULT_ALERT_STOCK_VIEW);
      toast.success(
        isAr
          ? `تم الحفظ — القائمة تعرض الآن المنتجات ≤ ${value}`
          : `Saved — list now shows products ≤ ${value}`,
      );
      loadSummary();
    } catch {
      toast.error(isAr ? 'فشل حفظ حد التنبيه' : 'Failed to save alert threshold');
      throw new Error('save failed');
    }
  };

  const handleRestockSaved = (product, newStock) => {
    toast.success(
      isAr
        ? `تم تحديث مخزون «${product.nameAr || product.nameEn}» إلى ${newStock}`
        : `Updated «${product.nameEn}» stock to ${newStock}`,
    );
    list.reload();
    loadSummary();
  };

  const handleRestockError = () => {
    toast.error(isAr ? 'فشل تحديث المخزون' : 'Failed to update stock');
  };

  const clearSecondaryFilters = () => {
    list.patchFilters({ mainCategory: '', subCategory: '', isActive: 'true' });
  };

  const removeFilterChip = (key) => {
    if (key === 'inactive' || key === 'allStatus') list.setFilter('isActive', 'true');
    if (key === 'mainCategory') list.patchFilters({ mainCategory: '', subCategory: '' });
    if (key === 'subCategory') list.setFilter('subCategory', '');
  };

  const emptyMeta = VIEW_EMPTY[activeView]?.[isAr ? 'ar' : 'en'] || VIEW_EMPTY.below.en;

  const columns = useMemo(() => [
    {
      key: 'product',
      header: isAr ? 'المنتج' : 'Product',
      sortKey: 'nameEn',
      render: (p) => {
        const img = p.images?.[0];
        return (
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-slate-50">
              {img ? (
                <img src={img} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-xl">{p.emoji || '📦'}</span>
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate font-medium">{isAr ? p.nameAr || p.name : p.nameEn}</p>
              <p className="truncate text-xs text-text-muted">{p.slug}</p>
            </div>
          </div>
        );
      },
    },
    {
      key: 'category',
      header: isAr ? 'القسم' : 'Category',
      render: (p) => <ProductRowCategory product={p} isAr={isAr} />,
    },
    {
      key: 'stockLevel',
      header: isAr ? 'المخزون' : 'Stock',
      sortKey: 'stock',
      render: (p) => <StockLevelMeter stock={p.stock} threshold={activeThreshold} isAr={isAr} />,
    },
    {
      key: 'stockStatus',
      header: isAr ? 'الحالة' : 'Status',
      render: (p) => <StockStatusBadge stock={p.stock} threshold={activeThreshold} isAr={isAr} />,
    },
    {
      key: 'gap',
      header: isAr ? 'ينقص للحد' : 'To threshold',
      render: (p) => {
        const gap = Math.max(0, activeThreshold - (p.stock ?? 0));
        if (p.stock <= 0) {
          return (
            <span className="text-xs font-semibold text-red-600">
              {isAr ? 'نفد' : 'Depleted'}
            </span>
          );
        }
        if (gap === 0) {
          return <span className="text-xs text-text-muted">—</span>;
        }
        return (
          <span className="text-xs font-medium text-amber-700">
            {isAr ? `${gap} وحدة` : `${gap} units`}
          </span>
        );
      },
    },
    {
      key: 'quickRestock',
      header: isAr ? 'إعادة تعبئة سريعة' : 'Quick restock',
      render: (p) => (
        <QuickRestockInput
          product={p}
          isAr={isAr}
          onSaved={(newStock) => handleRestockSaved(p, newStock)}
          onError={handleRestockError}
        />
      ),
    },
    {
      key: 'price',
      header: isAr ? 'السعر' : 'Price',
      sortKey: 'price',
      render: (p) => formatPrice(p.price),
    },
    {
      key: 'sku',
      header: 'SKU',
      render: (p) => <span className="font-mono text-xs text-text-muted">{p.sku || '—'}</span>,
    },
    {
      key: 'updated',
      header: isAr ? 'آخر تحديث' : 'Updated',
      render: (p) => (
        <span className="text-xs text-text-muted">
          {p.stockUpdatedAt ? formatDateTime(p.stockUpdatedAt, isAr) : '—'}
        </span>
      ),
    },
  ], [isAr, activeThreshold, list.reload, loadSummary, toast]);

  return (
    <div className="space-y-5">
      <PageHeader
        title={isAr ? 'إدارة المخزون والتنبيهات' : 'Inventory & stock alerts'}
        description={
          isAr
            ? 'القائمة تُظهر تلقائياً كل منتج مخزونه ≤ حد التنبيه (بما في ذلك النافد). غيّر الحد من الإعدادات ويتحدّث العرض فوراً.'
            : 'The list automatically shows every product with stock ≤ your alert threshold (including out of stock). Change the limit in settings and the view updates instantly.'
        }
        action={(
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => { list.reload(); loadSummary(); }} disabled={summaryLoading && list.loading}>
              <RefreshCw className={`h-4 w-4 ${summaryLoading || list.loading ? 'animate-spin' : ''}`} />
              {isAr ? 'تحديث' : 'Refresh'}
            </Button>
            <Button variant="secondary" size="sm" onClick={handleExport} disabled={exporting || !list.pagination?.total}>
              <Download className="h-4 w-4" />
              {isAr ? 'تصدير' : 'Export'}
            </Button>
            <Link to="/admin/products">
              <Button variant="secondary" size="sm">
                <ExternalLink className="h-4 w-4" />
                {isAr ? 'كل المنتجات' : 'All products'}
              </Button>
            </Link>
          </div>
        )}
      />

      {!bannerDismissed && activeView !== DEFAULT_ALERT_STOCK_VIEW && (summary?.belowThreshold ?? 0) > 0 && (
        <StockAlertsAttentionBanner
          isAr={isAr}
          count={summary?.belowThreshold ?? 0}
          threshold={activeThreshold}
          activeView={activeView}
          onViewAlerts={() => applyView(DEFAULT_ALERT_STOCK_VIEW)}
          onDismiss={() => setBannerDismissed(true)}
        />
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_18.5rem]">
        <div className="space-y-4 min-w-0">
          <StockAlertsViewTabs
            isAr={isAr}
            active={activeView}
            onChange={applyView}
            summary={summary}
            threshold={activeThreshold}
            loading={summaryLoading}
          />

          <StockAlertsScopeBar
            isAr={isAr}
            threshold={activeThreshold}
            activeView={activeView}
            totalMatching={summary?.belowThreshold ?? list.pagination.total}
            outOfStock={summary?.outOfStock ?? 0}
            onShowAllAlerts={() => applyView(DEFAULT_ALERT_STOCK_VIEW)}
          />

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface-muted/30 px-4 py-2.5">
            <p className="text-sm text-text-muted">
              {list.loading
                ? (isAr ? 'جاري التحميل…' : 'Loading…')
                : activeView === DEFAULT_ALERT_STOCK_VIEW
                  ? (isAr
                    ? `عرض ${list.pagination.total} منتج${list.pagination.total === 1 ? '' : 'ات'} (مخزون ≤ ${activeThreshold})`
                    : `Showing ${list.pagination.total} product${list.pagination.total === 1 ? '' : 's'} (stock ≤ ${activeThreshold})`)
                  : (isAr
                    ? `عرض ${list.data.length} من ${list.pagination.total} منتج`
                    : `Showing ${list.data.length} of ${list.pagination.total} products`)}
            </p>
            {(list.filters.mainCategory || list.filters.subCategory || list.filters.isActive !== 'true') && (
              <button
                type="button"
                onClick={clearSecondaryFilters}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {isAr ? 'إعادة ضبط الفلاتر' : 'Reset filters'}
              </button>
            )}
          </div>

          <ActiveFilterChips
            isAr={isAr}
            filters={list.filters}
            categories={categories}
            onClear={clearSecondaryFilters}
            onRemove={removeFilterChip}
          />

          <AdminListPage
            isAr={isAr}
            q={list.q}
            onSearchChange={list.setQ}
            searchPlaceholder={isAr ? 'بحث بالاسم، SKU، أو الباركود…' : 'Search name, SKU, or barcode…'}
            sort={list.sort}
            onSort={list.toggleSort}
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
                    { value: 'true', label: isAr ? 'نشط (على الموقع)' : 'Active (on storefront)' },
                    { value: '', label: isAr ? 'كل الحالات' : 'All statuses' },
                    { value: 'false', label: isAr ? 'معطل' : 'Inactive' },
                  ]}
                  showLabel
                />
              </>
            )}
            columns={columns}
            data={list.data}
            loading={list.loading}
            onRowClick={(p) => navigate(`/admin/products/${p._id}/edit`)}
            rowClassName={(p) => (p.stock <= 0 ? 'bg-red-50/50' : p.stock <= activeThreshold ? 'bg-amber-50/40' : '')}
            rowActions={(p) => [
              {
                label: isAr ? 'تعديل وإعادة التعبئة' : 'Edit & restock',
                onClick: () => navigate(`/admin/products/${p._id}/edit`),
              },
              {
                label: isAr ? 'عرض في المتجر' : 'View on storefront',
                onClick: () => window.open(`/products/${p.slug}`, '_blank'),
              },
            ]}
            pagination={list.pagination}
            onPageChange={list.setPage}
            emptyIcon={Package}
            emptyTitle={emptyMeta.title}
            emptyDescription={emptyMeta.desc}
            emptyAction={activeView !== DEFAULT_ALERT_STOCK_VIEW && (summary?.belowThreshold ?? 0) > 0 ? (
              <Button size="sm" variant="secondary" onClick={() => applyView(DEFAULT_ALERT_STOCK_VIEW)}>
                {isAr ? `عرض كل التنبيهات (≤ ${activeThreshold})` : `Show all alerts (≤ ${activeThreshold})`}
              </Button>
            ) : null}
          />
        </div>

        <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <StockAlertThresholdPanel
            isAr={isAr}
            value={activeThreshold}
            saving={savingThreshold}
            onSave={handleThresholdSave}
          />
          <InventoryHealthCard
            isAr={isAr}
            summary={summary}
            threshold={activeThreshold}
            loading={summaryLoading}
          />
        </aside>
      </div>
    </div>
  );
}
