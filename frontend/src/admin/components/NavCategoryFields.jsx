import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { adminApi } from '../adminApi';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import CategoryBrowsePicker from './CategoryBrowsePicker';
import { buildCategoryPath, buildCategorySlugChain, categoryLabel } from '../../utils/categoryHelpers';

function categoryDepthLabel(cat, isAr) {
  const level = cat.level || 1;
  if (level === 1) return isAr ? 'رئيسي' : 'Main';
  if (level === 2) return isAr ? 'فرعي' : 'Sub';
  return isAr ? `مستوى ${level}` : `Level ${level}`;
}

export default function NavCategoryFields({ isAr, value = [], onChange }) {
  const [allCategories, setAllCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pickId, setPickId] = useState('');

  useEffect(() => {
    adminApi.getCategories({ limit: 500, page: 1 })
      .then(({ data }) => setAllCategories(data.data || []))
      .catch(() => setAllCategories([]))
      .finally(() => setLoading(false));
  }, []);

  const usedSlugs = useMemo(
    () => new Set(value.map((item) => item.categorySlug).filter(Boolean)),
    [value],
  );

  const available = useMemo(
    () => allCategories
      .filter((cat) => cat.isActive !== false && cat.slug && !usedSlugs.has(cat.slug))
      .sort((a, b) => (a.level || 1) - (b.level || 1) || (a.sortOrder || 0) - (b.sortOrder || 0)),
    [allCategories, usedSlugs],
  );

  const bySlug = useMemo(
    () => new Map(allCategories.map((cat) => [cat.slug, cat])),
    [allCategories],
  );

  const byId = useMemo(
    () => new Map(allCategories.map((cat) => [String(cat._id), cat])),
    [allCategories],
  );

  const addCategory = () => {
    if (!pickId) return;
    const cat = byId.get(String(pickId));
    if (!cat?.slug || usedSlugs.has(cat.slug)) return;
    onChange([
      ...value,
      {
        categorySlug: cat.slug,
        labelAr: '',
        labelEn: '',
        sortOrder: value.length,
        isActive: true,
      },
    ]);
    setPickId('');
  };

  const updateItem = (index, field, fieldValue) => {
    const next = [...value];
    next[index] = { ...next[index], [field]: fieldValue };
    onChange(next);
  };

  const moveItem = (index, dir) => {
    const next = [...value];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next.map((item, i) => ({ ...item, sortOrder: i })));
  };

  const removeItem = (index) => {
    onChange(value.filter((_, i) => i !== index).map((item, i) => ({ ...item, sortOrder: i })));
  };

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-white p-6 shadow-sm">
      <div>
        <h2 className="font-bold">{isAr ? 'أقسام شريط التنقل' : 'Navigation categories'}</h2>
        <p className="mt-1 text-sm text-text-muted">
          {isAr
            ? 'اختر أي قسم من متجرك ليظهر في شريط التنقل. عند تمرير الماوس يعرض الأقسام الفرعية، وعند النقر يفتح القسم الصحيح.'
            : 'Pick any store category to show in the nav bar. Hover reveals subcategories; click opens the correct category page.'}
        </p>
      </div>

      <div className="rounded-xl border border-dashed border-primary-200 bg-primary-50/40 p-4">
        <p className="mb-3 text-xs font-medium text-text-muted">
          {isAr ? 'إضافة قسم للشريط' : 'Add category to nav bar'}
        </p>
        {loading ? (
          <p className="text-sm text-text-muted">{isAr ? 'جاري التحميل...' : 'Loading...'}</p>
        ) : !available.length ? (
          <p className="text-sm text-text-muted">
            {isAr ? 'كل الأقسام مضافة بالفعل.' : 'All categories are already added.'}
          </p>
        ) : (
          <>
            <CategoryBrowsePicker
              categories={allCategories.filter((cat) => cat.slug && !usedSlugs.has(cat.slug))}
              value={pickId}
              onChange={setPickId}
              isAr={isAr}
              showSelectionBanner={false}
            />
            <div className="mt-3">
              <Button type="button" size="sm" onClick={addCategory} disabled={!pickId}>
                <Plus className="h-4 w-4" />
                {isAr ? 'إضافة للشريط' : 'Add to nav'}
              </Button>
            </div>
          </>
        )}
      </div>

      {!value.length && (
        <p className="rounded-xl border border-dashed border-border bg-surface px-4 py-6 text-center text-sm text-text-muted">
          {isAr ? 'لم تُضف أقسام بعد — أضف قسماً ليظهر للعملاء في الشريط العلوي.' : 'No categories added yet — add one to show it in the storefront nav.'}
        </p>
      )}

      {value.map((item, index) => {
        const cat = bySlug.get(item.categorySlug);
        const previewHref = cat ? buildCategoryPath(buildCategorySlugChain(cat, allCategories)) : '#';
        const displayAr = item.labelAr || categoryLabel(cat, true);
        const displayEn = item.labelEn || categoryLabel(cat, false);

        return (
          <div key={`${item.categorySlug}-${index}`} className="space-y-3 rounded-xl border border-border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-text">{isAr ? displayAr : displayEn}</p>
                <p className="text-xs text-text-muted">
                  {cat ? `${categoryDepthLabel(cat, isAr)} · /category/...` : (isAr ? 'قسم غير موجود' : 'Category missing')}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" className="rounded-lg p-1.5 text-text-muted hover:bg-surface" onClick={() => moveItem(index, -1)} aria-label="Move up">
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button type="button" className="rounded-lg p-1.5 text-text-muted hover:bg-surface" onClick={() => moveItem(index, 1)} aria-label="Move down">
                  <ChevronDown className="h-4 w-4" />
                </button>
                <button type="button" className="rounded-lg p-1.5 text-red-500 hover:bg-red-50" onClick={() => removeItem(index)}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <Input
                label={isAr ? 'تسمية عربية (اختياري)' : 'Arabic label (optional)'}
                value={item.labelAr}
                onChange={(e) => updateItem(index, 'labelAr', e.target.value)}
                placeholder={categoryLabel(cat, true)}
              />
              <Input
                label={isAr ? 'تسمية EN (اختياري)' : 'English label (optional)'}
                value={item.labelEn}
                onChange={(e) => updateItem(index, 'labelEn', e.target.value)}
                placeholder={categoryLabel(cat, false)}
              />
              <div className="flex items-end gap-3">
                <label className="flex items-center gap-2 pb-2 text-sm">
                  <input
                    type="checkbox"
                    checked={item.isActive !== false}
                    onChange={(e) => updateItem(index, 'isActive', e.target.checked)}
                  />
                  {isAr ? 'نشط' : 'Active'}
                </label>
                {cat && (
                  <a href={previewHref} target="_blank" rel="noreferrer" className="pb-2 text-xs font-semibold text-primary-600 hover:underline">
                    {isAr ? 'معاينة' : 'Preview'}
                  </a>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}

const emptyNavCategory = () => ({
  categorySlug: '',
  labelAr: '',
  labelEn: '',
  sortOrder: 0,
  isActive: true,
});

export { emptyNavCategory };
