import { useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  Filter,
  Layers,
  Package,
  RotateCcw,
  Search,
  Tag,
  TreePine,
  X,
} from 'lucide-react';
import { adminApi } from '../../adminApi';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import CategoryImage from '../../../components/category/CategoryImage';

function labelFor(row, isAr) {
  if (!row) return '';
  return isAr ? (row.nameAr || row.nameEn) : (row.nameEn || row.nameAr);
}

function SidebarSkeleton({ isAr }) {
  return (
    <div className="animate-pulse space-y-4 px-1 py-2">
      <div className="h-16 rounded-xl bg-slate-100" />
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-2">
          <div className="h-4 w-28 rounded bg-slate-100" />
          <div className="h-9 rounded-lg bg-slate-50" />
          <div className="h-9 rounded-lg bg-slate-50" />
        </div>
      ))}
      <p className="text-center text-xs text-text-muted">{isAr ? 'جار التحميل...' : 'Loading...'}</p>
    </div>
  );
}

function FilterSection({ title, icon: Icon, open, onToggle, children, disabled = false }) {
  return (
    <section className={`rounded-xl ring-1 ${disabled ? 'bg-slate-50/60 ring-slate-100' : 'bg-white ring-border'}`}>
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className={[
          'flex w-full items-center gap-2.5 px-3 py-2.5 text-start transition-colors',
          disabled ? 'cursor-not-allowed opacity-60' : 'hover:bg-slate-50/80',
        ].join(' ')}
      >
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${disabled ? 'bg-slate-100 text-slate-400' : 'bg-primary-50 text-primary-600'}`}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="min-w-0 flex-1 text-sm font-bold text-text">{title}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && !disabled && (
        <div className="border-t border-border px-2 pb-2 pt-1">{children}</div>
      )}
    </section>
  );
}

function OptionRow({ selected, onSelect, label, count, leading, disabled }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={[
        'flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-start text-sm transition-all',
        disabled && 'cursor-not-allowed opacity-40',
        selected
          ? 'bg-primary-600 text-white shadow-sm'
          : 'text-text hover:bg-slate-50',
      ].join(' ')}
    >
      <span
        className={[
          'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2',
          selected ? 'border-white bg-white' : 'border-slate-300 bg-white',
        ].join(' ')}
        aria-hidden
      >
        {selected && <span className="h-2 w-2 rounded-full bg-primary-600" />}
      </span>
      {leading}
      <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
      {count != null && (
        <span
          className={[
            'shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums',
            selected ? 'bg-white/20 text-white' : 'bg-slate-100 text-text-muted',
          ].join(' ')}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function ScopeChip({ label, onRemove }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-primary-800 ring-1 ring-primary-200">
      <span className="truncate">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 rounded-full p-0.5 hover:bg-primary-100"
        aria-label="Remove"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

export default function ReviewProductFilterSidebar({ filters, onChange, isAr }) {
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [productSearch, setProductSearch] = useState('');
  const [openSections, setOpenSections] = useState({
    main: true,
    sub: true,
    brand: false,
    product: true,
  });
  const debouncedProductSearch = useDebouncedValue(productSearch, 280);

  const mainCategory = filters.mainCategory || '';
  const subCategory = filters.subCategory || '';
  const brand = filters.brand || '';
  const productId = filters.productId || '';

  useEffect(() => {
    let active = true;
    setLoading(true);
    adminApi.getReviewProductFilters({
      mainCategory: mainCategory || undefined,
      subCategory: subCategory || undefined,
      brand: brand || undefined,
      q: debouncedProductSearch.trim() || undefined,
    })
      .then(({ data }) => {
        if (active) setMeta(data.data || null);
      })
      .catch(() => {
        if (active) setMeta(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [mainCategory, subCategory, brand, debouncedProductSearch]);

  useEffect(() => {
    if (mainCategory) {
      setOpenSections((prev) => ({ ...prev, sub: true, brand: true }));
    }
  }, [mainCategory]);

  const clearAll = () => {
    setProductSearch('');
    onChange({
      mainCategory: '',
      subCategory: '',
      brand: '',
      productId: '',
    });
  };

  const pickMain = (slug) => {
    setProductSearch('');
    onChange({
      mainCategory: slug,
      subCategory: '',
      brand: '',
      productId: '',
    });
  };

  const pickSub = (slug) => {
    setProductSearch('');
    onChange({
      subCategory: slug,
      brand: '',
      productId: '',
    });
  };

  const pickBrand = (name) => {
    setProductSearch('');
    onChange({
      brand: name,
      productId: '',
    });
  };

  const pickProduct = (id) => {
    onChange({ productId: id });
  };

  const toggleSection = (key) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const scopeCount = meta?.totalInScope ?? 0;
  const allReviewsCount = meta?.totalAllReviews ?? scopeCount;

  const activeMain = meta?.mainCategories?.find((c) => c.slug === mainCategory);
  const activeSub = meta?.subcategories?.find((c) => c.slug === subCategory);
  const activeProduct = meta?.products?.find((p) => String(p._id) === productId);

  const activeChips = useMemo(() => {
    const chips = [];
    if (activeMain) {
      chips.push({
        key: 'main',
        label: labelFor(activeMain, isAr),
        onRemove: () => pickMain(''),
      });
    }
    if (activeSub) {
      chips.push({
        key: 'sub',
        label: labelFor(activeSub, isAr),
        onRemove: () => pickSub(''),
      });
    }
    if (brand) {
      chips.push({
        key: 'brand',
        label: brand,
        onRemove: () => pickBrand(''),
      });
    }
    if (activeProduct) {
      chips.push({
        key: 'product',
        label: labelFor(activeProduct, isAr),
        onRemove: () => pickProduct(''),
      });
    }
    return chips;
  }, [activeMain, activeSub, brand, activeProduct, isAr]);

  const hasActiveFilters = activeChips.length > 0;

  return (
    <aside className="flex max-h-[calc(100vh-7rem)] flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-sm lg:sticky lg:top-24">
      {/* Header */}
      <div className="shrink-0 border-b border-border px-4 py-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-white shadow-sm">
              <Filter className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-text">
                {isAr ? 'تصفية المنتجات' : 'Product filter'}
              </h2>
              <p className="text-[11px] text-text-muted">
                {isAr ? 'ضيّق التقييمات حسب القسم أو المنتج' : 'Narrow reviews by category or product'}
              </p>
            </div>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold text-red-600 transition-colors hover:bg-red-50"
            >
              <RotateCcw className="h-3 w-3" />
              {isAr ? 'مسح' : 'Reset'}
            </button>
          )}
        </div>
      </div>

      {/* Scope banner */}
      <div className="shrink-0 border-b border-border bg-gradient-to-br from-slate-50 to-primary-50/30 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
              {isAr ? 'النطاق الحالي' : 'Current scope'}
            </p>
            <p className="mt-0.5 text-2xl font-extrabold tabular-nums text-text">
              {loading ? '…' : scopeCount}
            </p>
          </div>
          <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-primary-700 ring-1 ring-primary-200">
            {isAr ? 'تقييم' : 'reviews'}
          </span>
        </div>
        {activeChips.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {activeChips.map((chip) => (
              <ScopeChip key={chip.key} label={chip.label} onRemove={chip.onRemove} />
            ))}
          </div>
        )}
      </div>

      {/* Scrollable filters */}
      <div className="flex-1 space-y-2.5 overflow-y-auto p-3 scrollbar-thin">
        {loading ? (
          <SidebarSkeleton isAr={isAr} />
        ) : (
          <>
            <FilterSection
              title={isAr ? 'القسم الرئيسي' : 'Main category'}
              icon={Layers}
              open={openSections.main}
              onToggle={() => toggleSection('main')}
            >
              <div className="max-h-44 space-y-0.5 overflow-y-auto pe-0.5 scrollbar-thin">
                <OptionRow
                  selected={!mainCategory}
                  onSelect={() => pickMain('')}
                  label={isAr ? 'كل الأقسام' : 'All departments'}
                  count={allReviewsCount}
                />
                {(meta?.mainCategories || []).map((cat) => (
                  <OptionRow
                    key={cat.slug}
                    selected={mainCategory === cat.slug}
                    onSelect={() => pickMain(cat.slug)}
                    label={labelFor(cat, isAr)}
                    count={cat.count}
                    leading={<CategoryImage category={cat} size="xs" className="!h-7 !w-7" />}
                  />
                ))}
              </div>
            </FilterSection>

            <FilterSection
              title={isAr ? 'القسم الفرعي' : 'Subcategory'}
              icon={TreePine}
              open={openSections.sub}
              onToggle={() => toggleSection('sub')}
              disabled={!mainCategory}
            >
              {!mainCategory ? null : (
                <div className="max-h-44 space-y-0.5 overflow-y-auto pe-0.5 scrollbar-thin">
                  <OptionRow
                    selected={!subCategory}
                    onSelect={() => pickSub('')}
                    label={isAr ? 'كل الفروع' : 'All in department'}
                    count={activeMain?.count ?? scopeCount}
                  />
                  {(meta?.subcategories || []).length === 0 ? (
                    <p className="px-2 py-3 text-center text-xs text-text-muted">
                      {isAr ? 'لا توجد أقسام فرعية' : 'No subcategories'}
                    </p>
                  ) : (
                    meta.subcategories.map((sub) => (
                      <OptionRow
                        key={sub.slug}
                        selected={subCategory === sub.slug}
                        onSelect={() => pickSub(sub.slug)}
                        label={labelFor(sub, isAr)}
                        count={sub.count}
                        leading={<CategoryImage category={sub} size="xs" className="!h-7 !w-7" />}
                      />
                    ))
                  )}
                </div>
              )}
            </FilterSection>

            <FilterSection
              title={isAr ? 'الماركة' : 'Brand'}
              icon={Tag}
              open={openSections.brand}
              onToggle={() => toggleSection('brand')}
            >
              <div className="max-h-36 space-y-0.5 overflow-y-auto pe-0.5 scrollbar-thin">
                <OptionRow
                  selected={!brand}
                  onSelect={() => pickBrand('')}
                  label={isAr ? 'كل الماركات' : 'All brands'}
                  count={scopeCount}
                />
                {(meta?.brands || []).length === 0 ? (
                  <p className="px-2 py-3 text-center text-xs text-text-muted">
                    {isAr ? 'لا توجد ماركات' : 'No brands'}
                  </p>
                ) : (
                  meta.brands.map((row) => (
                    <OptionRow
                      key={row.name}
                      selected={brand === row.name}
                      onSelect={() => pickBrand(row.name)}
                      label={row.name}
                      count={row.count}
                      disabled={!row.count}
                    />
                  ))
                )}
              </div>
            </FilterSection>

            <FilterSection
              title={isAr ? 'المنتج' : 'Product'}
              icon={Package}
              open={openSections.product}
              onToggle={() => toggleSection('product')}
            >
              <div className="relative mb-2">
                <Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
                <input
                  type="search"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder={isAr ? 'بحث بالاسم...' : 'Search by name...'}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pe-3 ps-9 text-sm text-text placeholder:text-slate-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100"
                />
              </div>
              <div className="max-h-52 space-y-0.5 overflow-y-auto pe-0.5 scrollbar-thin">
                <OptionRow
                  selected={!productId}
                  onSelect={() => pickProduct('')}
                  label={isAr ? 'كل المنتجات' : 'All products'}
                  count={scopeCount}
                />
                {(meta?.products || []).length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border bg-slate-50/80 px-3 py-5 text-center">
                    <Package className="mx-auto h-5 w-5 text-text-muted" />
                    <p className="mt-2 text-xs text-text-muted">
                      {isAr ? 'لا توجد منتجات في هذا النطاق' : 'No products in this scope'}
                    </p>
                  </div>
                ) : (
                  meta.products.map((product) => (
                    <OptionRow
                      key={product._id}
                      selected={productId === String(product._id)}
                      onSelect={() => pickProduct(String(product._id))}
                      label={labelFor(product, isAr)}
                      count={product.reviewCount}
                      leading={(
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white ring-1 ring-border">
                          {product.image ? (
                            <img src={product.image} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <Package className="h-3.5 w-3.5 text-text-muted" />
                          )}
                        </span>
                      )}
                    />
                  ))
                )}
              </div>
              {(meta?.products?.length || 0) >= 400 && (
                <p className="mt-2 rounded-md bg-amber-50 px-2 py-1.5 text-[10px] font-medium text-amber-800">
                  {isAr
                    ? 'يُعرض أول 400 منتج — ضيّق القسم أو ابحث'
                    : 'Showing first 400 — narrow scope or search'}
                </p>
              )}
            </FilterSection>
          </>
        )}
      </div>
    </aside>
  );
}
