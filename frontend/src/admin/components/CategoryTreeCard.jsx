import {
  ChevronDown,
  ChevronUp,
  Edit3,
  Eye,
  EyeOff,
  FolderClosed,
  FolderOpen,
  FolderTree,
  Package,
  PackagePlus,
  Plus,
  Trash2,
} from 'lucide-react';
import RowActionsMenu from './list/RowActionsMenu';
import { categoryHasActiveProducts, categoryLevelLabel, categoryRoleMeta } from '../../utils/categoryHelpers';

const GROUP_ICONS = [FolderTree, FolderOpen, FolderClosed, FolderClosed];

const LEVEL_STYLES = [
  {
    badge: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
    iconWrap: 'bg-indigo-100 text-indigo-600 ring-indigo-200',
    card: 'border-2 border-indigo-100 shadow-md',
    name: 'text-[15px] font-bold',
    swatch: 'h-10 w-10',
    nest: 'border-indigo-100 bg-indigo-50/40',
  },
  {
    badge: 'bg-sky-50 text-sky-700 ring-sky-200',
    iconWrap: 'bg-sky-100 text-sky-600 ring-sky-200',
    card: 'border border-sky-100 shadow-sm',
    name: 'text-sm font-semibold',
    swatch: 'h-9 w-9',
    nest: 'border-sky-100 bg-sky-50/40',
  },
  {
    badge: 'bg-amber-50 text-amber-700 ring-amber-200',
    iconWrap: 'bg-amber-100 text-amber-600 ring-amber-200',
    card: 'border border-amber-100 shadow-sm',
    name: 'text-sm font-medium',
    swatch: 'h-8 w-8',
    nest: 'border-amber-100 bg-amber-50/40',
  },
  {
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    iconWrap: 'bg-emerald-100 text-emerald-600 ring-emerald-200',
    card: 'border border-emerald-100',
    name: 'text-sm font-medium',
    swatch: 'h-8 w-8',
    nest: 'border-emerald-100 bg-emerald-50/40',
  },
];

export function CategorySwatch({ category, isLeaf, styleIdx, size }) {
  const style = LEVEL_STYLES[styleIdx] || LEVEL_STYLES[0];
  const dim = size || style.swatch;
  if (category.image) {
    return <img src={category.image} alt="" className={`${dim} shrink-0 rounded-lg object-cover ring-1 ring-slate-200`} />;
  }
  const Icon = isLeaf ? Package : (GROUP_ICONS[styleIdx] || FolderClosed);
  return (
    <span className={`flex ${dim} shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${style.iconWrap}`}>
      <Icon className="h-4 w-4" />
    </span>
  );
}

function InsertSlot({ isAr, label, onInsert }) {
  return (
    <div className="group/slot relative flex h-7 items-center">
      <div className="absolute inset-x-2 top-1/2 h-0 border-t border-dashed border-slate-300/70 transition group-hover/slot:border-primary-300" />
      <button
        type="button"
        onClick={onInsert}
        className="relative z-10 mx-auto flex h-6 items-center gap-1 rounded-full border border-slate-200 bg-white px-2 text-slate-400 shadow-sm opacity-70 transition hover:border-primary-500 hover:bg-primary-50 hover:text-primary-700 group-hover/slot:opacity-100 focus-visible:opacity-100"
        title={label}
        aria-label={label}
      >
        <Plus className="h-3 w-3" />
        <span className="hidden text-[10px] font-bold sm:inline">{isAr ? 'إضافة' : 'Add'}</span>
      </button>
    </div>
  );
}

