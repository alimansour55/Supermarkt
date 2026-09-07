import { useMemo } from 'react';
import { Sparkles, Store } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useCategories } from '../../context/CategoriesContext';
import { useStoreSettings } from '../../context/StoreSettingsContext';
import { categoryLabel, getDescendantsUnderRoot, filterSubcategoryLabel } from '../../utils/categoryHelpers';
import {
  getEnabledFilterSections,
  getEnabledSourceOptions,
  normalizeProductFilterSettings,
  sourceOptionLabel,
} from '../../utils/productFilterSettings';
import { PRODUCT_FILTER_SECTION_LABELS } from '../../constants/productFilterSettings';
import CategoryImage from '../category/CategoryImage';
import { FilterSection, RadioRow, FILTER_CHECKBOX_CLASS } from '../filters/FilterAccordion';

const SOURCE_ICONS = {
  all: null,
  our_products: Store,
  offers: Sparkles,
  best_sellers: null,
  new_arrivals: null,
};

function sectionTitle(sectionId, isAr) {
  const labels = PRODUCT_FILTER_SECTION_LABELS[sectionId];
  if (!labels) return sectionId;
  return isAr ? labels.ar : labels.en;
}

export default function ProductFilters({
  filters,
  meta,
  onChange,
  onClear,
  hideMainCategory = false,
  hideSubCategory = false,
  hideOffersFilter = false,
  lockedMainSlug = '',
  lockedSubSlug = '',
}) {
  const { language } = useLanguage();
  const { categories } = useCategories();
  const { settings } = useStoreSettings();
  const isAr = language === 'ar';

  const filterSettings = useMemo(
    () => normalizeProductFilterSettings(
      meta?.filterSettings || settings?.productFilterSettings || {},
    ),
    [meta?.filterSettings, settings?.productFilterSettings],
  );

  const enabledSections = useMemo(
    () => getEnabledFilterSections(filterSettings, { hideMainCategory, hideSubCategory, hideOffersFilter }),
    [filterSettings, hideMainCategory, hideSubCategory, hideOffersFilter],
  );

  const sourceOptions = useMemo(
    () => getEnabledSourceOptions(filterSettings, meta),
    [filterSettings, meta],
  );

  const update = (patch) => onChange({ ...filters, ...patch, page: 1 });

  const toggle = (key, value) => {
    update({ [key]: filters[key] === value ? '' : value });
  };

  const mainCategories = meta?.mainCategories || meta?.categories || [];
  const brands = meta?.brands || [];
  const priceRange = meta?.priceRange || {};

  const effectiveMain = lockedMainSlug || filters.mainCategory;
  const effectiveSub = lockedSubSlug || filters.subCategory;
  const effectiveSource = filters.productSource || '';

  const subcategories = useMemo(() => {
    if (!effectiveMain) return [];

    const fromMeta = meta?.subcategories || [];
    const countBySlug = new Map(fromMeta.map((s) => [s.slug, s.count]));
    const fromDescendants = getDescendantsUnderRoot(categories, effectiveMain);

    const bySlug = new Map();
    [...fromDescendants, ...fromMeta].forEach((sub) => {
      if (!sub?.slug) return;
      const existing = bySlug.get(sub.slug);
      bySlug.set(sub.slug, {
        ...existing,
        ...sub,
        parentSlug: sub.parentSlug || existing?.parentSlug,
        rootSlug: sub.rootSlug || effectiveMain,
        count: countBySlug.has(sub.slug) ? countBySlug.get(sub.slug) : existing?.count ?? sub.count,
      });
    });

    return [...bySlug.values()].sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
        || (a.pathLabelEn || a.nameEn || '').localeCompare(b.pathLabelEn || b.nameEn || ''),
    );
  }, [effectiveMain, meta?.subcategories, categories]);

  const handleMainChange = (slug) => {
    const next = slug === filters.mainCategory ? '' : slug;
    update({ mainCategory: next, subCategory: '' });
  };

  const handleSubChange = (slug) => {
    update({ subCategory: slug === filters.subCategory ? '' : slug });
  };

  const handleSourceChange = (sourceId) => {
    const next = sourceId === 'all' || sourceId === effectiveSource ? '' : sourceId;
    const patch = { productSource: next };
    if (next === 'offers') {
      patch.offers = 'true';
    } else {
      patch.offers = '';
    }
    // Drop stale brand when switching product type — avoids 0 results from old brand chips.
    if (next) {
      patch.brand = '';
    }
    update(patch);
  };

  const renderProductSource = () => {
    if (!sourceOptions.length) return null;

    return (
      <FilterSection title={sectionTitle('productSource', isAr)} defaultOpen>
        <div className="space-y-0.5">
          {sourceOptions.map((option) => {
            const Icon = SOURCE_ICONS[option.id];
            const checked = option.id === 'all' ? !effectiveSource : effectiveSource === option.id;
            return (
              <RadioRow
                key={option.id}
                checked={checked}
                onChange={() => handleSourceChange(option.id)}
                label={sourceOptionLabel(option, isAr)}
                count={option.count}
                leading={Icon ? (
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
                    <Icon className="h-4 w-4" />
                  </span>
                ) : null}
              />
            );
          })}
        </div>
      </FilterSection>
    );
  };

  const renderMainCategory = () => (
    <FilterSection title={sectionTitle('mainCategory', isAr)}>
      <div className="max-h-44 space-y-0.5 overflow-y-auto pe-1 scrollbar-thin">
        <RadioRow
          checked={!effectiveMain}
          onChange={() => handleMainChange('')}
          label={isAr ? 'كل الأقسام' : 'All departments'}
          count={meta?.totalAllCategories ?? meta?.totalMatching}
          disabled={Boolean(lockedMainSlug)}
        />
        {mainCategories.map((cat) => (
          <RadioRow
            key={cat.slug}
            checked={effectiveMain === cat.slug}
            onChange={() => !lockedMainSlug && handleMainChange(cat.slug)}
            label={categoryLabel(cat, isAr)}
            count={cat.count}
            disabled={Boolean(lockedMainSlug)}
            leading={<CategoryImage category={cat} size="xs" className="!h-7 !w-7" />}
          />
        ))}
      </div>
    </FilterSection>
  );

  const renderSubCategory = () => (
    <FilterSection title={sectionTitle('subCategory', isAr)} defaultOpen={Boolean(effectiveMain)}>
      {!effectiveMain ? (
        <p className="rounded-xl bg-surface px-3 py-2 text-xs text-text-muted">
          {isAr ? 'اختر قسمًا رئيسيًا لعرض الأقسام الفرعية' : 'Select a main category to see subcategories'}
        </p>
      ) : (
        <div className="max-h-48 space-y-0.5 overflow-y-auto pe-1 scrollbar-thin">
          <RadioRow
            checked={!effectiveSub}
            onChange={() => !lockedSubSlug && handleSubChange('')}
            label={isAr ? 'كل الفروع' : 'All in department'}
            count={
              effectiveMain
                ? (mainCategories.find((c) => c.slug === effectiveMain)?.count ?? meta?.totalMatching)
                : null
            }
            disabled={Boolean(lockedSubSlug)}
          />
          {subcategories.length === 0 ? (
            <p className="px-2 py-2 text-xs text-text-muted">
              {isAr ? 'لا توجد أقسام فرعية لهذا القسم' : 'No subcategories for this department'}
            </p>
          ) : (
            subcategories.map((sub) => (
              <RadioRow
                key={sub.slug}
                checked={effectiveSub === sub.slug}
                onChange={() => !lockedSubSlug && handleSubChange(sub.slug)}
                label={filterSubcategoryLabel(sub, isAr)}
                count={sub.count}
                disabled={Boolean(lockedSubSlug)}
                leading={<CategoryImage category={sub} size="xs" className="!h-7 !w-7" />}
              />
            ))
          )}
        </div>
      )}
    </FilterSection>
  );

  const renderBrand = () => (
    <FilterSection title={sectionTitle('brand', isAr)}>
      <div className="max-h-40 space-y-0.5 overflow-y-auto pe-1 scrollbar-thin">
        <RadioRow
          checked={!filters.brand}
          onChange={() => update({ brand: '' })}
          label={isAr ? 'كل الماركات' : 'All brands'}
        />
        {brands.map((row) => {
          const name = typeof row === 'string' ? row : row.name;
          const count = typeof row === 'string' ? null : row.count;
          return (
            <RadioRow
              key={name}
              checked={filters.brand === name}
              onChange={() => toggle('brand', name)}
              label={name}
              count={count}
              disabled={count === 0}
            />
          );
        })}
      </div>
    </FilterSection>
  );

  const renderPrice = () => (
    <FilterSection title={sectionTitle('price', isAr)}>
      <div className="flex gap-2">
        <input
          type="number"
          min={0}
          placeholder={isAr ? 'من' : 'Min'}
          value={filters.minPrice || ''}
          onChange={(e) => update({ minPrice: e.target.value })}
          className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
        />
        <input
          type="number"
          min={0}
          placeholder={isAr ? 'إلى' : 'Max'}
          value={filters.maxPrice || ''}
          onChange={(e) => update({ maxPrice: e.target.value })}
          className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
        />
      </div>
      {(priceRange.minPrice != null || priceRange.maxPrice != null) && (
        <p className="mt-2 text-xs text-text-muted">
          {isAr ? 'النطاق:' : 'Range:'}{' '}
          {Math.floor(priceRange.minPrice || 0)} – {Math.ceil(priceRange.maxPrice || 0)} {isAr ? 'ج.م' : 'EGP'}
        </p>
      )}
    </FilterSection>
  );

  const renderRating = () => (
    <FilterSection title={sectionTitle('rating', isAr)} defaultOpen={false}>
      <div className="space-y-0.5">
        {[4, 3, 2].map((r) => (
          <RadioRow
            key={r}
            checked={Number(filters.minRating) === r}
            onChange={() => update({ minRating: filters.minRating === String(r) ? '' : String(r) })}
            label={`${'★'.repeat(r)}${isAr ? ' فأكثر' : ' & up'}`}
          />
        ))}
      </div>
    </FilterSection>
  );

  const renderDiscount = () => (
    <FilterSection title={sectionTitle('discount', isAr)} defaultOpen={false}>
      <div className="space-y-0.5">
        {[10, 20, 30, 50].map((discount) => (
          <RadioRow
            key={discount}
            checked={Number(filters.minDiscount) === discount}
            onChange={() => update({ minDiscount: filters.minDiscount === String(discount) ? '' : String(discount) })}
            label={isAr ? `${discount}% فأكثر` : `${discount}% & up`}
          />
        ))}
      </div>
    </FilterSection>
  );

  const renderQuickFilters = () => (
    <div className="space-y-3 border-t border-border pt-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
        {sectionTitle('quickFilters', isAr)}
      </p>
      <label className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-2 text-sm hover:bg-surface">
        <input
          type="checkbox"
          checked={filters.inStock === 'true'}
          onChange={(e) => update({ inStock: e.target.checked ? 'true' : '' })}
          className={FILTER_CHECKBOX_CLASS}
        />
        <span>{isAr ? 'متوفر فقط' : 'In stock only'}</span>
      </label>
      {!hideOffersFilter && effectiveSource !== 'offers' && (
        <label className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-2 text-sm hover:bg-surface">
          <input
            type="checkbox"
            checked={filters.offers === 'true'}
            onChange={(e) => update({ offers: e.target.checked ? 'true' : '' })}
            className={FILTER_CHECKBOX_CLASS}
          />
          <span>{isAr ? 'عروض وخصومات فقط' : 'Offers & discounts only'}</span>
        </label>
      )}
    </div>
  );

  const sectionRenderers = {
    productSource: renderProductSource,
    mainCategory: renderMainCategory,
    subCategory: renderSubCategory,
    brand: renderBrand,
    price: renderPrice,
    rating: renderRating,
    discount: renderDiscount,
    quickFilters: renderQuickFilters,
  };

  return (
    <aside className="sticky top-24 space-y-4 rounded-2xl border border-border bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-border pb-4">
        <h2 className="text-lg font-bold text-text">{isAr ? 'تصفية' : 'Filters'}</h2>
        <button
          type="button"
          onClick={onClear}
          className="text-xs font-semibold text-primary-600 hover:text-primary-700"
        >
          {isAr ? 'مسح الكل' : 'Clear all'}
        </button>
      </div>

      {meta?.totalMatching != null && (
        <p className="rounded-xl bg-surface px-3 py-2 text-xs text-text-muted">
          {meta.totalMatching} {isAr ? 'منتج يطابق الفلاتر' : 'products match filters'}
        </p>
      )}

      {enabledSections.map((section) => {
        const render = sectionRenderers[section.id];
        if (!render) return null;
        const content = render();
        if (!content) return null;
        return <div key={section.id}>{content}</div>;
      })}
    </aside>
  );
}

