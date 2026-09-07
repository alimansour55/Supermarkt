import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import EmptyState from '../EmptyState';
import { TableSkeleton } from '../Skeleton';
import RowActionsMenu from './RowActionsMenu';

function SortIcon({ field, sort }) {
  if (!sort?.field) return <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />;
  if (sort.field !== field) return <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />;
  return sort.order === 'asc'
    ? <ArrowUp className="h-3.5 w-3.5" />
    : <ArrowDown className="h-3.5 w-3.5" />;
}

export default function AdminDataTable({
  columns,
  data = [],
  keyField = '_id',
  loading = false,
  sort,
  onSort,
  selectable = false,
  selectedIds = [],
  onToggleSelect,
  onToggleSelectAll,
  allSelected = false,
  rowActions,
  onRowClick,
  rowClassName,
  emptyTitle,
  emptyDescription,
  emptyIcon,
  emptyAction,
  isAr,
}) {
  if (loading) {
    return <TableSkeleton rows={6} columns={columns.length + (selectable ? 1 : 0)} />;
  }

  if (!data.length) {
    return (
      <EmptyState
        icon={emptyIcon}
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }

  return (
    <div className="max-h-[68vh] overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 border-b border-border bg-slate-50 text-text-muted">
          <tr>
            {selectable && (
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleSelectAll}
                  aria-label={isAr ? 'تحديد الكل' : 'Select all'}
                />
              </th>
            )}
            {columns.map((col) => (
              <th
                key={col.key}
                className={[
                  'whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500',
                  col.align === 'end' ? 'text-end' : 'text-start',
                  col.headerClassName || '',
                ].join(' ')}
              >
                {col.sortKey && onSort ? (
                  <button
                    type="button"
                    onClick={() => onSort(col.sortKey)}
                    className="inline-flex items-center gap-1 normal-case tracking-normal hover:text-text"
                  >
                    {col.header}
                    <SortIcon field={col.sortKey} sort={sort} />
                  </button>
                ) : (
                  col.header
                )}
              </th>
            ))}
            {rowActions && (
              <th className="w-12 px-4 py-3 text-end">
                <span className="sr-only">{isAr ? 'إجراءات' : 'Actions'}</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.map((row) => {
            const id = row[keyField] ?? row.id ?? row.code;
            const selected = selectedIds.includes(id);
            return (
              <tr
                key={id}
                className={[
                  'transition-colors',
                  onRowClick ? 'cursor-pointer hover:bg-slate-50' : 'hover:bg-slate-50/80',
                  selected ? 'bg-primary-50/50 hover:bg-primary-50/70' : '',
                  rowClassName?.(row) || '',
                ].join(' ')}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {selectable && (
                  <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => onToggleSelect(id)}
                      aria-label={isAr ? 'تحديد الصف' : 'Select row'}
                    />
                  </td>
                )}
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={[
                      'px-4 py-3.5 align-middle',
                      col.align === 'end' ? 'text-end' : 'text-start',
                      col.cellClassName || '',
                    ].join(' ')}
                  >
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
                {rowActions && (
                  <td className="px-4 py-3.5 text-end" onClick={(e) => e.stopPropagation()}>
                    <RowActionsMenu items={rowActions(row)} isAr={isAr} />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