export default function CategoryTreeCard({
  node,
  depth,
  isAr,
  selectedIds,
  onToggleSelect,
  collapsedIds,
  onToggleCollapse,
  forceExpandAll,
  siblingsOf,
  onEdit,
  onAddChild,
  onAddProduct,
  onMoveProducts,
  onToggleActive,
  onDelete,
  onMove,
}) {
  const meta = categoryRoleMeta(node);
  const hasChildren = (node.children || []).length > 0;
  const isExpanded = forceExpandAll || !collapsedIds.has(String(node._id));
  const level = node.level || depth + 1;
  const canAddChild = level < 4;
  const active = node.activeProductCount ?? 0;
  const total = node.productCount ?? 0;
  const isActive = node.isActive !== false;
  const selected = selectedIds.includes(node._id);

  const sibs = siblingsOf(node);
  const idx = sibs.findIndex((s) => String(s._id) === String(node._id));
  const canMoveUp = idx > 0;
  const canMoveDown = idx !== -1 && idx < sibs.length - 1;

  const styleIdx = Math.min(level - 1, LEVEL_STYLES.length - 1);
  const style = LEVEL_STYLES[styleIdx];
  const levelLabel = categoryLevelLabel(level, isAr);

  return (
    <div>
      <div
        className={[
          'group relative flex items-stretch rounded-xl bg-white transition-all',
          style.card,
          selected ? 'ring-2 ring-primary-300' : 'hover:brightness-[0.99]',
          !isActive ? 'opacity-70' : '',
        ].join(' ')}
      >
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2.5 px-3 py-2.5">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(node._id)}
            className="h-4 w-4 shrink-0 rounded accent-primary-600"
            aria-label={isAr ? 'تحديد' : 'Select'}
          />

          <button
            type="button"
            onClick={() => onToggleCollapse(node._id)}
            disabled={!hasChildren}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-0"
            aria-label={isExpanded ? (isAr ? 'طي' : 'Collapse') : (isAr ? 'توسيع' : 'Expand')}
          >
            {hasChildren && (
              <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? '' : '-rotate-90 rtl:rotate-90'}`} />
            )}
          </button>

          <CategorySwatch category={node} isLeaf={meta.isLeaf} styleIdx={styleIdx} />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className={`truncate text-slate-900 ${style.name}`}>{isAr ? node.nameAr : node.nameEn}</p>
              <span className={`inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ring-1 ring-inset ${style.badge}`}>
                {levelLabel}
              </span>
              <span
                className={`inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${
                  isActive ? 'bg-green-50 text-green-700 ring-green-200' : 'bg-slate-100 text-slate-500 ring-slate-200'
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-green-500' : 'bg-slate-400'}`} />
                {isActive ? (isAr ? 'نشط' : 'Active') : (isAr ? 'معطل' : 'Inactive')}
              </span>
            </div>
            <p className="mt-0.5 truncate text-[11px] text-text-muted">
              {meta.isLeaf
                ? (isAr
                  ? `منتجات · ${active} نشط${total > active ? ` من ${total}` : ''}`
                  : `Products · ${active} active${total > active ? ` of ${total}` : ''}`)
                : (isAr
                  ? `${meta.childCount} قسم فرعي · ${node.slug}`
                  : `${meta.childCount} sub-categories · ${node.slug}`)}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-0.5">
            <button
              type="button"
              disabled={!canMoveUp}
              onClick={() => onMove(node, 'up')}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:pointer-events-none disabled:opacity-20"
              aria-label={isAr ? 'تحريك لأعلى' : 'Move up'}
              title={isAr ? 'تحريك لأعلى' : 'Move up'}
            >
              <ChevronUp className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={!canMoveDown}
              onClick={() => onMove(node, 'down')}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:pointer-events-none disabled:opacity-20"
              aria-label={isAr ? 'تحريك لأسفل' : 'Move down'}
              title={isAr ? 'تحريك لأسفل' : 'Move down'}
            >
              <ChevronDown className="h-4 w-4" />
            </button>

            {canAddChild ? (
              <button
                type="button"
                onClick={() => onAddChild(node)}
                className="rounded-lg p-1.5 text-primary-600 hover:bg-primary-50"
                aria-label={isAr ? 'إضافة قسم فرعي' : 'Add sub-category'}
                title={isAr ? 'إضافة قسم فرعي' : 'Add sub-category'}
              >
                <Plus className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onAddProduct(node)}
                className="rounded-lg p-1.5 text-primary-600 hover:bg-primary-50"
                aria-label={isAr ? 'إضافة منتج' : 'Add product'}
                title={isAr ? 'إضافة منتج' : 'Add product'}
              >
                <PackagePlus className="h-4 w-4" />
              </button>
            )}

            <button
              type="button"
              onClick={() => onToggleActive(node)}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              aria-label={isActive ? (isAr ? 'تعطيل' : 'Deactivate') : (isAr ? 'تفعيل' : 'Activate')}
              title={isActive ? (isAr ? 'تعطيل' : 'Deactivate') : (isAr ? 'تفعيل' : 'Activate')}
            >
              {isActive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>

            <button
              type="button"
              onClick={() => onEdit(node)}
              className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"
              aria-label={isAr ? 'تعديل' : 'Edit'}
              title={isAr ? 'تعديل' : 'Edit'}
            >
              <Edit3 className="h-4 w-4" />
            </button>

            {categoryHasActiveProducts(node) && (
              <RowActionsMenu
                isAr={isAr}
                items={[
                  {
                    label: isAr ? 'نقل المنتجات' : 'Move products',
                    onClick: () => onMoveProducts(node),
                  },
                ]}
              />
            )}

            <button
              type="button"
              onClick={() => onDelete(node)}
              className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
              aria-label={isAr ? 'حذف' : 'Delete'}
              title={isAr ? 'حذف' : 'Delete'}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div className={`relative ms-3 mt-1.5 space-y-1.5 rounded-xl border p-2 sm:ms-5 sm:p-2.5 ${style.nest}`}>
          <InsertSlot
            isAr={isAr}
            label={isAr ? 'إضافة قسم فرعي هنا' : 'Add sub-category here'}
            onInsert={() => onAddChild(node)}
          />
          {node.children.map((child) => (
            <div key={child._id} className="space-y-1.5">
              <CategoryTreeCard
                node={child}
                depth={depth + 1}
                isAr={isAr}
                selectedIds={selectedIds}
                onToggleSelect={onToggleSelect}
                collapsedIds={collapsedIds}
                onToggleCollapse={onToggleCollapse}
                forceExpandAll={forceExpandAll}
                siblingsOf={siblingsOf}
                onEdit={onEdit}
                onAddChild={onAddChild}
                onAddProduct={onAddProduct}
                onMoveProducts={onMoveProducts}
                onToggleActive={onToggleActive}
                onDelete={onDelete}
                onMove={onMove}
              />
              <InsertSlot
                isAr={isAr}
                label={isAr ? 'إضافة قسم فرعي هنا' : 'Add sub-category here'}
                onInsert={() => onAddChild(node)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export { InsertSlot as CategoryInsertSlot };