export function ProductSortBar({ sort, onSortChange, total, language }) {
  const isAr = language === 'ar';
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-white px-4 py-3 shadow-sm">
      <p className="text-sm text-text-muted">
        <span className="font-semibold text-text">{total}</span> {isAr ? 'منتج' : 'products'}
      </p>
      <select
        value={sort}
        onChange={(e) => onSortChange(e.target.value)}
        className="rounded-xl border border-border bg-surface px-3 py-2 text-sm font-medium focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
        aria-label={isAr ? 'ترتيب المنتجات' : 'Sort products'}
      >
        <option value="">{isAr ? 'الترتيب الافتراضي' : 'Default'}</option>
        <option value="price-low">{isAr ? 'السعر: من الأقل للأعلى' : 'Price: Low to High'}</option>
        <option value="price-high">{isAr ? 'السعر: من الأعلى للأقل' : 'Price: High to Low'}</option>
        <option value="newest">{isAr ? 'الأحدث' : 'Newest'}</option>
        <option value="best-selling">{isAr ? 'الأكثر مبيعاً' : 'Best Selling'}</option>
        <option value="discount">{isAr ? 'أعلى خصم' : 'Highest Discount'}</option>
        <option value="top">{isAr ? 'الأعلى تقييماً' : 'Top Rated'}</option>
      </select>
    </div>
  );
}

