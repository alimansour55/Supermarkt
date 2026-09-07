import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  FolderOpen,
  LayoutGrid,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { adminApi } from '../adminApi';
import Input from '../../components/ui/Input';
import ProductSuggestionCard from './ProductSuggestionCard';
import CategoryBrowsePicker from './CategoryBrowsePicker';
import BrandFilterSelect from './BrandFilterSelect';
import {
  PICKER_BROWSE_PRESETS,
  buildPickerFetchParams,
  productPickerLabel,
  readRecentProductPicks,
  rememberProductPick,
} from '../utils/productPickerUtils';

const TABS = [
  { id: 'suggest', icon: Sparkles, labelAr: 'مقترحات', labelEn: 'Suggestions' },
  { id: 'category', icon: FolderOpen, labelAr: 'حسب القسم', labelEn: 'By category' },
  { id: 'search', icon: Search, labelAr: 'بحث', labelEn: 'Search' },
];

function ProductMultiPicker({
  value = [],
  onChange,
  seedProducts = [],
  categories = [],
  brands = [],
  isAr,
  maxItems = 24,
  showBrowse = true,
}) {
  const [tab, setTab] = useState('suggest');
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [catalog, setCatalog] = useState(new Map());

  const [browsePreset, setBrowsePreset] = useState('newest');
  const [browseCategory, setBrowseCategory] = useState('');
  const [browseBrand, setBrowseBrand] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestionPage, setSuggestionPage] = useState(1);
  const [suggestionTotal, setSuggestionTotal] = useState(0);

  useEffect(() => {
    setCatalog((prev) => {
      const next = new Map(prev);
      seedProducts.forEach((product) => {
        if (product?._id) next.set(String(product._id), product);
      });
      return next;
    });
  }, [seedProducts]);

  const selectedIds = useMemo(() => value.map(String), [value]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const canAddMore = selectedIds.length < maxItems;

  const mergeCatalog = useCallback((items) => {
    if (!items?.length) return;
    setCatalog((prev) => {
      const next = new Map(prev);
      items.forEach((product) => {
        if (product?._id) next.set(String(product._id), product);
      });
      return next;
    });
  }, []);

  const loadSuggestions = useCallback(async ({ page = 1, append = false } = {}) => {
    setLoadingSuggestions(true);
    try {
      if (browsePreset === 'recent') {
        const recent = readRecentProductPicks();
        setSuggestions(recent);
        setSuggestionTotal(recent.length);
        setSuggestionPage(1);
        return;
      }

      const params = buildPickerFetchParams({
        presetId: browsePreset,
        categoryId: tab === 'category' ? browseCategory : '',
        categories,
        brand: browseBrand,
        page,
        limit: 12,
      });

      const { data } = await adminApi.getProducts(params);
      const items = data.data || [];
      mergeCatalog(items);
      setSuggestions((prev) => (append ? [...prev, ...items] : items));
      setSuggestionTotal(data.pagination?.total ?? items.length);
      setSuggestionPage(page);
    } catch {
      if (!append) setSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  }, [browsePreset, browseBrand, browseCategory, categories, mergeCatalog, tab]);

  useEffect(() => {
    if (!showBrowse || tab === 'search') return;
    if (tab === 'category' && !browseCategory) {
      setSuggestions([]);
      setSuggestionTotal(0);
      return;
    }
    loadSuggestions({ page: 1, append: false });
  }, [showBrowse, tab, browsePreset, browseCategory, browseBrand, loadSuggestions]);

  useEffect(() => {
    const query = search.trim();
    if (!query) {
      setSearchResults([]);
      return undefined;
    }

    let active = true;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await adminApi.getProducts({ q: query, page: 1, limit: 24, isActive: 'true' });
        if (!active) return;
        const items = data.data || [];
        setSearchResults(items);
        mergeCatalog(items);
      } catch {
        if (active) setSearchResults([]);
      } finally {
        if (active) setSearching(false);
      }
    }, 280);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [search, mergeCatalog]);

  const addProduct = (product) => {
    const id = String(product._id);
    if (selectedSet.has(id) || selectedIds.length >= maxItems) return;
    rememberProductPick(product);
    mergeCatalog([product]);
    onChange([...value, product._id]);
  };

  const toggleProduct = (product) => {
    const id = String(product._id);
    if (selectedSet.has(id)) {
      onChange(value.filter((item) => String(item) !== id));
      return;
    }
    addProduct(product);
  };

  const addAllVisible = (items) => {
    const next = [...value];
    const seen = new Set(selectedIds);
    items.forEach((product) => {
      const id = String(product._id);
      if (seen.has(id) || next.length >= maxItems) return;
      seen.add(id);
      rememberProductPick(product);
      mergeCatalog([product]);
      next.push(product._id);
    });
    onChange(next);
  };

  const removeProduct = (id) => {
    onChange(value.filter((item) => String(item) !== String(id)));
  };

  const moveProduct = (index, direction) => {
    const next = [...value];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const clearAll = () => onChange([]);

  const selectedProducts = selectedIds.map((id) => ({
    id,
    product: catalog.get(id) || { _id: id, nameAr: id, nameEn: id },
  }));

  const visibleSuggestions = suggestions.filter((p) => !selectedSet.has(String(p._id)));
  const visibleSearch = searchResults.filter((p) => !selectedSet.has(String(p._id)));
  const hasMoreSuggestions = suggestionPage * 12 < suggestionTotal && browsePreset !== 'recent';

  return (
    <div className="space-y-4">
      {showBrowse && maxItems > 1 && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/60 px-3 py-2.5 text-[11px] leading-relaxed text-blue-950">
          {isAr
            ? '💡 لا حاجة لكتابة الاسم — تصفّح المقترحات، أو اختر قسماً، أو استخدم «كل المنتجات / أقسام» في الخطوة السابقة لتطبيق العرض على آلاف المنتجات دفعة واحدة.'
            : '💡 No need to type names — browse suggestions, pick a category, or use «All products / Categories» above to target thousands at once.'}
        </div>
      )}

      {showBrowse && (
        <>
          <div className="flex gap-1 rounded-xl border border-border bg-slate-100 p-1">
            {TABS.map(({ id, icon: Icon, labelAr, labelEn }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[11px] font-bold transition-colors ${
                  tab === id ? 'bg-white text-orange-700 shadow-sm' : 'text-text-muted hover:text-text'
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {isAr ? labelAr : labelEn}
              </button>
            ))}
          </div>

          {tab === 'suggest' && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {PICKER_BROWSE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setBrowsePreset(preset.id)}
                    className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
                      browsePreset === preset.id
                        ? 'border-orange-500 bg-orange-600 text-white'
                        : 'border-border bg-white hover:border-orange-300 hover:bg-orange-50'
                    }`}
                  >
                    {preset.icon} {isAr ? preset.labelAr : preset.labelEn}
                  </button>
                ))}
              </div>

              {browsePreset === 'recent' && !suggestions.length && !loadingSuggestions && (
                <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-xs text-text-muted">
                  {isAr
                    ? 'لم تختر منتجات بعد — ستظهر هنا بعد أول اختيار.'
                    : 'Nothing yet — products you pick will appear here.'}
                </p>
              )}

              {loadingSuggestions ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-28 animate-pulse rounded-xl bg-slate-100" />
                  ))}
                </div>
              ) : suggestions.length > 0 && (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-text-muted">
                      {isAr ? `${suggestions.length} منتج — انقر للإضافة` : `${suggestions.length} products — click to add`}
                    </p>
                    {canAddMore && visibleSuggestions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => addAllVisible(visibleSuggestions)}
                        className="text-[11px] font-bold text-orange-700 hover:text-orange-800"
                      >
                        {isAr ? `+ إضافة الكل (${Math.min(visibleSuggestions.length, maxItems - selectedIds.length)})` : `+ Add all (${Math.min(visibleSuggestions.length, maxItems - selectedIds.length)})`}
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {suggestions.map((product) => (
                      <ProductSuggestionCard
                        key={product._id}
                        product={product}
                        isAr={isAr}
                        selected={selectedSet.has(String(product._id))}
                        disabled={!canAddMore && !selectedSet.has(String(product._id))}
                        onToggle={toggleProduct}
                      />
                    ))}
                  </div>
                  {hasMoreSuggestions && (
                    <button
                      type="button"
                      disabled={loadingSuggestions}
                      onClick={() => loadSuggestions({ page: suggestionPage + 1, append: true })}
                      className="w-full rounded-xl border border-border py-2 text-xs font-semibold hover:bg-slate-50"
                    >
                      {isAr ? 'تحميل المزيد…' : 'Load more…'}
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {tab === 'category' && (
            <div className="space-y-4">
              <CategoryBrowsePicker
                categories={categories}
                value={browseCategory}
                onChange={setBrowseCategory}
                isAr={isAr}
              />

              {brands.length > 0 && (
                <BrandFilterSelect
                  brands={brands}
                  value={browseBrand}
                  onChange={setBrowseBrand}
                  isAr={isAr}
                />
              )}

              {!browseCategory ? (
                <p className="rounded-xl border border-dashed border-border px-4 py-5 text-center text-xs text-text-muted">
                  {isAr
                    ? 'اختر قسماً لعرض منتجاته — ثم انقر للإضافة أو «إضافة الكل».'
                    : 'Pick a category to list its products — then click or use Add all.'}
                </p>
              ) : loadingSuggestions ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-28 animate-pulse rounded-xl bg-slate-100" />
                  ))}
                </div>
              ) : suggestions.length ? (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-text-muted">
                      {isAr ? `${suggestionTotal} منتج في هذا القسم` : `${suggestionTotal} products in category`}
                    </p>
                    {canAddMore && (
                      <button
                        type="button"
                        onClick={() => addAllVisible(visibleSuggestions)}
                        className="text-[11px] font-bold text-orange-700"
                      >
                        {isAr ? '+ إضافة كل الظاهر' : '+ Add all shown'}
                      </button>
                    )}
                  </div>
                  <div className="max-h-72 overflow-y-auto overscroll-y-contain">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {suggestions.map((product) => (
                        <ProductSuggestionCard
                          key={product._id}
                          product={product}
                          isAr={isAr}
                          selected={selectedSet.has(String(product._id))}
                          disabled={!canAddMore && !selectedSet.has(String(product._id))}
                          onToggle={toggleProduct}
                          compact
                        />
                      ))}
                    </div>
                  </div>
                  {hasMoreSuggestions && (
                    <button
                      type="button"
                      onClick={() => loadSuggestions({ page: suggestionPage + 1, append: true })}
                      className="w-full rounded-xl border border-border py-2 text-xs font-semibold"
                    >
                      {isAr ? 'تحميل المزيد…' : 'Load more…'}
                    </button>
                  )}
                </>
              ) : (
                <p className="text-center text-xs text-text-muted py-4">
                  {isAr ? 'لا منتجات في هذا القسم' : 'No products in this category'}
                </p>
              )}
            </div>
          )}

          {tab === 'search' && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={isAr ? 'اسم، ماركة، SKU، باركود…' : 'Name, brand, SKU, barcode…'}
                  inputClassName="ps-10"
                />
              </div>
              {!search.trim() ? (
                <p className="rounded-xl border border-dashed border-border px-4 py-5 text-center text-xs text-text-muted">
                  {isAr
                    ? 'ابدأ الكتابة للبحث — أو استخدم تبويب «مقترحات» و«حسب القسم» أسرع.'
                    : 'Start typing to search — or use Suggestions / By category tabs for faster picking.'}
                </p>
              ) : searching ? (
                <p className="py-4 text-center text-sm text-text-muted">{isAr ? 'جار البحث…' : 'Searching…'}</p>
              ) : visibleSearch.length ? (
                <ul className="max-h-64 divide-y divide-border overflow-y-auto overscroll-y-contain rounded-xl border border-border bg-white">
                  {visibleSearch.map((product) => (
                    <li key={product._id}>
                      <button
                        type="button"
                        onClick={() => addProduct(product)}
                        disabled={!canAddMore}
                        className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-start text-sm hover:bg-orange-50 disabled:opacity-50"
                      >
                        <span className="min-w-0 truncate">{productPickerLabel(product, isAr)}</span>
                        <span className="shrink-0 rounded-lg bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-800">
                          {isAr ? '+ إضافة' : '+ Add'}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-4 text-center text-sm text-text-muted">{isAr ? 'لا نتائج' : 'No results'}</p>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => loadSuggestions({ page: 1, append: false })}
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-text-muted hover:text-orange-700"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {isAr ? 'تحديث القائمة' : 'Refresh list'}
          </button>
        </>
      )}

      {!showBrowse && (
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isAr ? 'ابحث عن منتج…' : 'Search product…'}
            inputClassName="ps-10"
          />
          {search.trim() && visibleSearch.length > 0 && (
            <ul className="mt-2 max-h-48 divide-y divide-border overflow-y-auto rounded-xl border border-border bg-white">
              {visibleSearch.map((product) => (
                <li key={product._id}>
                  <button
                    type="button"
                    onClick={() => addProduct(product)}
                    disabled={!canAddMore}
                    className="flex w-full px-4 py-2.5 text-start text-sm hover:bg-slate-50"
                  >
                    {productPickerLabel(product, isAr)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="rounded-xl border border-border bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-4 w-4 text-orange-600" />
            <p className="text-sm font-bold text-text">
              {isAr ? `المحددة (${selectedIds.length}${maxItems < 200 ? ` / ${maxItems}` : ''})` : `Selected (${selectedIds.length}${maxItems < 200 ? ` / ${maxItems}` : ''})`}
            </p>
          </div>
          {selectedIds.length > 0 && (
            <button type="button" onClick={clearAll} className="text-xs font-semibold text-red-600 hover:text-red-700">
              {isAr ? 'مسح الكل' : 'Clear all'}
            </button>
          )}
        </div>

        {selectedProducts.length ? (
          <ul className="max-h-56 divide-y divide-border overflow-y-auto overscroll-y-contain">
            {selectedProducts.map(({ id, product }, index) => (
              <li key={id} className="flex items-center gap-2 px-3 py-2.5">
                {maxItems > 1 && (
                  <div className="flex flex-col gap-0.5">
                    <button type="button" onClick={() => moveProduct(index, -1)} disabled={index === 0} className="rounded p-0.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30">
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => moveProduct(index, 1)} disabled={index === selectedProducts.length - 1} className="rounded p-0.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30">
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>
                )}
                <span className="min-w-0 flex-1 truncate text-sm">{productPickerLabel(product, isAr)}</span>
                <button type="button" onClick={() => removeProduct(id)} className="rounded-lg p-2 text-red-600 hover:bg-red-50">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-5 text-center text-sm text-text-muted">
            {isAr
              ? 'لم تُحدَّد منتجات بعد — اختر من المقترحات أو القسم أعلاه.'
              : 'No products yet — pick from suggestions or category above.'}
          </p>
        )}
      </div>

      {selectedIds.length >= maxItems && (
        <p className="text-xs font-semibold text-amber-800">
          {isAr ? `وصلت للحد الأقصى (${maxItems})` : `Maximum reached (${maxItems})`}
        </p>
      )}
    </div>
  );
}

export default memo(ProductMultiPicker);
