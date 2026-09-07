import { useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Search,
  X,
} from 'lucide-react';
import {
  buildCategoryTree,
  categoryHasChildren,
  categoryLabel,
  childrenOf,
  flattenCategoryTree,
  getRootCategories,
} from '../../utils/categoryHelpers';

function categoryIcon(cat) {
  if (cat?.icon && cat.icon.length <= 4) return cat.icon;
  return null;
}

export default function CategoryBrowsePicker({
  categories = [],
  value = '',
  onChange,
  isAr = true,
  includeInactive = false,
  leafOnly = false,
  showSelectionBanner = true,
}) {
  const [query, setQuery] = useState('');
  const [drillId, setDrillId] = useState('');

  const safeCategories = useMemo(
    () => (Array.isArray(categories)
      ? categories.filter((c) => c?._id && (includeInactive || c.isActive !== false))
      : []),
    [categories, includeInactive],
  );

  const tree = useMemo(() => buildCategoryTree(safeCategories), [safeCategories]);

  const flatWithPaths = useMemo(() => {
    const flat = flattenCategoryTree(tree);
    return flat.map((cat) => ({
      id: String(cat._id),
      cat,
      label: categoryLabel(cat, isAr),
      path: isAr ? (cat.pathLabelAr || '') : (cat.pathLabelEn || cat.pathLabelAr || ''),
      depth: cat.depth || 0,
      hasChildren: categoryHasChildren(safeCategories, cat._id),
    }));
  }, [tree, safeCategories, isAr]);

  const selectedMeta = useMemo(
    () => flatWithPaths.find((row) => row.id === String(value)),
    [flatWithPaths, value],
  );

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return flatWithPaths
      .filter((row) => {
        const hay = `${row.label} ${row.path} ${row.cat.slug || ''}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 40);
  }, [flatWithPaths, query]);

  const drillCategory = drillId
    ? safeCategories.find((c) => String(c._id) === String(drillId))
    : null;

  const drillChildren = useMemo(() => {
    if (!drillId) return getRootCategories(safeCategories);
    return childrenOf(safeCategories, drillId);
  }, [drillId, safeCategories]);

  const drillBreadcrumb = useMemo(() => {
    if (!drillCategory) return [];
    const chain = [];
    let current = drillCategory;
    const guard = new Set();
    while (current && !guard.has(String(current._id))) {
      guard.add(String(current._id));
      chain.unshift(current);
      const pid = current.parentCategory?._id || current.parentCategory;
      if (!pid) break;
      current = safeCategories.find((c) => String(c._id) === String(pid));
    }
    return chain;
  }, [drillCategory, safeCategories]);

  const selectCategory = (id) => {
    if (leafOnly && categoryHasChildren(safeCategories, id)) return;
    onChange(String(id));
    setQuery('');
  };

  const handleCategoryClick = (id, hasKids) => {
    if (leafOnly && hasKids) {
      openDrill(id);
      return;
    }
    selectCategory(id);
  };

  const clearSelection = () => {
    onChange('');
    setDrillId('');
    setQuery('');
  };

  const openDrill = (id) => {
    setDrillId(String(id));
    setQuery('');
  };

  const goUp = () => {
    if (!drillCategory) return;
    const pid = drillCategory.parentCategory?._id || drillCategory.parentCategory;
    setDrillId(pid ? String(pid) : '');
  };

  return (
    <div className="space-y-3">
      {showSelectionBanner && selectedMeta && (
        <div className="flex items-start gap-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wide text-orange-800/80">
              {isAr ? 'القسم المختار' : 'Selected category'}
            </p>
            <p className="mt-0.5 text-sm font-bold text-orange-950">{selectedMeta.label}</p>
            {selectedMeta.path && (
              <p className="mt-0.5 text-[11px] text-orange-900/70">{selectedMeta.path}</p>
            )}
          </div>
          <button
            type="button"
            onClick={clearSelection}
            className="shrink-0 rounded-lg p-1.5 text-orange-700 hover:bg-orange-100"
            aria-label={isAr ? 'إلغاء الاختيار' : 'Clear selection'}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={isAr ? 'ابحث في الأقسام… (مثال: حليب، مشروبات)' : 'Search categories… (e.g. milk, drinks)'}
          className="w-full rounded-xl border border-border bg-white py-2.5 pe-3 ps-10 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        {query.trim() ? (
          <div className="max-h-64 overflow-y-auto overscroll-y-contain">
            {searchResults.length ? (
              <ul className="divide-y divide-border">
                {searchResults.map((row) => {
                  const active = value === row.id;
                  const isParent = row.hasChildren;
                  return (
                    <li key={row.id}>
                      <button
                        type="button"
                        onClick={() => (leafOnly && isParent ? openDrill(row.id) : selectCategory(row.id))}
                        className={`flex w-full items-center gap-3 px-3 py-2.5 text-start transition-colors hover:bg-orange-50 ${
                          active ? 'bg-orange-50 ring-1 ring-inset ring-orange-200' : ''
                        }`}
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-lg">
                          {categoryIcon(row.cat) || (isParent ? '📂' : '📁')}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-text">
                            {row.label}
                            {includeInactive && row.cat.isActive === false && (
                              <span className="ms-1.5 text-[10px] font-bold text-red-600">
                                ({isAr ? 'غير نشط' : 'inactive'})
                              </span>
                            )}
                          </span>
                          {row.path && (
                            <span className="mt-0.5 block truncate text-[11px] text-text-muted">{row.path}</span>
                          )}
                          {leafOnly && isParent && (
                            <span className="mt-0.5 block text-[10px] text-amber-700">
                              {isAr ? 'له أقسام فرعية — انقر للتصفح' : 'Has subcategories — click to browse'}
                            </span>
                          )}
                        </span>
                        {active && (
                          <span className="shrink-0 rounded-full bg-orange-600 px-2 py-0.5 text-[9px] font-bold text-white">
                            ✓
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="px-4 py-8 text-center text-xs text-text-muted">
                {isAr ? 'لا قسم مطابق — جرّب كلمة أخرى' : 'No matching category — try another term'}
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-1 border-b border-border bg-slate-50/80 px-2 py-2">
              <button
                type="button"
                onClick={() => setDrillId('')}
                className={`rounded-lg px-2 py-1 text-[11px] font-semibold ${
                  !drillId ? 'bg-white text-orange-700 shadow-sm' : 'text-text-muted hover:bg-white'
                }`}
              >
                {isAr ? 'الكل' : 'All'}
              </button>
              {drillBreadcrumb.map((cat) => (
                <span key={cat._id} className="flex items-center gap-0.5 text-text-muted">
                  <ChevronRight className="h-3 w-3 rtl:rotate-180" />
                  <button
                    type="button"
                    onClick={() => setDrillId(String(cat._id))}
                    className="rounded-lg px-2 py-1 text-[11px] font-semibold text-text hover:bg-white"
                  >
                    {categoryLabel(cat, isAr)}
                  </button>
                </span>
              ))}
            </div>

            {drillId && drillCategory && (!leafOnly || !categoryHasChildren(safeCategories, drillCategory._id)) && (
              <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                <button
                  type="button"
                  onClick={goUp}
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] font-semibold hover:bg-slate-50"
                >
                  <ChevronLeft className="h-3.5 w-3.5 rtl:rotate-180" />
                  {isAr ? 'رجوع' : 'Back'}
                </button>
                <button
                  type="button"
                  onClick={() => selectCategory(drillCategory._id)}
                  className={`ms-auto rounded-lg px-2.5 py-1 text-[11px] font-bold ${
                    value === String(drillCategory._id)
                      ? 'bg-orange-600 text-white'
                      : 'border border-orange-300 text-orange-800 hover:bg-orange-50'
                  }`}
                >
                  {isAr ? 'اختيار هذا القسم' : 'Select this level'}
                </button>
              </div>
            )}

            {drillId && drillCategory && leafOnly && categoryHasChildren(safeCategories, drillCategory._id) && (
              <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                <button
                  type="button"
                  onClick={goUp}
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] font-semibold hover:bg-slate-50"
                >
                  <ChevronLeft className="h-3.5 w-3.5 rtl:rotate-180" />
                  {isAr ? 'رجوع' : 'Back'}
                </button>
                <span className="ms-auto text-[11px] text-text-muted">
                  {categoryLabel(drillCategory, isAr)}
                </span>
              </div>
            )}

            <div className="max-h-64 overflow-y-auto overscroll-y-contain p-2">
              {drillChildren.length ? (
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {drillChildren.map((cat) => {
                    const id = String(cat._id);
                    const hasKids = categoryHasChildren(safeCategories, cat._id);
                    const active = value === id;
                    const icon = categoryIcon(cat);

                    return (
                      <div
                        key={id}
                        className={`flex overflow-hidden rounded-xl border transition-colors ${
                          active ? 'border-orange-400 bg-orange-50 ring-1 ring-orange-200' : 'border-border bg-slate-50/50 hover:border-orange-200'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleCategoryClick(id, hasKids)}
                          className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2.5 text-start"
                        >
                          <span
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg"
                            style={cat.color ? { backgroundColor: `${cat.color}18` } : { backgroundColor: 'rgb(241 245 249)' }}
                          >
                            {icon || (hasKids ? '📂' : '📁')}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-bold text-text">
                              {categoryLabel(cat, isAr)}
                              {includeInactive && cat.isActive === false && (
                                <span className="ms-1 text-[9px] font-bold text-red-600">
                                  ({isAr ? 'غير نشط' : 'inactive'})
                                </span>
                              )}
                            </span>
                            <span className="mt-0.5 block text-[10px] text-text-muted">
                              {hasKids
                                ? (leafOnly
                                  ? (isAr ? 'تصفح الأقسام الفرعية' : 'Browse subcategories')
                                  : (isAr ? 'قسم رئيسي — يمكن الدخول' : 'Has subcategories'))
                                : (isAr ? 'انقر للاختيار' : 'Tap to select')}
                            </span>
                          </span>
                        </button>
                        {hasKids && (
                          <button
                            type="button"
                            onClick={() => openDrill(id)}
                            className="flex shrink-0 items-center border-s border-border px-2.5 text-orange-700 hover:bg-orange-100/80"
                            title={isAr ? 'عرض الأقسام الفرعية' : 'Browse subcategories'}
                          >
                            <ChevronRight className="h-4 w-4 rtl:rotate-180" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="px-3 py-8 text-center">
                  <FolderOpen className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-2 text-xs text-text-muted">
                    {isAr ? 'لا أقسام فرعية هنا' : 'No subcategories here'}
                  </p>
                  {drillCategory && (!leafOnly || !categoryHasChildren(safeCategories, drillCategory._id)) && (
                    <button
                      type="button"
                      onClick={() => selectCategory(drillCategory._id)}
                      className="mt-3 rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-bold text-white"
                    >
                      {isAr ? `اختيار «${categoryLabel(drillCategory, isAr)}»` : `Select «${categoryLabel(drillCategory, isAr)}»`}
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <p className="text-[10px] leading-relaxed text-text-muted">
        {isAr
          ? '↪ ابحث بالاسم أو تصفّح الشجرة. للدقة، اختر أقرب قسم فرعي (مثل «حليب طازج» بدل «ألبان» فقط).'
          : '↪ Search by name or browse the tree. For accuracy, pick the most specific subcategory.'}
      </p>
    </div>
  );
}
