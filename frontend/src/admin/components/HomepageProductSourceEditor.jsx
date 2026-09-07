import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, Sparkles } from 'lucide-react';
import { adminApi } from '../adminApi';
import Input from '../../components/ui/Input';
import ProductMultiPicker from './ProductMultiPicker';
import CategorySectionPreview from './CategorySectionPreview';
import { PRODUCT_SORT_OPTIONS } from '../utils/homepageSectionMeta';
import {
  PRODUCT_LIMIT_PRESETS,
  PRODUCT_SOURCE_MODES,
  buildProductSuggestionParams,
  normalizeProductLimit,
  productDisplayName,
  resolveProductSourceMode,
} from '../utils/productSourceUtils';
import { pickProductImage } from '../../utils/imageHelpers';

function SuggestionCard({ product, isAr, selected, disabled, onToggle }) {
  const title = productDisplayName(product, isAr);
  const image = pickProductImage(product);
  const price = Number(product.price ?? 0);
  const oldPrice = Number(product.oldPrice ?? 0);
  const discount = Number(product.discount ?? product.discountPercent ?? 0);

  return (
    <button
      type="button"
      onClick={() => onToggle(product)}
      disabled={disabled && !selected}
      className={[
        'flex w-full flex-col overflow-hidden rounded-xl border text-start transition',
        selected
          ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-200'
          : 'border-border bg-white hover:border-emerald-300 hover:shadow-sm',
        disabled && !selected ? 'cursor-not-allowed opacity-50' : '',
      ].join(' ')}
    >
      <div className="relative flex h-20 items-center justify-center bg-slate-50 p-2">
        {image ? (
          <img src={image} alt="" className="max-h-full max-w-full object-contain" loading="lazy" />
        ) : (
          <span className="text-2xl text-slate-300" aria-hidden>📦</span>
        )}
        {discount > 0 && (
          <span className="absolute start-1.5 top-1.5 rounded-md bg-red-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
            -{discount}%
          </span>
        )}
        {selected && (
          <span className="absolute end-1.5 top-1.5 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
            ✓
          </span>
        )}
      </div>
      <div className="space-y-0.5 p-2">
        <p className="line-clamp-2 min-h-[2rem] text-[10px] font-semibold leading-tight text-text">{title}</p>
        <div className="flex flex-wrap items-center gap-1">
          <p className="text-[10px] font-bold tabular-nums text-primary-700">
            {price.toFixed(price % 1 ? 2 : 0)} EGP
          </p>
          {oldPrice > price && (
            <p className="text-[9px] text-text-muted line-through tabular-nums">{oldPrice.toFixed(2)}</p>
          )}
        </div>
      </div>
    </button>
  );
}

