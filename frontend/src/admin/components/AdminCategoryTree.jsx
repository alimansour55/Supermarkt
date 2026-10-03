import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownAZ,
  ChevronDown,
  FolderOpen,
  GripVertical,
  MoreHorizontal,
  Package,
  Plus,
  Search,
  X,
} from 'lucide-react';
import {
  CATEGORY_LEVEL_LABELS,
  buildCategoryTree,
  categoryLabel,
  categoryRoleMeta,
  getRootCategories,
} from '../../utils/categoryHelpers';
import { useToast } from './index';

const INDENT = 22;
const RECENT_KEY = 'admin-category-tree-recent';
const MAX_RECENT = 4;

const STATUS_FILTERS = ['all', 'active', 'inactive'];

function normalizeParentId(category) {
  const parent = category?.parentCategory;
  if (!parent) return null;
  return String(parent._id || parent);
}

function categoryHasChildCategories(categoryId, allCategories) {
  const id = String(categoryId);
  return allCategories.some((c) => normalizeParentId(c) === id);
}

function isDescendantOf(ancestorId, nodeId, allCategories) {
  let current = allCategories.find((c) => String(c._id) === String(nodeId));
  while (current) {
    const pid = normalizeParentId(current);
    if (!pid) return false;
    if (pid === String(ancestorId)) return true;
    current = allCategories.find((c) => String(c._id) === pid);
  }
  return false;
}

function getAddChildLabel(parentLevel, isAr) {
  const childLevel = Math.min(Number(parentLevel || 1) + 1, 4);
  const labels = CATEGORY_LEVEL_LABELS[childLevel] || CATEGORY_LEVEL_LABELS[2];
  return isAr ? labels.ar : labels.en;
}

function getCategoryChain(category, allCategories) {
  if (!category?._id) return [];
  const chain = [];
  let current = category;
  const guard = new Set();
  while (current && !guard.has(String(current._id))) {
    guard.add(String(current._id));
    chain.unshift(current);
    const pid = current.parentCategory?._id || current.parentCategory;
    current = pid ? allCategories.find((c) => String(c._id) === String(pid)) : null;
  }
  return chain;
}

function getAncestorIds(category, allCategories) {
  const ids = [];
  let current = category;
  const guard = new Set();
  while (current && !guard.has(String(current._id))) {
    guard.add(String(current._id));
    const pid = current.parentCategory?._id || current.parentCategory;
    if (!pid) break;
    ids.push(String(pid));
    current = allCategories.find((c) => String(c._id) === String(pid));
  }
  return ids;
}

function flattenVisibleTree(nodes, expandedSet) {
  const result = [];
  const walk = (list) => {
    list.forEach((node) => {
      result.push(node);
      const kids = node.children || [];
      if (kids.length && expandedSet.has(String(node._id))) {
        walk(kids);
      }
    });
  };
  walk(nodes);
  return result;
}

function sortTreeByName(nodes, isAr) {
  const cmp = (a, b) => categoryLabel(a, isAr).localeCompare(categoryLabel(b, isAr), isAr ? 'ar' : 'en');
  return [...nodes]
    .sort(cmp)
    .map((node) => ({
      ...node,
      children: node.children?.length ? sortTreeByName(node.children, isAr) : [],
    }));
}

function filterTreeByStatus(nodes, statusFilter) {
  if (statusFilter === 'all') return nodes;

  const walk = (list) => list
    .map((node) => {
      const children = walk(node.children || []);
      const isActive = node.isActive !== false;
      const match = statusFilter === 'active' ? isActive : !isActive;
      if (match || children.length) {
        return { ...node, children };
      }
      return null;
    })
    .filter(Boolean);

  return walk(nodes);
}

