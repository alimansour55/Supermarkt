import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Flame, Package, Plus, Save, Search, Trash2, ArrowDown, ArrowUp, Type,
  GripVertical, AlertTriangle, Download, Upload, Filter, Sparkles, X,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { adminApi } from '../adminApi';
import { hasPermission } from '../adminPermissions';
import { fetchProductsByIds } from '../../services/productApi';
import { DEFAULT_TRENDING_CONFIG } from '../../utils/searchConstants';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Loader from '../../components/ui/Loader';
import { reorderList } from '../utils/reorderList';
import { downloadBlob } from '../utils/downloadBlob';
import { useConfirm, useToast } from './index';

const MODES = ['manual', 'hybrid', 'auto'];

const emptyKeywordItem = (sortOrder = 0) => ({
  query: '',
  labelAr: '',
  labelEn: '',
  productId: null,
  sortOrder,
  isActive: true,
});

const normalize = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');

function productFromItem(item, catalog) {
  if (!item?.productId) return null;
  return catalog.get(String(item.productId)) || null;
}

/** Non-blocking data-quality warnings for a single manual row. */
function itemWarnings(item, index, items, catalog, isAr) {
  const warnings = [];
  const label = item.labelAr?.trim() || item.labelEn?.trim() || item.query?.trim();
  if (!label) {
    warnings.push(isAr ? 'بحاجة إلى تسمية أو كلمة بحث' : 'Needs a label or search term');
  }
  const key = normalize(item.query || item.labelAr || item.labelEn);
  const dupeEarlier = items.slice(0, index).some((other) => {
    if (item.productId && other.productId) return String(other.productId) === String(item.productId);
    return key && normalize(other.query || other.labelAr || other.labelEn) === key;
  });
  if (dupeEarlier) {
    warnings.push(isAr ? 'مكرر — مُدرج بالأعلى' : 'Duplicate of an item above');
  }
  if (item.productId && !catalog.get(String(item.productId))) {
    warnings.push(isAr
      ? 'المنتج غير متاح (محذوف أو غير مُفعّل)'
      : 'Product unavailable (deleted or inactive)');
  }
  return warnings;
}

