import { useCallback, useEffect, useMemo, useState } from 'react';
import { Flame, Package, Plus, Save, Search, Trash2, ArrowDown, ArrowUp, Type } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { adminApi } from '../adminApi';
import { hasPermission } from '../adminPermissions';
import { fetchProductsByIds } from '../../services/productApi';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Loader from '../../components/ui/Loader';
import { useToast } from './index';

const emptyKeywordItem = (sortOrder = 0) => ({
  query: '',
  labelAr: '',
  labelEn: '',
  productId: null,
  sortOrder,
  isActive: true,
});

function productFromItem(item, catalog) {
  if (!item?.productId) return null;
  return catalog.get(String(item.productId)) || null;
}

function itemDisplayLabel(item, product, isAr) {
  if (isAr) return item.labelAr || product?.nameAr || product?.nameEn || item.query;
  return item.labelEn || product?.nameEn || product?.nameAr || item.query;
}

export default function TrendingSearchesAdmin({ topSearches = [], compact = false }) {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { user } = useAuth();
  const toast = useToast();
  const canEdit = hasPermission(user, 'settings:write');

  const [searchSettings, setSearchSettings] = useState({
    trendingMode: 'manual',
    trendingSearches: [],
  });
  const [productCatalog, setProductCatalog] = useState(new Map());
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState([]);
  const [searchingProducts, setSearchingProducts] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
        const items = ss.trendingSearches?.length
          ? ss.trendingSearches
          : [emptyKeywordItem()];
        setSearchSettings({
          trendingMode: ss.trendingMode === 'auto' ? 'auto' : 'manual',
          trendingSearches: items,
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
      searchSettings.trendingSearches
        .map((item) => item.productId)
        .filter(Boolean)
        .map(String),
    ),
    [searchSettings.trendingSearches],
  );

  const previewItems = useMemo(
    () => searchSettings.trendingSearches
      .filter((item) => item.isActive !== false)
      .map((item) => {
        const product = productFromItem(item, productCatalog);
        return {
          key: item._id || item.productId || item.query,
          label: itemDisplayLabel(item, product, isAr),
        };
      })
      .filter((item) => item.label),
    [searchSettings.trendingSearches, productCatalog, isAr],
  );

  const updateItem = (index, field, value) => {
    setSearchSettings((prev) => {
      const trendingSearches = [...prev.trendingSearches];
      trendingSearches[index] = { ...trendingSearches[index], [field]: value };
      return { ...prev, trendingSearches };
    });
  };

  const addKeywordItem = () => {
    setSearchSettings((prev) => ({
      ...prev,
      trendingSearches: [
        ...prev.trendingSearches,
        emptyKeywordItem(prev.trendingSearches.length),
      ],
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
      const items = [...prev.trendingSearches];
      const target = index + direction;
      if (target < 0 || target >= items.length) return prev;
      [items[index], items[target]] = [items[target], items[index]];
      return {
        ...prev,
        trendingSearches: items.map((item, i) => ({ ...item, sortOrder: i })),
      };
    });
  };

  const importFromAnalytics = () => {
    if (!topSearches.length) {
      toast.error(isAr ? 'لا توجد بيانات تحليلات للاستيراد' : 'No analytics data to import');
      return;
    }
    setSearchSettings((prev) => ({
      ...prev,
      trendingMode: 'manual',
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

  const save = async () => {
    const cleaned = searchSettings.trendingSearches
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

    if (searchSettings.trendingMode === 'manual' && !cleaned.length) {
      toast.error(isAr ? 'أضف منتجاً أو كلمة بحث واحدة على الأقل' : 'Add at least one product or search term');
      return;
    }

    setSaving(true);
    try {
      const form = new FormData();
      form.append('settings', JSON.stringify({
        searchSettings: {
          trendingMode: searchSettings.trendingMode,
          trendingSearches: cleaned,
        },
      }));
      await adminApi.updateStoreSettings(form);
      setSearchSettings((prev) => ({ ...prev, trendingSearches: cleaned }));
      await hydrateProducts(cleaned);
      toast.success(isAr ? 'تم حفظ الأكثر بحثاً' : 'Trending searches saved');
    } catch (error) {
      toast.error(error.response?.data?.message || (isAr ? 'تعذر الحفظ' : 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[160px] items-center justify-center rounded-2xl border border-border bg-white p-6">
        <Loader />
      </div>
    );
  }

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
              ? 'اختر منتجات تظهر في قائمة البحث تحت «الأكثر بحثاً». ستظهر أسماء المنتجات فقط، وينقل النقر العميل مباشرةً إلى صفحة المنتج.'
              : 'Choose products for the customer-facing “Trending” list. Product names are shown and each chip opens the product page directly.'}
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

      {searchSettings.trendingMode === 'manual' && previewItems.length > 0 && (
        <div className="mb-5 rounded-xl border border-orange-100 bg-orange-50/50 p-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-orange-800">
            <Flame className="h-3.5 w-3.5" />
            {isAr ? 'معاينة — الأكثر بحثاً' : 'Preview — Trending'}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {previewItems.map((item) => (
              <span
                key={item.key}
                className="rounded-full bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-800 ring-1 ring-orange-100"
              >
                {item.label}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-3">
        <label className="flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm">
          <input
            type="radio"
            name="trendingMode"
            checked={searchSettings.trendingMode === 'manual'}
            onChange={() => setSearchSettings((prev) => ({ ...prev, trendingMode: 'manual' }))}
            disabled={!canEdit}
          />
          {isAr ? 'قائمة يدوية (موصى به)' : 'Manual list (recommended)'}
        </label>
        <label className="flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm">
          <input
            type="radio"
            name="trendingMode"
            checked={searchSettings.trendingMode === 'auto'}
            onChange={() => setSearchSettings((prev) => ({ ...prev, trendingMode: 'auto' }))}
            disabled={!canEdit}
          />
          {isAr ? 'تلقائي من تحليلات البحث' : 'Auto from search analytics'}
        </label>
      </div>

      {searchSettings.trendingMode === 'auto' ? (
        <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-text-muted">
          {isAr
            ? 'سيُعرض للعميل أسماء منتجات مطابقة لعمليات بحث حقيقية ومفيدة خلال آخر 7 أيام. تُستبعد الاستعلامات القصيرة والنتائج الفارغة.'
            : 'Customers will see matching product names from useful searches in the last 7 days. Short and zero-result queries are excluded.'}
        </p>
      ) : (
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
                    <p className="px-4 py-3 text-sm text-text-muted">
                      {isAr ? 'جار البحث...' : 'Searching...'}
                    </p>
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
                    <p className="px-4 py-3 text-sm text-text-muted">
                      {isAr ? 'لا توجد نتائج' : 'No products found'}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="space-y-3">
            {searchSettings.trendingSearches.map((item, index) => {
              const product = productFromItem(item, productCatalog);
              const isProduct = Boolean(item.productId);

              return (
                <div
                  key={item._id || `trend-${index}-${item.productId || item.query}`}
                  className="rounded-xl border border-border bg-slate-50/60 p-4"
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      isProduct ? 'bg-primary-100 text-primary-800' : 'bg-slate-200 text-slate-700'
                    }`}
                    >
                      {isProduct ? <Package className="h-3 w-3" /> : <Type className="h-3 w-3" />}
                      {isProduct ? (isAr ? 'منتج' : 'Product') : (isAr ? 'كلمة بحث' : 'Keyword')}
                    </span>
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
                      placeholder={isAr ? 'هيد آند شولدرز' : 'هيد آند شولدرز'}
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
