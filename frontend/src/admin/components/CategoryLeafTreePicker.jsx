import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, FolderTree, Search, X } from 'lucide-react';
import {
  buildCategoryTree,
  categoryHasChildren,
  categoryLabel,
  flattenCategoryTree,
} from '../../utils/categoryHelpers';

/** Walk parentCategory links to collect every ancestor id (root → … → parent), unordered-safe. */
function ancestorIdsOf(categories, id) {
  const ids = [];
  let current = categories.find((c) => String(c._id) === String(id));
  const guard = new Set();
  while (current) {
    const pid = current.parentCategory?._id || current.parentCategory;
    if (!pid || guard.has(String(pid))) break;
    guard.add(String(pid));
    ids.push(String(pid));
    current = categories.find((c) => String(c._id) === String(pid));
  }
  return ids;
}

function TreeRow({
  node,
  depth,
  expanded,
  onToggle,
  onSelect,
  selectedId,
  excludeCategoryId,
  flashId,
  registerRef,
  isAr,
}) {
  const id = String(node._id);
  const hasChildren = node.children?.length > 0;
  const isSelected = !hasChildren && id === String(selectedId);
  const isExcluded = excludeCategoryId && id === String(excludeCategoryId);
  const isInactive = node.isActive === false;
  const isOpen = expanded.has(id);
  const isFlashing = flashId === id;

  const handleClick = () => {
    if (hasChildren) {
      onToggle(id);
      return;
    }
    if (isExcluded) return;
    onSelect(id);
  };

  return (
    <div ref={(el) => registerRef(id, el)}>
      <button
        type="button"
        onClick={handleClick}
        disabled={isExcluded && !hasChildren}
        className={`group flex w-full items-center gap-2 rounded-lg px-2 py-2 text-start transition-colors ${
          isSelected
            ? 'bg-orange-50 ring-1 ring-inset ring-orange-300'
            : isExcluded && !hasChildren
              ? 'cursor-not-allowed opacity-50'
              : 'hover:bg-slate-50'
        } ${isFlashing ? 'ring-2 ring-orange-400' : ''}`}
      >
        {hasChildren ? (
          <ChevronRight
            className={`h-3.5 w-3.5 shrink-0 text-text-muted transition-transform ${
              isOpen ? 'rotate-90' : 'rtl:rotate-180'
            }`}
          />
        ) : (
          <span className="h-3.5 w-3.5 shrink-0" />
        )}

        <span className="min-w-0 flex-1">
          <span className={`block truncate text-sm ${isSelected ? 'font-bold text-orange-950' : 'font-semibold text-text'}`}>
            {categoryLabel(node, isAr)}
            {isInactive && (
              <span className="ms-1.5 text-[10px] font-bold text-red-600">
                ({isAr ? 'غير نشط' : 'inactive'})
              </span>
            )}
            {isExcluded && (
              <span className="ms-1.5 text-[10px] font-bold text-amber-600">
                ({isAr ? 'القسم الحالي' : 'current'})
              </span>
            )}
          </span>
        </span>

        {hasChildren && (
          <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-text-muted group-hover:bg-slate-200">
            {node.children.length}
          </span>
        )}
        {isSelected && (
          <span className="shrink-0 rounded-full bg-orange-600 px-2 py-0.5 text-[9px] font-bold text-white">
            ✓
          </span>
        )}
      </button>

      {hasChildren && isOpen && (
        <div className="ms-[18px] ps-2 border-s-2 border-slate-100">
          {node.children.map((child) => (
            <TreeRow
              key={child._id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              onSelect={onSelect}
              selectedId={selectedId}
              excludeCategoryId={excludeCategoryId}
              flashId={flashId}
              registerRef={registerRef}
              isAr={isAr}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CategoryLeafTreePicker({
  categories = [],
  value = '',
  onChange,
  isAr = true,
  includeInactive = true,
  excludeCategoryId = '',
}) {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(() => new Set());
  const [flashId, setFlashId] = useState('');
  const rowRefs = useRef(new Map());
  const initializedForValue = useRef('');

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
      hasChildren: categoryHasChildren(safeCategories, cat._id),
    }));
  }, [tree, safeCategories, isAr]);

  const registerRef = (id, el) => {
    if (el) rowRefs.current.set(id, el);
    else rowRefs.current.delete(id);
  };

  // Auto-expand the branch that leads to the current value, once per external value change.
  useEffect(() => {
    const leafId = value ? String(value) : '';
    if (!leafId || leafId === initializedForValue.current) return;
    if (!safeCategories.length) return;
    initializedForValue.current = leafId;
    const ancestors = ancestorIdsOf(safeCategories, leafId);
    if (!ancestors.length) return;
    setExpanded((prev) => {
      const next = new Set(prev);
      ancestors.forEach((id) => next.add(id));
      return next;
    });
    requestAnimationFrame(() => {
      rowRefs.current.get(leafId)?.scrollIntoView({ block: 'nearest' });
    });
  }, [value, safeCategories]);

  const toggle = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    const all = flatWithPaths.filter((row) => row.hasChildren).map((row) => row.id);
    setExpanded(new Set(all));
  };

  const collapseAll = () => setExpanded(new Set());

  const jumpToNode = (id) => {
    const ancestors = ancestorIdsOf(safeCategories, id);
    setExpanded((prev) => {
      const next = new Set(prev);
      ancestors.forEach((aid) => next.add(aid));
      return next;
    });
    setQuery('');
    setFlashId(id);
    requestAnimationFrame(() => {
      rowRefs.current.get(id)?.scrollIntoView({ block: 'center' });
    });
    setTimeout(() => setFlashId(''), 1300);
  };

  const select = (id) => {
    onChange(String(id));
    setQuery('');
  };

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return flatWithPaths
      .filter((row) => `${row.label} ${row.path} ${row.cat.slug || ''}`.toLowerCase().includes(q))
      .slice(0, 40);
  }, [flatWithPaths, query]);

  return (
    <div className="space-y-2.5">
      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={isAr ? 'ابحث عن قسم… (مثال: حليب، مشروبات)' : 'Search categories… (e.g. milk, drinks)'}
          className="w-full rounded-xl border border-border bg-white py-2.5 pe-3 ps-10 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute end-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100"
            aria-label={isAr ? 'مسح البحث' : 'Clear search'}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {query.trim() ? (
        <div className="max-h-72 overflow-y-auto rounded-xl border border-border bg-white shadow-sm">
          {searchResults.length ? (
            <ul className="divide-y divide-border">
              {searchResults.map((row) => {
                const isExcluded = excludeCategoryId && row.id === String(excludeCategoryId);
                const isSelected = !row.hasChildren && row.id === String(value);
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      disabled={row.hasChildren ? false : isExcluded}
                      onClick={() => (row.hasChildren ? jumpToNode(row.id) : select(row.id))}
                      className={`flex w-full items-center gap-3 px-3 py-2.5 text-start transition-colors hover:bg-orange-50 ${
                        isSelected ? 'bg-orange-50 ring-1 ring-inset ring-orange-200' : ''
                      } ${isExcluded && !row.hasChildren ? 'cursor-not-allowed opacity-50' : ''}`}
                    >
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
                        {row.hasChildren && (
                          <span className="mt-0.5 block text-[10px] text-amber-700">
                            {isAr ? 'له أقسام فرعية — انقر للتصفح في الشجرة' : 'Has subcategories — click to jump in the tree'}
                          </span>
                        )}
                      </span>
                      {isSelected && (
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
        <div className="rounded-xl border border-border bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-border bg-slate-50/80 px-3 py-1.5">
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-text-muted">
              <FolderTree className="h-3.5 w-3.5" />
              {isAr ? 'شجرة الأقسام' : 'Category tree'}
            </span>
            <span className="flex items-center gap-1">
              <button
                type="button"
                onClick={expandAll}
                className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-orange-700 hover:bg-white"
              >
                {isAr ? 'توسيع الكل' : 'Expand all'}
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={collapseAll}
                className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-text-muted hover:bg-white"
              >
                {isAr ? 'طي الكل' : 'Collapse all'}
              </button>
            </span>
          </div>

          <div className="max-h-80 overflow-y-auto p-1.5">
            {tree.length ? (
              tree.map((node) => (
                <TreeRow
                  key={node._id}
                  node={node}
                  depth={0}
                  expanded={expanded}
                  onToggle={toggle}
                  onSelect={select}
                  selectedId={value}
                  excludeCategoryId={excludeCategoryId}
                  flashId={flashId}
                  registerRef={registerRef}
                  isAr={isAr}
                />
              ))
            ) : (
              <p className="px-3 py-8 text-center text-xs text-text-muted">
                {isAr ? 'لا توجد أقسام بعد' : 'No categories yet'}
              </p>
            )}
          </div>
        </div>
      )}

      <p className="text-[10px] leading-relaxed text-text-muted">
        {isAr
          ? '↪ ابحث بالاسم أو تصفّح الشجرة. الأقسام التي لها سهم هي مجموعات — افتحها واختر أدق قسم فرعي بداخلها.'
          : '↪ Search by name or browse the tree. Rows with an arrow are groups — open them and pick the most specific subcategory inside.'}
      </p>
    </div>
  );
}
