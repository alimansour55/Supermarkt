import { useMemo, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, Columns3 } from 'lucide-react';
import EmptyState from '../EmptyState';
import { TableSkeleton } from '../Skeleton';
import RowActionsMenu from '../list/RowActionsMenu';

function SortIcon({ sortKey, sort }) {
  if (!sort?.field || sort.field !== sortKey) return <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />;
  return sort.order === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />;
}

function ColumnVisibilityMenu({ columns, hiddenColumns, onToggle, isAr }) {
  const [open, setOpen] = useState(false);
  const hideableColumns = columns.filter((c) => c.hideable !== false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs font-medium text-text-muted hover:bg-slate-50"
      >
        <Columns3 className="h-3.5 w-3.5" />
        {isAr ? 'الأعمدة' : 'Columns'}
      </button>
      {open && (
        <>
          <button type="button" className="fixed inset-0 z-30 cursor-default" aria-label="close" onClick={() => setOpen(false)} />
          <div className="absolute end-0 top-full z-40 mt-1.5 w-52 rounded-xl border border-border bg-white p-2 shadow-lg">
            {hideableColumns.map((col) => (
              <label key={col.key} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={!hiddenColumns.includes(col.key)}
                  onChange={() => onToggle(col.key)}
                />
                {col.header}
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function ProductsTable({
  columns,
  data,
  loading,
  sort,
  onSort,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  allSelected,
  rowActions,
  rowClassName,
  hiddenColumns,
  onToggleColumn,
  density = 'comfortable',
  emptyIcon,
  emptyTitle,
  emptyDescription,
  emptyAction,
  isAr,
}) {
  const visibleColumns = useMemo(
    () => columns.filter((c) => !hiddenColumns.includes(c.key)),
    [columns, hiddenColumns],
  );

  const columnDefs = useMemo(
    () => visibleColumns.map((col) => ({
      id: col.key,
      accessorFn: (row) => row,
      header: col.header,
      cell: (ctx) => col.render(ctx.getValue()),
      meta: col,
    })),
    [visibleColumns],
  );

  const table = useReactTable({
    data,
    columns: columnDefs,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row._id,
  });

  const cellPad = density === 'compact' ? 'py-2 px-3' : 'py-3.5 px-4';
  const headPad = density === 'compact' ? 'py-2 px-3' : 'py-3 px-4';

  if (loading) {
    return <TableSkeleton rows={6} columns={visibleColumns.length + 1} />;
  }

  if (!data.length) {
    return (
      <div className="rounded-2xl border border-border bg-white shadow-sm">
        <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} action={emptyAction} />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
      <div className="flex items-center justify-end border-b border-border px-3 py-2">
        <ColumnVisibilityMenu columns={columns} hiddenColumns={hiddenColumns} onToggle={onToggleColumn} isAr={isAr} />
      </div>
      <div className="max-h-[68vh] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 border-b border-border bg-slate-50 text-text-muted">
            <tr>
              <th className={`w-10 ${headPad}`}>
                <input type="checkbox" checked={allSelected} onChange={onToggleSelectAll} aria-label={isAr ? 'تحديد الكل' : 'Select all'} />
              </th>
              {table.getFlatHeaders().map((h) => {
                const col = h.column.columnDef.meta;
                return (
                  <th
                    key={h.id}
                    className={[
                      `whitespace-nowrap ${headPad} text-xs font-semibold uppercase tracking-wide text-slate-500`,
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
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        <SortIcon sortKey={col.sortKey} sort={sort} />
                      </button>
                    ) : (
                      flexRender(h.column.columnDef.header, h.getContext())
                    )}
                  </th>
                );
              })}
              {rowActions && (
                <th className={`w-12 ${headPad} text-end`}>
                  <span className="sr-only">{isAr ? 'إجراءات' : 'Actions'}</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {table.getRowModel().rows.map((row) => {
              const product = row.original;
              const selected = selectedIds.includes(product._id);
              return (
                <tr
                  key={row.id}
                  className={[
                    'transition-colors hover:bg-slate-50/80',
                    selected ? 'bg-primary-50/50 hover:bg-primary-50/70' : '',
                    rowClassName?.(product) || '',
                  ].join(' ')}
                >
                  <td className={cellPad} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => onToggleSelect(product._id)}
                      aria-label={isAr ? 'تحديد الصف' : 'Select row'}
                    />
                  </td>
                  {row.getVisibleCells().map((cell) => {
                    const col = cell.column.columnDef.meta;
                    return (
                      <td
                        key={cell.id}
                        className={[
                          `${cellPad} align-middle`,
                          col.align === 'end' ? 'text-end' : 'text-start',
                          col.cellClassName || '',
                        ].join(' ')}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                  {rowActions && (
                    <td className={`${cellPad} text-end`} onClick={(e) => e.stopPropagation()}>
                      <RowActionsMenu items={rowActions(product)} isAr={isAr} />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
