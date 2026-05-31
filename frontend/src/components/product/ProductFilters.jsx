import { useLanguage } from '../../context/LanguageContext';

export default function ProductFilters({ filters, meta, onChange, onClear, hideCategory = false }) {
  const { language } = useLanguage();

  const update = (key, value) => onChange({ ...filters, [key]: value, page: 1 });

  const toggleArrayFilter = (key, value) => {
    update(key, filters[key] === value ? '' : value);
  };

  return (
    <aside className="space-y-5 rounded-2xl border border-border bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-text">{language === 'ar' ? 'تصفية' : 'Filters'}</h2>
        <button type="button" onClick={onClear} className="text-xs font-semibold text-primary-600 hover:text-primary-700">
          {language === 'ar' ? 'مسح الكل' : 'Clear all'}
        </button>
      </div>

      {!hideCategory && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">{language === 'ar' ? 'القسم' : 'Category'}</h3>
          <div className="max-h-40 space-y-1 overflow-y-auto">
            {(meta?.categories || []).map((cat) => (
              <label key={cat.slug} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface">
                <input
                  type="radio"
                  name="category"
                  checked={filters.category === cat.slug}
                  onChange={() => toggleArrayFilter('category', cat.slug)}
                />
                <span>{language === 'ar' ? (cat.nameAr || cat.name) : cat.nameEn}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Brand */}
      <div>
        <h3 className="mb-2 text-sm font-semibold">{language === 'ar' ? 'الماركة' : 'Brand'}</h3>
        <div className="max-h-36 space-y-1 overflow-y-auto">
          {(meta?.brands || []).map((brand) => (
            <label key={brand} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface">
              <input
                type="radio"
                name="brand"
                checked={filters.brand === brand}
                onChange={() => toggleArrayFilter('brand', brand)}
              />
              <span>{brand}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Price */}
      <div>
        <h3 className="mb-2 text-sm font-semibold">{language === 'ar' ? 'السعر (ج.م)' : 'Price (EGP)'}</h3>
        <div className="flex gap-2">
          <input
            type="number"
            placeholder={language === 'ar' ? 'من' : 'Min'}
            value={filters.minPrice || ''}
            onChange={(e) => update('minPrice', e.target.value)}
            className="w-full rounded-lg border border-border px-2 py-1.5 text-sm"
          />
          <input
            type="number"
            placeholder={language === 'ar' ? 'إلى' : 'Max'}
            value={filters.maxPrice || ''}
            onChange={(e) => update('maxPrice', e.target.value)}
            className="w-full rounded-lg border border-border px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      {/* Discount */}
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={filters.offers === 'true'}
          onChange={(e) => update('offers', e.target.checked ? 'true' : '')}
        />
        <span>{language === 'ar' ? 'عروض وخصومات فقط' : 'Offers & discounts only'}</span>
      </label>

      {/* Rating */}
      <div>
        <h3 className="mb-2 text-sm font-semibold">{language === 'ar' ? 'التقييم' : 'Rating'}</h3>
        <div className="space-y-1">
          {[4, 3, 2].map((r) => (
            <label key={r} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface">
              <input
                type="radio"
                name="rating"
                checked={Number(filters.minRating) === r}
                onChange={() => update('minRating', filters.minRating === String(r) ? '' : String(r))}
              />
              <span>{'★'.repeat(r)}{language === 'ar' ? ' فأكثر' : ' & up'}</span>
            </label>
          ))}
        </div>
      </div>
    </aside>
  );
}

export function ProductSortBar({ sort, onSortChange, total, language }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-white px-4 py-3">
      <p className="text-sm text-text-muted">
        {total} {language === 'ar' ? 'منتج' : 'products'}
      </p>
      <select
        value={sort}
        onChange={(e) => onSortChange(e.target.value)}
        className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium focus:border-primary-500 focus:outline-none"
      >
        <option value="">{language === 'ar' ? 'الترتيب الافتراضي' : 'Default'}</option>
        <option value="price-low">{language === 'ar' ? 'السعر: من الأقل للأعلى' : 'Price: Low to High'}</option>
        <option value="price-high">{language === 'ar' ? 'السعر: من الأعلى للأقل' : 'Price: High to Low'}</option>
        <option value="newest">{language === 'ar' ? 'الأحدث' : 'Newest'}</option>
        <option value="best-selling">{language === 'ar' ? 'الأكثر مبيعاً' : 'Best Selling'}</option>
        <option value="discount">{language === 'ar' ? 'أعلى خصم' : 'Highest Discount'}</option>
        <option value="top">{language === 'ar' ? 'الأعلى تقييماً' : 'Top Rated'}</option>
      </select>
    </div>
  );
}

export function ProductPagination({ pagination, onPageChange, language }) {
  if (!pagination || pagination.pages <= 1) return null;

  const { page, pages } = pagination;

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 py-6">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="rounded-lg border border-border px-4 py-2 text-sm font-medium disabled:opacity-40 hover:bg-surface"
      >
        {language === 'ar' ? '→ السابق' : '← Prev'}
      </button>
      {Array.from({ length: Math.min(pages, 7) }).map((_, i) => {
        const p = i + 1;
        return (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            className={`h-9 w-9 rounded-lg text-sm font-semibold ${p === page ? 'bg-primary-600 text-white' : 'border border-border hover:bg-surface'}`}
          >
            {p}
          </button>
        );
      })}
      <button
        type="button"
        disabled={page >= pages}
        onClick={() => onPageChange(page + 1)}
        className="rounded-lg border border-border px-4 py-2 text-sm font-medium disabled:opacity-40 hover:bg-surface"
      >
        {language === 'ar' ? 'التالي ←' : 'Next →'}
      </button>
    </div>
  );
}