function loadRecent() {
  try {
    const raw = sessionStorage.getItem(RECENT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function saveRecent(ids) {
  try {
    sessionStorage.setItem(RECENT_KEY, JSON.stringify(ids.slice(0, MAX_RECENT)));
  } catch { /* ignore */ }
}

function highlightQuery(text, query) {
  const q = query.trim();
  if (!q || !text) return text;
  const lower = text.toLowerCase();
  const idx = lower.indexOf(q.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded bg-slate-900/10 font-medium text-inherit">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  );
}

function TreeContextMenu({ items, open, onClose, anchorRef, position }) {
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (menuRef.current?.contains(e.target) || anchorRef?.current?.contains(e.target)) return;
      onClose();
    };
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, anchorRef]);

  if (!open || !items.length) return null;

  let style;
  if (position) {
    const menuW = 220;
    const menuH = items.length * 36 + 16;
    const left = Math.min(position.x, window.innerWidth - menuW - 8);
    const top = Math.min(position.y, window.innerHeight - menuH - 8);
    style = { top, left };
  } else {
    const rect = anchorRef?.current?.getBoundingClientRect();
    style = {
      top: rect ? rect.bottom + 4 : 0,
      insetInlineEnd: rect ? Math.max(12, window.innerWidth - rect.right) : 12,
    };
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] min-w-[220px] overflow-hidden rounded-xl border border-slate-200/90 bg-white py-1 shadow-xl"
      style={style}
      role="menu"
    >
      {items.map((item, idx) => {
        if (item.type === 'divider') {
          return <div key={`div-${idx}`} className="my-1 border-t border-slate-100" role="separator" />;
        }
        return (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onClick={(e) => {
              e.stopPropagation();
              onClose();
              item.onClick();
            }}
            className={[
              'w-full px-3.5 py-2 text-start text-[13px] transition-colors disabled:opacity-40',
              item.danger
                ? 'text-red-600 hover:bg-red-50'
                : 'text-slate-700 hover:bg-slate-50',
            ].join(' ')}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function DropIndicator({ active, label }) {
  if (!active) return null;
  return (
    <div className="pointer-events-none relative z-20 mx-2 my-0.5 flex items-center gap-2" aria-hidden>
      <div className="h-0.5 flex-1 rounded-full bg-slate-900" />
      {label && (
        <span className="shrink-0 rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-medium text-white">
          {label}
        </span>
      )}
      <div className="h-0.5 flex-1 rounded-full bg-slate-900" />
    </div>
  );
}

function RootInsertZone({ isAr, onAdd, disabled }) {
  return (
    <div className="group/insert relative flex h-3 items-center justify-center">
      <div className="absolute inset-x-3 top-1/2 h-px scale-x-0 bg-slate-300 transition-transform group-hover/insert:scale-x-100" />
      <button
        type="button"
        disabled={disabled}
        onClick={onAdd}
        title={isAr ? 'إضافة قسم رئيسي هنا' : 'Add main category here'}
        className={[
          'relative z-10 flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-slate-300 bg-white text-slate-400 transition-all',
          disabled
            ? 'cursor-not-allowed opacity-40'
            : 'opacity-0 group-hover/insert:opacity-100 hover:border-slate-500 hover:text-slate-800',
        ].join(' ')}
      >
        <Plus className="h-3 w-3" strokeWidth={2.5} />
      </button>
    </div>
  );
}

function TreeGuides({ ancestorLines, isLast, depth }) {
  if (depth === 0) return null;
  return (
    <span className="flex shrink-0 self-stretch" aria-hidden>
      {ancestorLines.map((continues, i) => (
        <span key={i} className="relative w-[22px] shrink-0">
          {continues && (
            <span className="absolute inset-y-0 start-[10px] w-px bg-slate-200" />
          )}
        </span>
      ))}
      <span className="relative w-[22px] shrink-0">
        <span className="absolute top-0 start-[10px] h-1/2 w-px bg-slate-200" />
        {!isLast && <span className="absolute bottom-0 start-[10px] h-1/2 w-px bg-slate-200" />}
        <span className="absolute top-1/2 start-[10px] h-px w-[12px] -translate-y-px rounded-full bg-slate-200" />
      </span>
    </span>
  );
}

function TreeNode({
  node,
  isAr,
  allCategories,
  depth,
  isLast = true,
  ancestorLines = [],
  expandedIds,
  onToggleExpand,
  selectedId,
  onSelect,
  onEdit,
  onDelete,
  onAddChild,
  onAddProduct,
  onToggleActive,
  onMoveProducts,
  categoryHasProducts,
  searchActive,
  searchQuery,
  focusedId,
  onFocusNode,
  onOpenContextMenu,
  dragEnabled,
  dragId,
  dropHint,
  onDragStart,
  onDragEnd,
  onDragOverNode,
  onDropNode,
  reordering,
}) {
  const id = String(node._id);
  const kids = node.children || [];
  const hasChildren = kids.length > 0;
  const { isLeaf, childCount, productCount } = categoryRoleMeta(node);
  const displayCount = isLeaf
    ? (productCount ?? node.productCount ?? 0)
    : (hasChildren ? kids.length : (childCount || 0));
  const expanded = searchActive || expandedIds.has(id);
  const selected = selectedId === id;
  const focused = focusedId === id;
  const inactive = node.isActive === false;
  const level = Number(node.level || 1);
  const canAddChild = level < 4;
  const addChildLabel = getAddChildLabel(level, isAr);
  const label = categoryLabel(node, isAr);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuBtnRef = useRef(null);
  const rowRef = useRef(null);
  const nodeHasProducts = categoryHasProducts?.(node) ?? false;

  useEffect(() => {
    if (focused && rowRef.current) {
      rowRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [focused]);

  const menuItems = useMemo(() => {
    const items = [];
    if (onEdit) {
      items.push({ label: isAr ? 'تعديل القسم' : 'Edit category', onClick: () => onEdit(node) });
    }
    if (canAddChild && onAddChild) {
      items.push({
        label: isAr ? `إضافة ${addChildLabel}` : `Add ${addChildLabel.toLowerCase()}`,
        onClick: () => onAddChild(node),
      });
    }
    if (isLeaf && onAddProduct) {
      items.push({ label: isAr ? 'إضافة منتج' : 'Add product', onClick: () => onAddProduct(node) });
    }
    if (items.length) items.push({ type: 'divider' });
    if (onToggleActive) {
      items.push({
        label: inactive ? (isAr ? 'تفعيل' : 'Activate') : (isAr ? 'تعطيل' : 'Deactivate'),
        onClick: () => onToggleActive(node),
      });
    }
    if (nodeHasProducts && onMoveProducts) {
      items.push({ label: isAr ? 'نقل المنتجات' : 'Move products', onClick: () => onMoveProducts(node) });
    }
    if (onDelete) {
      items.push({ type: 'divider' });
      items.push({
        label: isAr ? 'حذف القسم' : 'Delete category',
        danger: true,
        onClick: () => onDelete(node),
      });
    }
    return items;
  }, [
    addChildLabel, canAddChild, inactive, isAr, isLeaf, node, nodeHasProducts,
    onAddChild, onAddProduct, onDelete, onEdit, onMoveProducts, onToggleActive,
  ]);

  const countTitle = isLeaf
    ? (isAr ? `${displayCount} منتج` : `${displayCount} products`)
    : (isAr ? `${displayCount} فرعي` : `${displayCount} subcategories`);

  const handleContextMenu = (e) => {
    if (!menuItems.length) return;
    e.preventDefault();
    onOpenContextMenu?.({ x: e.clientX, y: e.clientY, items: menuItems });
  };

  const isDragging = dragId === id;
  const dropBefore = dropHint?.targetId === id && dropHint?.position === 'before';
  const dropAfter = dropHint?.targetId === id && dropHint?.position === 'after';
  const dropInside = dropHint?.targetId === id && dropHint?.position === 'inside';
  const canAcceptDropInside = canAddChild;

  return (
    <li className="select-none" role="none">
      <DropIndicator active={dropBefore} />
      <div
        ref={rowRef}
        role="treeitem"
        aria-expanded={hasChildren ? expanded : undefined}
        aria-selected={selected}
        aria-level={level}
        aria-grabbed={isDragging}
        tabIndex={focused ? 0 : -1}
        onFocus={() => onFocusNode?.(id)}
        onContextMenu={handleContextMenu}
        onDragOver={(e) => {
          if (!dragEnabled || !dragId || dragId === id) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          const rect = e.currentTarget.getBoundingClientRect();
          const offsetY = e.clientY - rect.top;
          const zone = rect.height / 3;
          let position = 'after';
          if (offsetY < zone) position = 'before';
          else if (offsetY > zone * 2 && canAcceptDropInside) position = 'inside';
          onDragOverNode?.(id, position);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) {
            onDragOverNode?.(null, null);
          }
        }}
        onDrop={(e) => {
          if (!dragEnabled || !dragId) return;
          e.preventDefault();
          e.stopPropagation();
          onDropNode?.(id, dropHint?.targetId === id ? dropHint.position : 'after');
        }}
        className={[
          'group/node relative flex items-center transition-colors duration-100',
          isDragging ? 'opacity-40' : '',
          dropInside ? 'ring-2 ring-primary-400/40 ring-offset-1' : '',
          selected
            ? 'bg-primary-50'
            : focused
              ? 'bg-slate-50'
              : 'hover:bg-slate-50',
          inactive && !selected ? 'opacity-40' : '',
          reordering ? 'pointer-events-none' : '',
        ].join(' ')}
      >
        <span
          className={[
            'absolute inset-y-[3px] start-0 w-0.5 rounded-full transition-colors',
            selected ? 'bg-primary-600' : 'bg-transparent',
          ].join(' ')}
          aria-hidden
        />
        <TreeGuides ancestorLines={ancestorLines} isLast={isLast} depth={depth} />

        {dragEnabled ? (
          <div
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('text/plain', id);
              e.dataTransfer.effectAllowed = 'move';
              onDragStart?.(id);
            }}
            onDragEnd={onDragEnd}
            className="flex h-9 w-4 shrink-0 cursor-grab items-center justify-center text-slate-300 active:cursor-grabbing hover:text-slate-500"
            title={isAr ? 'اسحب لإعادة الترتيب' : 'Drag to reorder'}
          >
            <GripVertical className="h-3.5 w-3.5" strokeWidth={2} />
          </div>
        ) : (
          <span className="w-4 shrink-0" aria-hidden />
        )}
        <button
          type="button"
          onClick={(e) => {
            if (hasChildren) {
              if (e.altKey) onToggleExpand(id, { solo: true, node });
              else onToggleExpand(id);
            } else {
              onSelect?.(node);
            }
          }}
          className={[
            'flex h-9 w-5 shrink-0 items-center justify-center text-slate-400 transition-colors',
            hasChildren ? 'hover:text-slate-700' : '',
          ].join(' ')}
          aria-expanded={hasChildren ? expanded : undefined}
          aria-label={hasChildren
            ? (expanded ? (isAr ? 'طي' : 'Collapse') : (isAr ? 'توسيع' : 'Expand'))
            : undefined}
          tabIndex={-1}
        >
          {hasChildren && (
            <span className={`transition-transform duration-150 ${expanded ? 'rotate-0' : '-rotate-90 rtl:rotate-90'}`}>
              <ChevronDown className="h-3.5 w-3.5" strokeWidth={2} />
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => onSelect?.(node)}
          onDoubleClick={() => onEdit?.(node)}
          className="flex min-w-0 flex-1 items-center gap-2 py-2 pe-2 text-start"
          tabIndex={-1}
        >
          <span
            className="flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden rounded text-[12px] leading-none text-slate-400"
            aria-hidden
          >
            {node.image ? (
              <img src={node.image} alt="" className="h-4 w-4 rounded object-cover" />
            ) : isLeaf ? (
              <Package className="h-3.5 w-3.5" strokeWidth={2} />
            ) : node.icon ? (
              <span>{node.icon}</span>
            ) : (
              <FolderOpen className="h-3.5 w-3.5" strokeWidth={2} />
            )}
          </span>

          <span
            className={[
              'min-w-0 flex-1 truncate text-[13px]',
              selected
                ? 'font-semibold text-primary-900'
                : depth === 0
                  ? 'font-semibold text-slate-800'
                  : 'text-slate-600',
            ].join(' ')}
          >
            {searchActive ? highlightQuery(label, searchQuery) : label}
          </span>

          {inactive && (
            <span className="shrink-0 text-[10px] font-medium text-slate-400">
              {isAr ? 'معطل' : 'off'}
            </span>
          )}

          {displayCount > 0 && (
            <span
              className="shrink-0 text-[11px] tabular-nums text-slate-400"
              title={countTitle}
            >
              {displayCount}
            </span>
          )}
        </button>

        <div
          className={[
            'flex shrink-0 items-center gap-0.5 pe-1.5 transition-opacity duration-100',
            selected || menuOpen || focused
              ? 'opacity-100'
              : 'opacity-100 lg:opacity-0 lg:group-hover/node:opacity-100 lg:group-focus-within/node:opacity-100',
          ].join(' ')}
        >
          {canAddChild && onAddChild && (
            <button
              type="button"
              title={isAr ? `إضافة ${addChildLabel}` : `Add ${addChildLabel.toLowerCase()}`}
              onClick={(e) => {
                e.stopPropagation();
                onAddChild(node);
              }}
              className="flex h-6 w-6 items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-200/70 hover:text-slate-800"
              tabIndex={-1}
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          )}
          {menuItems.length > 0 && (
            <>
              <button
                ref={menuBtnRef}
                type="button"
                title={isAr ? 'إجراءات' : 'Actions'}
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen((v) => !v);
                }}
                className={[
                  'flex h-6 w-6 items-center justify-center rounded text-slate-400 transition-colors hover:text-slate-800',
                  menuOpen ? 'bg-slate-200/70 text-slate-800' : 'hover:bg-slate-200/70',
                ].join(' ')}
                tabIndex={-1}
              >
                <MoreHorizontal className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
              <TreeContextMenu
                items={menuItems}
                open={menuOpen}
                onClose={() => setMenuOpen(false)}
                anchorRef={menuBtnRef}
              />
            </>
          )}
        </div>
      </div>
      <DropIndicator active={dropAfter} />

      {hasChildren && (
        <div
          className={[
            'grid transition-[grid-template-rows] duration-200 ease-out',
            expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
          ].join(' ')}
        >
          <div className="overflow-hidden">
            <ul role="group">
              {kids.map((child, childIdx) => (
                <TreeNode
                  key={child._id}
                  node={child}
                  isAr={isAr}
                  allCategories={allCategories}
                  depth={depth + 1}
                  isLast={childIdx === kids.length - 1}
                  ancestorLines={[...ancestorLines, !isLast]}
                  expandedIds={expandedIds}
                  onToggleExpand={onToggleExpand}
                  selectedId={selectedId}
                  onSelect={onSelect}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onAddChild={onAddChild}
                  onAddProduct={onAddProduct}
                  onToggleActive={onToggleActive}
                  onMoveProducts={onMoveProducts}
                  categoryHasProducts={categoryHasProducts}
                  searchActive={searchActive}
                  searchQuery={searchQuery}
                  focusedId={focusedId}
                  onFocusNode={onFocusNode}
                  onOpenContextMenu={onOpenContextMenu}
                  dragEnabled={dragEnabled}
                  dragId={dragId}
                  dropHint={dropHint}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                  onDragOverNode={onDragOverNode}
                  onDropNode={onDropNode}
                  reordering={reordering}
                />
              ))}
            </ul>
          </div>
        </div>
      )}
    </li>
  );
}

function SelectedBreadcrumb({ category, allCategories, isAr, onSelect }) {
  const chain = useMemo(
    () => getCategoryChain(category, allCategories),
    [category, allCategories],
  );

  if (!chain.length) return null;

  return (
    <nav
      className="truncate text-xs text-slate-600"
      aria-label={isAr ? 'مسار القسم المحدد' : 'Selected category path'}
    >
      {chain.map((cat, idx) => {
        const isLast = idx === chain.length - 1;
        return (
          <Fragment key={cat._id}>
            {idx > 0 && <span className="mx-1.5 text-slate-300">/</span>}
            {isLast ? (
              <span className="font-semibold text-slate-900">{categoryLabel(cat, isAr)}</span>
            ) : (
              <button
                type="button"
                onClick={() => onSelect?.(cat)}
                className="font-medium text-slate-500 transition-colors hover:text-slate-900"
              >
                {categoryLabel(cat, isAr)}
              </button>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}

function RecentChips({ recentIds, categories, isAr, selectedId, onSelect }) {
  const items = useMemo(
    () => recentIds
      .map((id) => categories.find((c) => String(c._id) === id))
      .filter(Boolean),
    [recentIds, categories],
  );

  if (!items.length) return null;

  return (
    <div className="flex gap-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.map((cat) => {
        const active = String(cat._id) === String(selectedId);
        return (
          <button
            key={cat._id}
            type="button"
            onClick={() => onSelect?.(cat)}
            className={[
              'max-w-[100px] shrink-0 truncate rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors',
              active
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900',
            ].join(' ')}
            title={categoryLabel(cat, isAr)}
          >
            {categoryLabel(cat, isAr)}
          </button>
        );
      })}
    </div>
  );
}

export default function AdminCategoryTree({
  categories = [],
  isAr,
  selectedId = '',
  onSelect,
  onEdit,
  onDelete,
  onAddRoot,
  onAddRootAt,
  onAddChild,
  onAddProduct,
  onToggleActive,
  onMoveProducts,
  onReorder,
  categoryHasProducts,
  loading = false,
}) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortByName, setSortByName] = useState(false);
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [focusedId, setFocusedId] = useState('');
  const [recentIds, setRecentIds] = useState(loadRecent);
  const [contextMenu, setContextMenu] = useState({ open: false, x: 0, y: 0, items: [] });
  const [dragId, setDragId] = useState('');
  const [dropHint, setDropHint] = useState(null);
  const [reordering, setReordering] = useState(false);
  const treeRef = useRef(null);
  const searchRef = useRef(null);
  const toast = useToast();

  const safeCategories = useMemo(
    () => (Array.isArray(categories) ? categories.filter((c) => c?._id) : []),
    [categories],
  );

  const tree = useMemo(() => {
    let built = buildCategoryTree(safeCategories);
    built = filterTreeByStatus(built, statusFilter);
    if (sortByName) built = sortTreeByName(built, isAr);
    return built;
  }, [safeCategories, statusFilter, sortByName, isAr]);

  const roots = useMemo(() => getRootCategories(safeCategories), [safeCategories]);

  const selectedCategory = useMemo(
    () => safeCategories.find((c) => String(c._id) === String(selectedId)) || null,
    [safeCategories, selectedId],
  );

  const stats = useMemo(() => {
    const active = safeCategories.filter((c) => c.isActive !== false).length;
    return { total: safeCategories.length, active, inactive: safeCategories.length - active };
  }, [safeCategories]);

  useEffect(() => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      roots.forEach((r) => next.add(String(r._id)));
      return next;
    });
  }, [roots]);

  useEffect(() => {
    if (!selectedId) return;
    setFocusedId(String(selectedId));
    const cat = safeCategories.find((c) => String(c._id) === String(selectedId));
    if (!cat) return;
    const ancestors = getAncestorIds(cat, safeCategories);
    setExpandedIds((prev) => {
      const next = new Set(prev);
      ancestors.forEach((aid) => next.add(aid));
      next.add(String(selectedId));
      return next;
    });
  }, [selectedId, safeCategories]);

  const trackRecent = useCallback((cat) => {
    if (!cat?._id) return;
    const id = String(cat._id);
    setRecentIds((prev) => {
      const next = [id, ...prev.filter((x) => x !== id)].slice(0, MAX_RECENT);
      saveRecent(next);
      return next;
    });
  }, []);

  const handleSelect = useCallback((cat) => {
    trackRecent(cat);
    onSelect?.(cat);
  }, [onSelect, trackRecent]);

  const searchMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return safeCategories.filter((c) => {
      if (statusFilter === 'active' && c.isActive === false) return false;
      if (statusFilter === 'inactive' && c.isActive !== false) return false;
      const hay = `${c.nameAr || ''} ${c.nameEn || ''} ${c.slug || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [query, safeCategories, statusFilter]);

  const searchExpandedIds = useMemo(() => {
    if (!searchMatches) return expandedIds;
    const ids = new Set();
    searchMatches.forEach((cat) => {
      getAncestorIds(cat, safeCategories).forEach((aid) => ids.add(aid));
    });
    return ids;
  }, [searchMatches, safeCategories, expandedIds]);

  const filteredTree = useMemo(() => {
    if (!searchMatches) return tree;
    const matchIds = new Set(searchMatches.map((c) => String(c._id)));

    const prune = (nodes) => nodes
      .map((node) => {
        const childPruned = prune(node.children || []);
        const selfMatch = matchIds.has(String(node._id));
        if (selfMatch || childPruned.length) {
          return { ...node, children: childPruned };
        }
        return null;
      })
      .filter(Boolean);

    return prune(tree);
  }, [tree, searchMatches]);

  const searchActive = Boolean(query.trim());
  const effectiveExpandedIds = searchActive ? searchExpandedIds : expandedIds;
  const dragEnabled = Boolean(onReorder) && !searchActive && !sortByName
    && statusFilter === 'all' && !loading && !reordering;

  const visibleNodes = useMemo(
    () => flattenVisibleTree(filteredTree, effectiveExpandedIds),
    [filteredTree, effectiveExpandedIds],
  );

  const onToggleExpand = useCallback((id, opts = {}) => {
    setExpandedIds((prev) => {
      if (opts.solo && opts.node) {
        const pathIds = new Set([...getAncestorIds(opts.node, safeCategories), id]);
        return pathIds;
      }
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, [safeCategories]);

  const expandAll = () => {
    setExpandedIds(new Set(safeCategories.map((c) => String(c._id))));
  };

  const collapseAll = () => {
    setExpandedIds(new Set(roots.map((r) => String(r._id))));
  };

  const clearDrag = useCallback(() => {
    setDragId('');
    setDropHint(null);
  }, []);

  const handleDragStart = useCallback((id) => {
    setDragId(id);
  }, []);

  const handleDragEnd = useCallback(() => {
    clearDrag();
  }, [clearDrag]);

  const handleDragOverNode = useCallback((targetId, position) => {
    if (!targetId) {
      setDropHint(null);
      return;
    }
    setDropHint({ targetId, position });
  }, []);

  const handleDropNode = useCallback(async (targetId, position) => {
    if (!dragId || !targetId || !onReorder) {
      clearDrag();
      return;
    }

    const dragged = safeCategories.find((c) => String(c._id) === dragId);
    const target = safeCategories.find((c) => String(c._id) === targetId);
    if (!dragged || !target) {
      clearDrag();
      return;
    }

    if (dragId === targetId) {
      clearDrag();
      return;
    }

    if (isDescendantOf(dragId, targetId, safeCategories)) {
      toast.error(isAr ? 'لا يمكن النقل داخل قسم فرعي' : 'Cannot move into a subcategory');
      clearDrag();
      return;
    }

    const draggedHasChildren = categoryHasChildCategories(dragId, safeCategories);

    let payload;
    if (position === 'inside') {
      if (Number(target.level || 1) >= 4) {
        toast.error(isAr ? 'أقصى عمق 4 مستويات' : 'Maximum depth is 4 levels');
        clearDrag();
        return;
      }
      if (draggedHasChildren) {
        toast.error(isAr ? 'انقل الأقسام الفرعية أولاً' : 'Move subcategories first');
        clearDrag();
        return;
      }
      payload = { move: { id: dragId, parentCategory: targetId } };
    } else {
      const targetParent = normalizeParentId(target);
      payload = {
        move: {
          id: dragId,
          parentCategory: targetParent,
          ...(position === 'before' ? { beforeId: targetId } : { afterId: targetId }),
        },
      };
    }

    setReordering(true);
    clearDrag();
    try {
      await onReorder(payload);
      if (position === 'inside') {
        setExpandedIds((prev) => new Set([...prev, targetId]));
      }
    } finally {
      setReordering(false);
    }
  }, [dragId, onReorder, safeCategories, clearDrag, isAr, toast]);

  const handleTreeKeyDown = useCallback((e) => {
    if (e.key === '/' && document.activeElement !== searchRef.current) {
      e.preventDefault();
      searchRef.current?.focus();
      return;
    }
    if (!visibleNodes.length) return;

    const currentIdx = visibleNodes.findIndex((n) => String(n._id) === focusedId);
    const idx = currentIdx >= 0 ? currentIdx : 0;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = visibleNodes[Math.min(idx + 1, visibleNodes.length - 1)];
      if (next) setFocusedId(String(next._id));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = visibleNodes[Math.max(idx - 1, 0)];
      if (prev) setFocusedId(String(prev._id));
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const node = visibleNodes[idx];
      if (!node) return;
      const nid = String(node._id);
      const hasChildren = (node.children || []).length > 0;
      const expanded = effectiveExpandedIds.has(nid);
      const expandKey = isAr ? 'ArrowLeft' : 'ArrowRight';
      const collapseKey = isAr ? 'ArrowRight' : 'ArrowLeft';

      if (e.key === expandKey && hasChildren && !expanded) {
        e.preventDefault();
        onToggleExpand(nid);
      } else if (e.key === collapseKey && hasChildren && expanded) {
        e.preventDefault();
        onToggleExpand(nid);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const node = visibleNodes[idx];
      if (node) handleSelect(node);
    } else if (e.key === 'e' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      const node = visibleNodes[idx];
      if (node) onEdit?.(node);
    }
  }, [
    visibleNodes, focusedId, isAr, effectiveExpandedIds,
    onToggleExpand, handleSelect, onEdit,
  ]);

  const mainLabel = CATEGORY_LEVEL_LABELS[1];
  const matchCount = searchMatches?.length ?? 0;

  const filterLabels = {
    all: isAr ? 'الكل' : 'All',
    active: isAr ? 'نشط' : 'Active',
    inactive: isAr ? 'معطل' : 'Draft',
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="shrink-0 border-b border-slate-100">
        <div className="flex items-baseline justify-between gap-3 px-3.5 pt-3.5">
          <h2 className="flex items-baseline gap-1.5 text-[13px] font-semibold text-slate-800">
            {isAr ? 'الأقسام' : 'Categories'}
            {!loading && stats.total > 0 && (
              <span className="text-[11px] font-normal text-slate-400">{stats.total}</span>
            )}
          </h2>
          {onAddRoot && (
            <button
              type="button"
              onClick={onAddRoot}
              className="flex shrink-0 items-center gap-1 text-[12px] font-medium text-slate-500 transition-colors hover:text-primary-700"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2} />
              {isAr ? 'إضافة' : 'Add'}
            </button>
          )}
        </div>

        <div className="space-y-2 px-3 py-3">
          <div className="flex items-center gap-1.5">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-300" />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={isAr ? 'بحث…' : 'Search…'}
                className="w-full rounded-md bg-slate-100/70 py-1.5 pe-7 ps-8 text-[13px] text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-300"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute end-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label={isAr ? 'مسح' : 'Clear'}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSortByName((v) => !v)}
              title={isAr ? 'ترتيب أبجدي' : 'Sort A–Z'}
              className={[
                'flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-md transition-colors',
                sortByName
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-100/70 text-slate-500 hover:bg-slate-200/70',
              ].join(' ')}
            >
              <ArrowDownAZ className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </div>

          <div className="flex items-center gap-4 text-[12px]">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setStatusFilter(f)}
                className={[
                  'relative pb-1 font-medium transition-colors',
                  statusFilter === f ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600',
                ].join(' ')}
              >
                {filterLabels[f]}
                {statusFilter === f && (
                  <span className="absolute inset-x-0 -bottom-px h-[1.5px] rounded-full bg-slate-800" />
                )}
              </button>
            ))}
            <span className="h-px flex-1 bg-slate-100" />
            {searchActive && (
              <span className="pb-1 text-slate-400">{matchCount}</span>
            )}
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <div className="flex gap-2.5">
              <button type="button" onClick={expandAll} className="hover:text-slate-700">
                {isAr ? 'توسيع الكل' : 'Expand all'}
              </button>
              <button type="button" onClick={collapseAll} className="hover:text-slate-700">
                {isAr ? 'طي الكل' : 'Collapse all'}
              </button>
            </div>
            {dragEnabled && (
              <span className="text-slate-300">{isAr ? 'اسحب ≡ للترتيب' : 'Drag ≡ to reorder'}</span>
            )}
          </div>
        </div>

        {(selectedCategory || recentIds.length > 0) && (
          <div className="space-y-1.5 border-t border-slate-100 bg-slate-50/50 px-3 py-2">
            {selectedCategory && getCategoryChain(selectedCategory, safeCategories).length > 1 && (
              <SelectedBreadcrumb
                category={selectedCategory}
                allCategories={safeCategories}
                isAr={isAr}
                onSelect={handleSelect}
              />
            )}
            {recentIds.length > 0 && (
              <RecentChips
                recentIds={recentIds}
                categories={safeCategories}
                isAr={isAr}
                selectedId={selectedId}
                onSelect={handleSelect}
              />
            )}
          </div>
        )}
      </div>

      {/* Tree */}
      <div
        ref={treeRef}
        className="min-h-0 flex-1 overflow-y-auto bg-slate-50/30 px-2 py-2 focus:outline-none [scrollbar-width:thin] [scrollbar-color:rgb(203_213_225)_transparent]"
        role="tree"
        tabIndex={0}
        onKeyDown={handleTreeKeyDown}
        aria-label={isAr ? 'شجرة الأقسام' : 'Category tree'}
      >
        {loading ? (
          <div className="space-y-1 p-1">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="flex h-10 items-center rounded-lg px-3"
                style={{ paddingInlineStart: `${(i % 4) * INDENT + 14}px` }}
              >
                <div className="h-3.5 flex-1 animate-pulse rounded-md bg-slate-100" />
                <div className="ms-3 h-5 w-6 animate-pulse rounded-full bg-slate-50" />
              </div>
            ))}
          </div>
        ) : filteredTree.length ? (
          <ul className="space-y-px" role="group">
            {onAddRootAt && (
              <RootInsertZone
                isAr={isAr}
                disabled={reordering}
                onAdd={() => onAddRootAt(null)}
              />
            )}
            {filteredTree.map((node, rootIdx) => (
              <Fragment key={node._id}>
                <TreeNode
                  node={node}
                  isAr={isAr}
                  allCategories={safeCategories}
                  depth={0}
                  isLast={rootIdx === filteredTree.length - 1}
                  ancestorLines={[]}
                  expandedIds={effectiveExpandedIds}
                  onToggleExpand={onToggleExpand}
                  selectedId={selectedId}
                  onSelect={handleSelect}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onAddChild={onAddChild}
                  onAddProduct={onAddProduct}
                  onToggleActive={onToggleActive}
                  onMoveProducts={onMoveProducts}
                  categoryHasProducts={categoryHasProducts}
                  searchActive={searchActive}
                  searchQuery={query.trim()}
                  focusedId={focusedId}
                  onFocusNode={setFocusedId}
                  onOpenContextMenu={setContextMenu}
                  dragEnabled={dragEnabled}
                  dragId={dragId}
                  dropHint={dropHint}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onDragOverNode={handleDragOverNode}
                  onDropNode={handleDropNode}
                  reordering={reordering}
                />
                {onAddRootAt && (
                  <RootInsertZone
                    isAr={isAr}
                    disabled={reordering}
                    onAdd={() => onAddRootAt(node._id)}
                  />
                )}
              </Fragment>
            ))}
          </ul>
        ) : (
          <div className="px-4 py-16 text-center">
            <p className="text-sm font-semibold text-slate-800">
              {searchActive || statusFilter !== 'all'
                ? (isAr ? 'لا توجد نتائج' : 'No matching categories')
                : (isAr ? 'لا توجد أقسام' : 'No categories yet')}
            </p>
            <p className="mt-1.5 text-xs text-slate-500">
              {searchActive
                ? (isAr ? 'غيّر البحث أو الفلتر' : 'Adjust your search or filter')
                : (isAr ? 'أنشئ أول قسم رئيسي' : 'Create your first main category')}
            </p>
            {!searchActive && statusFilter === 'all' && onAddRoot && (
              <button
                type="button"
                onClick={onAddRoot}
                className="mt-5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                {isAr ? `إضافة ${mainLabel.ar}` : `Add ${mainLabel.en.toLowerCase()}`}
              </button>
            )}
            {(searchActive || statusFilter !== 'all') && (
              <button
                type="button"
                onClick={() => { setQuery(''); setStatusFilter('all'); }}
                className="mt-5 text-xs font-semibold text-slate-700 hover:underline"
              >
                {isAr ? 'إعادة تعيين' : 'Reset filters'}
              </button>
            )}
          </div>
        )}
      </div>

      <TreeContextMenu
        items={contextMenu.items}
        open={contextMenu.open}
        onClose={() => setContextMenu((s) => ({ ...s, open: false }))}
        position={contextMenu.open ? { x: contextMenu.x, y: contextMenu.y } : null}
      />
    </div>
  );
}