export default function TrendingSearchesAdmin({ topSearches = [], compact = false }) {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const canEdit = hasPermission(user, 'settings:write');

  const [searchSettings, setSearchSettings] = useState({
    trendingMode: 'manual',
    trendingSearches: [],
    trendingConfig: { ...DEFAULT_TRENDING_CONFIG },
  });
  const [productCatalog, setProductCatalog] = useState(new Map());
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState([]);
  const [searchingProducts, setSearchingProducts] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [listFilter, setListFilter] = useState('');
  const [blocklistInput, setBlocklistInput] = useState('');
  const [previewSurface, setPreviewSurface] = useState('search');

  const dragIndex = useRef(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const importInputRef = useRef(null);

  const { trendingMode, trendingSearches, trendingConfig } = searchSettings;
  const isFiltering = listFilter.trim().length > 0;

  const hydrateProducts = useCallback(async (items) => {
    const ids = items.map((item) => item.productId).filter(Boolean);
    if (!ids.length) {
      setProductCatalog(new Map());
      return;
    }
    try {
      const products = await fetchProductsByIds(ids);
      setProductCatalog(new Map(products.map((p) => [String(p._id), p])));
    } catch {
      setProductCatalog(new Map());
    }
  }, []);

  useEffect(() => {
    adminApi.getStoreSettings()
      .then(async ({ data }) => {
        const ss = data.data?.searchSettings || {};
        const items = ss.trendingSearches?.length ? ss.trendingSearches : [emptyKeywordItem()];
        setSearchSettings({
          trendingMode: MODES.includes(ss.trendingMode) ? ss.trendingMode : 'manual',
          trendingSearches: items,
          trendingConfig: { ...DEFAULT_TRENDING_CONFIG, ...(ss.trendingConfig || {}) },
        });
        await hydrateProducts(items);
      })
      .catch(() => toast.error(isAr ? 'تعذر تحميل إعدادات البحث' : 'Could not load search settings'))
      .finally(() => setLoading(false));
  }, [hydrateProducts, isAr, toast]);

  useEffect(() => {
    const query = productSearch.trim();
    if (!query) {
      setProductResults([]);
      return undefined;
    }

    let active = true;
    const timer = setTimeout(async () => {
      setSearchingProducts(true);
      try {
        const { data } = await adminApi.getProducts({ q: query, page: 1, limit: 12 });
        if (active) setProductResults(data.data || []);
      } catch {
        if (active) setProductResults([]);
      } finally {
        if (active) setSearchingProducts(false);
      }
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [productSearch]);

  const selectedProductIds = useMemo(
    () => new Set(
      trendingSearches.map((item) => item.productId).filter(Boolean).map(String),
    ),
    [trendingSearches],
  );

  const previewItems = useMemo(
    () => trendingSearches
      .filter((item) => item.isActive !== false)
      .map((item) => {
        const product = productFromItem(item, productCatalog);
        return {
          key: item._id || item.productId || item.query,
          labelAr: item.labelAr || product?.nameAr || product?.nameEn || item.query,
          labelEn: item.labelEn || product?.nameEn || product?.nameAr || item.query,
        };
      })
      .filter((item) => item.labelAr || item.labelEn),
    [trendingSearches, productCatalog],
  );

  const warningCount = useMemo(
    () => trendingSearches.reduce(
      (sum, item, index) => sum + itemWarnings(item, index, trendingSearches, productCatalog, isAr).length,
      0,
    ),
    [trendingSearches, productCatalog, isAr],
  );

  const setConfig = (field, value) => {
    setSearchSettings((prev) => ({
      ...prev,
      trendingConfig: { ...prev.trendingConfig, [field]: value },
    }));
  };

  const setMode = (mode) => setSearchSettings((prev) => ({ ...prev, trendingMode: mode }));

  const updateItem = (index, field, value) => {
    setSearchSettings((prev) => {
      const next = [...prev.trendingSearches];
      next[index] = { ...next[index], [field]: value };
      return { ...prev, trendingSearches: next };
    });
  };

  const addKeywordItem = () => {
    setSearchSettings((prev) => ({
      ...prev,
      trendingSearches: [...prev.trendingSearches, emptyKeywordItem(prev.trendingSearches.length)],
    }));
  };

  const addProductItem = (product) => {
    const id = String(product._id);
    if (selectedProductIds.has(id)) {
      toast.error(isAr ? 'المنتج مضاف مسبقاً' : 'Product already added');
      return;
    }
    setProductCatalog((prev) => new Map(prev).set(id, product));
    setSearchSettings((prev) => ({
      ...prev,
      trendingSearches: [
        ...prev.trendingSearches,
        {
          productId: product._id,
          query: product.nameAr || product.nameEn || product.name || '',
          labelAr: product.nameAr || product.name || '',
          labelEn: product.nameEn || product.name || '',
          sortOrder: prev.trendingSearches.length,
          isActive: true,
        },
      ],
    }));
    setProductSearch('');
    setProductResults([]);
  };

  const removeItem = (index) => {
    setSearchSettings((prev) => ({
      ...prev,
      trendingSearches: prev.trendingSearches.filter((_, i) => i !== index),
    }));
  };

  const moveItem = (index, direction) => {
    setSearchSettings((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.trendingSearches.length) return prev;
      return { ...prev, trendingSearches: reorderList(prev.trendingSearches, index, target) };
    });
  };

  const reorderTo = (from, to) => {
    if (from == null || from === to) return;
    setSearchSettings((prev) => ({
      ...prev,
      trendingSearches: reorderList(prev.trendingSearches, from, to),
    }));
  };

  const bulkSetActive = (isActive) => {
    setSearchSettings((prev) => ({
      ...prev,
      trendingSearches: prev.trendingSearches.map((item) => ({ ...item, isActive })),
    }));
  };

  const clearList = async () => {
    const ok = await confirm({
      title: isAr ? 'مسح القائمة' : 'Clear the list',
      message: isAr
        ? 'سيتم حذف كل المنتجات وكلمات البحث المُدرجة. لا يمكن التراجع بعد الحفظ.'
        : 'All listed products and keywords will be removed. This cannot be undone after saving.',
      confirmLabel: isAr ? 'مسح' : 'Clear',
      cancelLabel: isAr ? 'إلغاء' : 'Cancel',
    });
    if (!ok) return;
    setSearchSettings((prev) => ({ ...prev, trendingSearches: [] }));
    setProductCatalog(new Map());
  };

  const importFromAnalytics = () => {
    if (!topSearches.length) {
      toast.error(isAr ? 'لا توجد بيانات تحليلات للاستيراد' : 'No analytics data to import');
      return;
    }
    setSearchSettings((prev) => ({
      ...prev,
      trendingMode: prev.trendingMode === 'auto' ? 'hybrid' : prev.trendingMode,
      trendingSearches: topSearches.slice(0, 10).map((item, index) => ({
        query: item.query,
        labelAr: item.query,
        labelEn: item.query,
        productId: null,
        sortOrder: index,
        isActive: true,
      })),
    }));
    setProductCatalog(new Map());
    toast.success(isAr ? 'تم استيراد أكثر عمليات البحث' : 'Imported top searches');
  };

  const addBlocklistTerm = () => {
    const term = normalize(blocklistInput);
    if (!term) return;
    setSearchSettings((prev) => {
      if (prev.trendingConfig.autoBlocklist.includes(term)) return prev;
      return {
        ...prev,
        trendingConfig: {
          ...prev.trendingConfig,
          autoBlocklist: [...prev.trendingConfig.autoBlocklist, term],
        },
      };
    });
    setBlocklistInput('');
  };

  const removeBlocklistTerm = (term) => {
    setConfig('autoBlocklist', trendingConfig.autoBlocklist.filter((t) => t !== term));
  };

  const exportJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      trendingMode,
      trendingConfig,
      trendingSearches: trendingSearches.map(({ _id, ...rest }) => rest),
    };
    downloadBlob(
      new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
      `trending-searches-${new Date().toISOString().slice(0, 10)}.json`,
    );
  };

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const items = Array.isArray(parsed.trendingSearches) ? parsed.trendingSearches : null;
      if (!items) throw new Error('missing trendingSearches');
      const cleanItems = items
        .map((item, index) => ({
          query: String(item.query || item.labelAr || item.labelEn || '').trim(),
          labelAr: String(item.labelAr || item.query || '').trim(),
          labelEn: String(item.labelEn || item.query || '').trim(),
          productId: item.productId && String(item.productId).length === 24 ? item.productId : null,
          sortOrder: index,
          isActive: item.isActive !== false,
        }))
        .filter((item) => item.query || item.productId);
      setSearchSettings((prev) => ({
        trendingMode: MODES.includes(parsed.trendingMode) ? parsed.trendingMode : prev.trendingMode,
        trendingSearches: cleanItems.length ? cleanItems : prev.trendingSearches,
        trendingConfig: { ...prev.trendingConfig, ...(parsed.trendingConfig || {}) },
      }));
      await hydrateProducts(cleanItems);
      toast.success(isAr ? `تم استيراد ${cleanItems.length} عنصراً` : `Imported ${cleanItems.length} items`);
    } catch {
      toast.error(isAr ? 'ملف غير صالح' : 'Invalid file');
    }
  };

  const save = async () => {
    const cleaned = trendingSearches
      .map((item, index) => {
        const product = productFromItem(item, productCatalog);
        const query = item.query?.trim()
          || item.labelAr?.trim()
          || item.labelEn?.trim()
          || product?.nameAr
          || product?.nameEn
          || '';
        return {
          query,
          labelAr: item.labelAr?.trim() || product?.nameAr || query,
          labelEn: item.labelEn?.trim() || product?.nameEn || query,
          productId: item.productId || null,
          sortOrder: index,
          isActive: item.isActive !== false,
        };
      })
      .filter((item) => item.query || item.productId);

    if (trendingMode === 'manual' && !cleaned.length) {
      toast.error(isAr ? 'أضف منتجاً أو كلمة بحث واحدة على الأقل' : 'Add at least one product or search term');
      return;
    }

    const config = {
      displayLimit: Number(trendingConfig.displayLimit) || DEFAULT_TRENDING_CONFIG.displayLimit,
      autoLookbackDays: Number(trendingConfig.autoLookbackDays) || DEFAULT_TRENDING_CONFIG.autoLookbackDays,
      autoMinCount: Number(trendingConfig.autoMinCount) || DEFAULT_TRENDING_CONFIG.autoMinCount,
      requireConversion: !!trendingConfig.requireConversion,
      dedupeByProduct: trendingConfig.dedupeByProduct !== false,
      autoBlocklist: trendingConfig.autoBlocklist,
    };

    setSaving(true);
    try {
      const form = new FormData();
      form.append('settings', JSON.stringify({
        searchSettings: { trendingMode, trendingSearches: cleaned, trendingConfig: config },
      }));
      await adminApi.updateStoreSettings(form);
      setSearchSettings({ trendingMode, trendingSearches: cleaned, trendingConfig: config });
      await hydrateProducts(cleaned);
      toast.success(isAr ? 'تم حفظ الأكثر بحثاً' : 'Trending searches saved');
    } catch (error) {
      toast.error(error.response?.data?.message || (isAr ? 'تعذر الحفظ' : 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  // --- drag & drop ---------------------------------------------------------
  const handleDragStart = (e, index) => {
    if (isFiltering) return;
    e.dataTransfer.effectAllowed = 'move';
    dragIndex.current = index;
  };
  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (dragIndex.current !== null && dragIndex.current !== index) setDragOverIndex(index);
  };
  const handleDrop = (index) => {
    reorderTo(dragIndex.current, index);
    dragIndex.current = null;
    setDragOverIndex(null);
  };
  const handleDragEnd = () => {
    dragIndex.current = null;
    setDragOverIndex(null);
  };

  if (loading) {
    return (
      <div className="flex min-h-[160px] items-center justify-center rounded-2xl border border-border bg-white p-6">
        <Loader />
      </div>
    );
  }

  const showManualList = trendingMode !== 'auto';
  const showAutoPanel = trendingMode !== 'manual';
  const visibleIndexes = trendingSearches
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => {
      if (!isFiltering) return true;
      const needle = normalize(listFilter);
      return [item.query, item.labelAr, item.labelEn].some((v) => normalize(v).includes(needle));
    });

  return (
    <section className="rounded-2xl border border-border bg-white p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-text">
            <Flame className="h-5 w-5 text-orange-500" />
            {isAr ? 'الأكثر بحثاً — ما يراه العميل' : 'Trending searches — customer view'}
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            {isAr
              ? 'اختر منتجات وكلمات بحث تظهر تحت «الأكثر بحثاً» في شريط البحث والصفحة الرئيسية. النقر ينقل العميل مباشرةً إلى المنتج أو نتائج البحث.'
              : 'Curate the products and terms shown under “Trending” in the search bar and home page. A tap opens the product or the search results.'}
          </p>
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            {!compact && topSearches.length > 0 && (
              <Button type="button" variant="secondary" onClick={importFromAnalytics}>
                {isAr ? 'استيراد من التحليلات' : 'Import from analytics'}
              </Button>
            )}
            <Button type="button" onClick={save} disabled={saving}>
              <Save className="h-4 w-4" />
              {saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ' : 'Save')}
            </Button>
          </div>
        )}
      </div>

      {!canEdit && (
        <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {isAr
            ? 'عرض فقط — يتطلب صلاحية إعدادات المتجر للتعديل.'
            : 'Read-only — store settings permission required to edit.'}
        </p>
      )}

      {/* Mode selector */}
      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        {[
          {
            id: 'manual',
            titleAr: 'قائمة يدوية', titleEn: 'Manual list',
            descAr: 'تظهر عناصرك فقط وبالترتيب الذي تحدده.',
            descEn: 'Only your items show, in the order you set.',
          },
          {
            id: 'hybrid',
            titleAr: 'هجين (موصى به)', titleEn: 'Hybrid (recommended)',
            descAr: 'عناصرك المثبّتة أولاً، ثم تُكمل التحليلات الباقي تلقائياً.',
            descEn: 'Your pinned items first, then analytics fills the rest.',
          },
          {
            id: 'auto',
            titleAr: 'تلقائي بالكامل', titleEn: 'Fully automatic',
            descAr: 'مبني كلياً على عمليات البحث الحقيقية المفيدة.',
            descEn: 'Built entirely from real, useful searches.',
          },
        ].map((option) => (
          <label
            key={option.id}
            className={[
              'flex cursor-pointer flex-col gap-1 rounded-xl border p-3 text-sm transition',
              trendingMode === option.id
                ? 'border-primary-400 bg-primary-50/60 ring-1 ring-primary-200'
                : 'border-border hover:border-primary-200',
              !canEdit ? 'cursor-not-allowed opacity-60' : '',
            ].join(' ')}
          >
            <span className="flex items-center gap-2 font-semibold text-text">
              <input
                type="radio"
                name="trendingMode"
                checked={trendingMode === option.id}
                onChange={() => setMode(option.id)}
                disabled={!canEdit}
              />
              {isAr ? option.titleAr : option.titleEn}
            </span>
            <span className="text-xs text-text-muted">{isAr ? option.descAr : option.descEn}</span>
          </label>
        ))}
      </div>

      {/* Preview */}
      {showManualList && previewItems.length > 0 && (
        <div className="mb-5 rounded-xl border border-orange-100 bg-orange-50/50 p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-orange-800">
              <Flame className="h-3.5 w-3.5" />
              {isAr ? 'معاينة ما يراه العميل' : 'Customer preview'}
            </p>
            <div className="flex overflow-hidden rounded-lg border border-orange-200 text-xs">
              {[
                { id: 'search', labelAr: 'شريط البحث', labelEn: 'Search bar' },
                { id: 'home', labelAr: 'الصفحة الرئيسية', labelEn: 'Home page' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setPreviewSurface(tab.id)}
                  className={previewSurface === tab.id
                    ? 'bg-orange-500 px-2.5 py-1 font-semibold text-white'
                    : 'bg-white px-2.5 py-1 text-orange-700'}
                >
                  {isAr ? tab.labelAr : tab.labelEn}
                </button>
              ))}
            </div>
          </div>

          {['ar', 'en'].map((lang) => (
            <div key={lang} className="mb-1.5 flex flex-wrap items-center gap-1.5">
              <span className="w-6 text-[10px] font-bold uppercase text-orange-400">{lang}</span>
              {previewItems.map((item) => (
                <span
                  key={`${lang}-${item.key}`}
                  className={previewSurface === 'home'
                    ? 'rounded-full border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-medium text-orange-900'
                    : 'rounded-full bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-800 ring-1 ring-orange-100'}
                >
                  {lang === 'ar' ? item.labelAr : item.labelEn}
                </span>
              ))}
            </div>
          ))}

          {trendingMode === 'hybrid' && (
            <p className="mt-2 text-[11px] text-orange-700">
              {isAr
                ? `+ تُكمل التحليلات النتائج تلقائياً حتى ${trendingConfig.displayLimit} عنصراً.`
                : `+ analytics auto-fills up to ${trendingConfig.displayLimit} items.`}
            </p>
          )}
        </div>
      )}

      {/* Auto-tuning panel */}
      {showAutoPanel && (
        <div className="mb-5 rounded-xl border border-border bg-slate-50/60 p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-text">
            <Sparkles className="h-4 w-4 text-primary-600" />
            {isAr ? 'ضبط النتائج التلقائية' : 'Auto results tuning'}
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Input
              type="number"
              min={1}
              max={20}
              label={isAr ? 'عدد العناصر المعروضة' : 'Items shown'}
              value={trendingConfig.displayLimit}
              onChange={(e) => setConfig('displayLimit', e.target.value)}
              disabled={!canEdit}
            />
            <Input
              type="number"
              min={1}
              max={30}
              label={isAr ? 'فترة التحليل (أيام)' : 'Lookback window (days)'}
              value={trendingConfig.autoLookbackDays}
              onChange={(e) => setConfig('autoLookbackDays', e.target.value)}
              disabled={!canEdit}
            />
            <Input
              type="number"
              min={1}
              label={isAr ? 'أقل عدد عمليات بحث' : 'Minimum searches'}
              value={trendingConfig.autoMinCount}
              onChange={(e) => setConfig('autoMinCount', e.target.value)}
              disabled={!canEdit}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm text-text">
              <input
                type="checkbox"
                checked={!!trendingConfig.requireConversion}
                onChange={(e) => setConfig('requireConversion', e.target.checked)}
                disabled={!canEdit}
              />
              {isAr ? 'اشترط تحويلاً واحداً على الأقل' : 'Require at least one conversion'}
            </label>
            <label className="flex items-center gap-2 text-sm text-text">
              <input
                type="checkbox"
                checked={trendingConfig.dedupeByProduct !== false}
                onChange={(e) => setConfig('dedupeByProduct', e.target.checked)}
                disabled={!canEdit}
              />
              {isAr ? 'بدون تكرار نفس المنتج' : 'No duplicate products'}
            </label>
          </div>

          <div className="mt-4">
            <p className="mb-1.5 text-sm font-medium text-text">
              {isAr ? 'كلمات محجوبة (لا تظهر أبداً تلقائياً)' : 'Blocked terms (never auto-shown)'}
            </p>
            {canEdit && (
              <div className="flex gap-2">
                <Input
                  value={blocklistInput}
                  onChange={(e) => setBlocklistInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addBlocklistTerm(); } }}
                  placeholder={isAr ? 'مثال: تجربة' : 'e.g. test'}
                />
                <Button type="button" variant="secondary" onClick={addBlocklistTerm}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
            {trendingConfig.autoBlocklist.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {trendingConfig.autoBlocklist.map((term) => (
                  <span
                    key={term}
                    className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700"
                  >
                    {term}
                    {canEdit && (
                      <button type="button" onClick={() => removeBlocklistTerm(term)} aria-label={isAr ? 'إزالة' : 'Remove'}>
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {trendingMode === 'auto' && (
        <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-text-muted">
          {isAr
            ? 'سيُعرض للعميل أسماء منتجات مطابقة لعمليات بحث حقيقية ومفيدة ضمن الفترة المحددة أعلاه. تُستبعد الاستعلامات القصيرة والنتائج الفارغة والكلمات المحجوبة.'
            : 'Customers see product names matching real, useful searches within the window above. Short queries, zero-result queries and blocked terms are excluded.'}
        </p>
      )}

      {showManualList && (
        <div className="space-y-5">
          {canEdit && (
            <div className="rounded-xl border border-dashed border-primary-200 bg-primary-50/30 p-4">
              <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-text">
                <Package className="h-4 w-4 text-primary-600" />
                {isAr ? 'إضافة منتج' : 'Add product'}
              </p>
              <div className="relative">
                <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder={isAr ? 'ابحث عن منتج بالاسم أو الماركة...' : 'Search products by name or brand...'}
                  inputClassName="ps-10"
                />
              </div>
              {productSearch.trim() && (
                <div className="mt-2 overflow-hidden rounded-xl border border-border bg-white">
                  {searchingProducts ? (
                    <p className="px-4 py-3 text-sm text-text-muted">{isAr ? 'جار البحث...' : 'Searching...'}</p>
                  ) : productResults.filter((p) => !selectedProductIds.has(String(p._id))).length ? (
                    <ul className="max-h-52 divide-y divide-border overflow-y-auto">
                      {productResults
                        .filter((p) => !selectedProductIds.has(String(p._id)))
                        .map((product) => (
                          <li key={product._id}>
                            <button
                              type="button"
                              onClick={() => addProductItem(product)}
                              className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-start text-sm hover:bg-slate-50"
                            >
                              <span>
                                {isAr ? (product.nameAr || product.nameEn) : (product.nameEn || product.nameAr)}
                                {product.price != null ? ` (${product.price} ${isAr ? 'ج.م' : 'EGP'})` : ''}
                              </span>
                              <Plus className="h-4 w-4 shrink-0 text-primary-600" />
                            </button>
                          </li>
                        ))}
                    </ul>
                  ) : (
                    <p className="px-4 py-3 text-sm text-text-muted">{isAr ? 'لا توجد نتائج' : 'No products found'}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Toolbar: warnings + bulk + filter + import/export */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-text">
                {trendingMode === 'hybrid'
                  ? (isAr ? 'العناصر المثبّتة' : 'Pinned items')
                  : (isAr ? 'العناصر' : 'Items')}
                {' '}
                <span className="text-text-muted">({trendingSearches.length})</span>
              </span>
              {warningCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                  <AlertTriangle className="h-3 w-3" />
                  {isAr ? `${warningCount} تحذير` : `${warningCount} warning${warningCount > 1 ? 's' : ''}`}
                </span>
              )}
            </div>
            {canEdit && (
              <div className="flex flex-wrap items-center gap-1.5">
                <Button type="button" variant="secondary" onClick={() => bulkSetActive(true)}>
                  {isAr ? 'تفعيل الكل' : 'Activate all'}
                </Button>
                <Button type="button" variant="secondary" onClick={() => bulkSetActive(false)}>
                  {isAr ? 'تعطيل الكل' : 'Deactivate all'}
                </Button>
                <Button type="button" variant="secondary" onClick={exportJson}>
                  <Download className="h-4 w-4" />
                </Button>
                <Button type="button" variant="secondary" onClick={() => importInputRef.current?.click()}>
                  <Upload className="h-4 w-4" />
                </Button>
                <input
                  ref={importInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={handleImportFile}
                />
                {trendingSearches.length > 0 && (
                  <Button type="button" variant="danger" onClick={clearList}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>

          {trendingSearches.length > 6 && (
            <div className="relative">
              <Filter className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={listFilter}
                onChange={(e) => setListFilter(e.target.value)}
                placeholder={isAr ? 'تصفية العناصر...' : 'Filter items...'}
                inputClassName="ps-10"
              />
            </div>
          )}

          {isFiltering && (
            <p className="text-xs text-text-muted">
              {isAr
                ? 'تعطُّل السحب أثناء التصفية — امسح التصفية لإعادة الترتيب.'
                : 'Drag is disabled while filtering — clear the filter to reorder.'}
            </p>
          )}

          <div className="space-y-3">
            {visibleIndexes.map(({ item, index }) => {
              const product = productFromItem(item, productCatalog);
              const isProduct = Boolean(item.productId);
              const warnings = itemWarnings(item, index, trendingSearches, productCatalog, isAr);
              const isDropTarget = dragOverIndex === index;

              return (
                <div
                  key={item._id || `trend-${index}-${item.productId || item.query}`}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={() => handleDrop(index)}
                  onDragEnd={handleDragEnd}
                  className={[
                    'rounded-xl border bg-slate-50/60 p-4 transition',
                    isDropTarget ? 'border-primary-400 ring-2 ring-primary-200' : 'border-border',
                    item.isActive === false ? 'opacity-60' : '',
                  ].join(' ')}
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {canEdit && (
                        <button
                          type="button"
                          draggable={!isFiltering}
                          onDragStart={(e) => handleDragStart(e, index)}
                          className="cursor-grab rounded-lg border border-border p-2 text-slate-400 hover:bg-white active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40"
                          disabled={isFiltering}
                          aria-label={isAr ? 'اسحب لإعادة الترتيب' : 'Drag to reorder'}
                        >
                          <GripVertical className="h-4 w-4" />
                        </button>
                      )}
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                        isProduct ? 'bg-primary-100 text-primary-800' : 'bg-slate-200 text-slate-700'
                      }`}
                      >
                        {isProduct ? <Package className="h-3 w-3" /> : <Type className="h-3 w-3" />}
                        {isProduct ? (isAr ? 'منتج' : 'Product') : (isAr ? 'كلمة بحث' : 'Keyword')}
                      </span>
                      <span className="text-xs text-text-muted">#{index + 1}</span>
                    </div>
                    {canEdit && (
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={item.isActive !== false}
                            onChange={(e) => updateItem(index, 'isActive', e.target.checked)}
                          />
                          {isAr ? 'نشط' : 'Active'}
                        </label>
                        <button
                          type="button"
                          onClick={() => moveItem(index, -1)}
                          className="rounded-lg border border-border p-2 hover:bg-white"
                          aria-label={isAr ? 'أعلى' : 'Move up'}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveItem(index, 1)}
                          className="rounded-lg border border-border p-2 hover:bg-white"
                          aria-label={isAr ? 'أسفل' : 'Move down'}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50"
                          aria-label={isAr ? 'حذف' : 'Remove'}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {isProduct && product && (
                    <p className="mb-3 text-sm font-medium text-text">
                      {isAr ? (product.nameAr || product.nameEn) : (product.nameEn || product.nameAr)}
                    </p>
                  )}

                  {warnings.length > 0 && (
                    <ul className="mb-3 space-y-1">
                      {warnings.map((warning) => (
                        <li key={warning} className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
                          <AlertTriangle className="h-3 w-3 shrink-0" />
                          {warning}
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="grid gap-3 md:grid-cols-3">
                    <Input
                      label={isAr ? 'كلمة البحث (اختياري للمنتج)' : 'Search query (optional for products)'}
                      value={item.query}
                      onChange={(e) => updateItem(index, 'query', e.target.value)}
                      placeholder={isAr ? 'مثال: هيد آند شولدرز' : 'e.g. head shoulders'}
                      disabled={!canEdit}
                    />
                    <Input
                      label={isAr ? 'التسمية (عربي)' : 'Label (Arabic)'}
                      value={item.labelAr}
                      onChange={(e) => updateItem(index, 'labelAr', e.target.value)}
                      placeholder="هيد آند شولدرز"
                      disabled={!canEdit}
                    />
                    <Input
                      label={isAr ? 'التسمية (English)' : 'Label (English)'}
                      value={item.labelEn}
                      onChange={(e) => updateItem(index, 'labelEn', e.target.value)}
                      placeholder="Head & Shoulders"
                      disabled={!canEdit}
                    />
                  </div>
                </div>
              );
            })}
            {isFiltering && visibleIndexes.length === 0 && (
              <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-text-muted">
                {isAr ? 'لا عناصر مطابقة للتصفية' : 'No items match the filter'}
              </p>
            )}
          </div>

          {canEdit && (
            <Button type="button" variant="secondary" onClick={addKeywordItem}>
              <Plus className="h-4 w-4" />
              {isAr ? 'إضافة كلمة بحث' : 'Add keyword'}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