export function ProductPagination({ pagination, onPageChange, language }) {
  if (!pagination || pagination.pages <= 1) return null;

  const { page, pages } = pagination;
  const isAr = language === 'ar';

  const pageNums = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(pages, page + 2);
  for (let p = start; p <= end; p += 1) pageNums.push(p);

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 py-6">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="rounded-xl border border-border px-4 py-2 text-sm font-medium disabled:opacity-40 hover:bg-surface"
      >
        {isAr ? '→ السابق' : '← Prev'}
      </button>
      {pageNums.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onPageChange(p)}
          className={`h-9 min-w-9 rounded-xl px-2 text-sm font-semibold ${
            p === page ? 'bg-primary-600 text-white' : 'border border-border hover:bg-surface'
          }`}
        >
          {p}
        </button>
      ))}
      <button
        type="button"
        disabled={page >= pages}
        onClick={() => onPageChange(page + 1)}
        className="rounded-xl border border-border px-4 py-2 text-sm font-medium disabled:opacity-40 hover:bg-surface"
      >
        {isAr ? 'التالي ←' : 'Next →'}
      </button>
    </div>
  );
}

export function ActiveFilterChips({
  filters,
  meta,
  onChange,
  onClear,
  language,
  hideCategoryChips = false,
  hideOffersChip = false,
  filterSettings: filterSettingsProp,
}) {
  const isAr = language === 'ar';
  const { settings } = useStoreSettings();
  const filterSettings = normalizeProductFilterSettings(
    filterSettingsProp || meta?.filterSettings || settings?.productFilterSettings || {},
  );
  const chips = [];

  if (filters.productSource) {
    const source = getEnabledSourceOptions(filterSettings, meta)
      .find((opt) => opt.id === filters.productSource)
      || filterSettings.sourceOptions.find((opt) => opt.id === filters.productSource);
    if (source) {
      chips.push({
        key: 'source',
        label: sourceOptionLabel(source, isAr),
        clear: () => onChange({ ...filters, productSource: '', offers: '', page: 1 }),
      });
    }
  }

  if (!hideCategoryChips && filters.mainCategory) {
    const main = meta?.mainCategories?.find((c) => c.slug === filters.mainCategory);
    chips.push({
      key: 'main',
      label: main ? categoryLabel(main, isAr) : filters.mainCategory,
      clear: () => onChange({ ...filters, mainCategory: '', subCategory: '', page: 1 }),
    });
  }
  if (!hideCategoryChips && filters.subCategory) {
    const sub = meta?.subcategories?.find((c) => c.slug === filters.subCategory);
    chips.push({
      key: 'sub',
      label: sub ? filterSubcategoryLabel(sub, isAr) : filters.subCategory,
      clear: () => onChange({ ...filters, subCategory: '', page: 1 }),
    });
  }
  if (filters.brand) chips.push({ key: 'brand', label: filters.brand, clear: () => onChange({ ...filters, brand: '', page: 1 }) });
  if (filters.minPrice) chips.push({ key: 'minP', label: `${isAr ? 'من' : 'From'} ${filters.minPrice}`, clear: () => onChange({ ...filters, minPrice: '', page: 1 }) });
  if (filters.maxPrice) chips.push({ key: 'maxP', label: `${isAr ? 'إلى' : 'To'} ${filters.maxPrice}`, clear: () => onChange({ ...filters, maxPrice: '', page: 1 }) });
  if (filters.minRating) chips.push({ key: 'rating', label: `${filters.minRating}★+`, clear: () => onChange({ ...filters, minRating: '', page: 1 }) });
  if (filters.minDiscount) chips.push({ key: 'discount', label: `${filters.minDiscount}%+`, clear: () => onChange({ ...filters, minDiscount: '', page: 1 }) });
  if (filters.inStock === 'true') chips.push({ key: 'stock', label: isAr ? 'متوفر' : 'In stock', clear: () => onChange({ ...filters, inStock: '', page: 1 }) });
  if (!hideOffersChip && filters.offers === 'true' && filters.productSource !== 'offers') {
    chips.push({ key: 'offers', label: isAr ? 'عروض' : 'Offers', clear: () => onChange({ ...filters, offers: '', page: 1 }) });
  }

  if (!chips.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.clear}
          className="inline-flex items-center gap-1 rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-800"
        >
          {chip.label}
          <span aria-hidden>×</span>
        </button>
      ))}
      <button type="button" onClick={onClear} className="text-xs font-semibold text-primary-600">
        {isAr ? 'مسح الكل' : 'Clear all'}
      </button>
    </div>
  );
}