export default function HomepageProductSourceEditor({
  isAr,
  form,
  categories = [],
  onQueryChange,
  onFieldChange,
  accent = 'emerald',
  readOnly = false,
  readOnlyHint = '',
}) {
  const productQuery = form.productQuery || {};
  const maxItems = normalizeProductLimit(productQuery.limit, 12);
  const sourceMode = resolveProductSourceMode(form);
  const selectedIds = useMemo(() => (form.products || []).map(String), [form.products]);

  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestionError, setSuggestionError] = useState('');

  const accentBtn = accent === 'orange' ? 'bg-orange-600' : 'bg-emerald-600';
  const accentRing = accent === 'orange' ? 'ring-orange-200 border-orange-400' : 'ring-emerald-200 border-emerald-400';

  const loadSuggestions = useCallback(async () => {
    setLoadingSuggestions(true);
    setSuggestionError('');
    try {
      const params = buildProductSuggestionParams(productQuery, {
        categories,
        categoryId: form.category || '',
      });
      const { data } = await adminApi.getProducts(params);
      setSuggestions(data.data || []);
    } catch {
      setSuggestions([]);
      setSuggestionError(isAr ? 'تعذّر تحميل المنتجات المقترحة' : 'Could not load suggested products');
    } finally {
      setLoadingSuggestions(false);
    }
  }, [categories, form.category, isAr, productQuery]);

  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions]);

  const setSourceMode = (mode) => {
    if (mode === 'auto') {
      onFieldChange({ products: [] });
    }
  };

  const setLimit = (value) => {
    onQueryChange('limit', normalizeProductLimit(value, maxItems));
  };

  const toggleSuggestion = (product) => {
    const id = String(product._id);
    const current = form.products || [];
    if (current.map(String).includes(id)) {
      onFieldChange({ products: current.filter((item) => String(item) !== id) });
      return;
    }
    if (current.length >= maxItems) return;
    onFieldChange({ products: [...current, product._id] });
  };

  const addAllSuggestions = () => {
    const current = new Set((form.products || []).map(String));
    const next = [...(form.products || [])];
    suggestions.forEach((product) => {
      const id = String(product._id);
      if (current.has(id) || next.length >= maxItems) return;
      current.add(id);
      next.push(product._id);
    });
    onFieldChange({ products: next });
  };

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const canAddMore = selectedIds.length < maxItems;

  return (
    <div className="space-y-5 border-t border-border pt-5">
      {readOnly && readOnlyHint && (
        <p className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-950">
          {readOnlyHint}
        </p>
      )}

      {!readOnly && (
      <>
      <div>
        <p className="mb-2 text-xs font-bold text-text">{isAr ? 'مصدر المنتجات' : 'Product source'}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {PRODUCT_SOURCE_MODES.map((mode) => (
            <button
              key={mode.value}
              type="button"
              onClick={() => setSourceMode(mode.value)}
              className={`rounded-xl border p-3 text-start transition ${
                sourceMode === mode.value
                  ? `${accentRing} ring-2`
                  : 'border-border hover:border-slate-300'
              }`}
            >
              <p className="text-sm font-bold text-text">{isAr ? mode.labelAr : mode.labelEn}</p>
              <p className="mt-0.5 text-[10px] text-text-muted">{isAr ? mode.hintAr : mode.hintEn}</p>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-bold text-text">
          {isAr ? 'الحد الأقصى للمنتجات' : 'Maximum products'}
        </p>
        <div className="flex flex-wrap gap-2">
          {PRODUCT_LIMIT_PRESETS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setLimit(n)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                maxItems === n ? `${accentBtn} text-white` : 'border border-border hover:bg-slate-50'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="mt-3 max-w-[160px]">
          <Input
            label={isAr ? 'عدد مخصص' : 'Custom count'}
            type="number"
            min="1"
            max="24"
            value={maxItems}
            onChange={(e) => setLimit(e.target.value)}
          />
        </div>
        <p className="mt-2 text-[10px] text-text-muted">
          {sourceMode === 'auto'
            ? (isAr
              ? `سيُعرض حتى ${maxItems} منتجاً تلقائياً حسب الفلاتر.`
              : `Up to ${maxItems} products will load automatically from filters.`)
            : (isAr
              ? `يمكنك اختيار حتى ${maxItems} منتجاً يدوياً (${selectedIds.length} محدد).`
              : `You can pick up to ${maxItems} products manually (${selectedIds.length} selected).`)}
        </p>
      </div>

      <div>
        <p className="mb-2 text-xs font-bold text-text">{isAr ? 'فلاتر المنتجات' : 'Product filters'}</p>
        {(form.category) && (
          <CategorySectionPreview
            categoryId={form.category}
            categories={categories}
            categoryIssue={form.categoryIssue}
            isAr={isAr}
            productQuery={productQuery}
            sectionLimit={maxItems}
            className="mb-3"
          />
        )}
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium">{isAr ? 'ترتيب المنتجات' : 'Sort order'}</label>
            <select
              className="w-full rounded-xl border border-border px-4 py-2.5 text-sm"
              value={productQuery.sort || 'newest'}
              onChange={(e) => onQueryChange('sort', e.target.value)}
            >
              {PRODUCT_SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{isAr ? opt.labelAr : opt.labelEn}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">{isAr ? 'فلتر القسم' : 'Section filter'}</label>
            <select
              className="w-full rounded-xl border border-border px-4 py-2.5 text-sm"
              value={productQuery.section || ''}
              onChange={(e) => onQueryChange('section', e.target.value)}
            >
              <option value="">{isAr ? 'بدون' : 'None'}</option>
              <option value="best-sellers">{isAr ? 'الأكثر مبيعاً' : 'Best sellers'}</option>
              <option value="new-arrivals">{isAr ? 'وصل حديثاً' : 'New arrivals'}</option>
              <option value="top">{isAr ? 'مميز / الأعلى تقييماً' : 'Featured / top rated'}</option>
              <option value="offers">{isAr ? 'عروض وتخفيضات' : 'Offers & discounts'}</option>
            </select>
          </div>
          <Input
            label={isAr ? 'ماركة (slug)' : 'Brand (slug)'}
            value={productQuery.brand || ''}
            onChange={(e) => onQueryChange('brand', e.target.value)}
            placeholder="dettol"
            dir="ltr"
          />
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input
              type="checkbox"
              checked={!!productQuery.offers}
              onChange={(e) => onQueryChange('offers', e.target.checked)}
            />
            {isAr ? 'منتجات العروض فقط (خصم حقيقي)' : 'Real offers only (actual discount)'}
          </label>
        </div>
        {productQuery.offers && (
          <p className="mt-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-950">
            {isAr
              ? '↪ يُعرض فقط المنتجات التي لها خصم % أو عرض نشط — أنشئ العروض من «العروض والتخفيضات» في القائمة.'
              : '↪ Only products with a real discount or active promotion — manage offers under Store → Offers & promotions.'}
          </p>
        )}
      </div>

      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" aria-hidden />
            <p className="text-xs font-bold text-text">
              {isAr ? 'منتجات مقترحة' : 'Suggested products'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={loadSuggestions}
              disabled={loadingSuggestions}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingSuggestions ? 'animate-spin' : ''}`} />
              {isAr ? 'تحديث' : 'Refresh'}
            </button>
            {suggestions.length > 0 && (
              <button
                type="button"
                onClick={addAllSuggestions}
                disabled={!canAddMore && selectedIds.length >= maxItems}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50 ${accentBtn}`}
              >
                <Plus className="h-3.5 w-3.5" />
                {isAr ? 'إضافة الكل' : 'Add all'}
              </button>
            )}
          </div>
        </div>
        <p className="mb-3 text-[10px] text-text-muted">
          {selectedIds.length === 0
            ? (isAr
              ? 'معاينة حسب الفلاتر — انقر أي منتج لإضافته يدوياً، أو استخدم «إضافة الكل».'
              : 'Preview from filters — click any product to hand-pick it, or use “Add all”.')
            : (isAr
              ? 'انقر لإضافة/إزالة — الترتيب من قائمة «المنتجات المحددة» أدناه.'
              : 'Click to add/remove — reorder in the hand-picked list below.')}
        </p>

        {suggestionError && (
          <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{suggestionError}</p>
        )}

        {loadingSuggestions ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {Array.from({ length: Math.min(maxItems, 8) }).map((_, i) => (
              <div key={i} className="h-[132px] animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : suggestions.length ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {suggestions.map((product) => (
              <SuggestionCard
                key={product._id}
                product={product}
                isAr={isAr}
                selected={selectedSet.has(String(product._id))}
                disabled={!canAddMore && !selectedSet.has(String(product._id))}
                onToggle={toggleSuggestion}
              />
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-text-muted">
            {isAr ? 'لا توجد منتجات مطابقة — جرّب فلاتر أخرى.' : 'No matching products — try different filters.'}
          </p>
        )}
      </div>

      {sourceMode === 'manual' && (
        <div>
          <p className="mb-2 text-xs font-bold text-text">
            {isAr ? 'المنتجات المحددة' : 'Hand-picked products'}
          </p>
          <p className="mb-3 text-[10px] text-text-muted">
            {isAr
              ? 'رتّب المنتجات أو أزلها — الترتيب يظهر في الموقع كما هو.'
              : 'Reorder or remove products — order is preserved on the storefront.'}
          </p>
          <ProductMultiPicker
            value={form.products || []}
            onChange={(products) => onFieldChange({ products })}
            seedProducts={[...(form.productDetails || []), ...suggestions]}
            categories={categories}
            isAr={isAr}
            maxItems={maxItems}
          />
        </div>
      )}

      {readOnly && selectedIds.length > 0 && (
        <p className="text-xs text-text-muted">
          {isAr
            ? `${selectedIds.length} منتجاً من الحملة المرتبطة`
            : `${selectedIds.length} product(s) from linked campaign`}
        </p>
      )}
      </>
      )}
    </div>
  );
}
