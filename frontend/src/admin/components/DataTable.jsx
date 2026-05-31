import EmptyState from './EmptyState';
import { TableSkeleton } from './Skeleton';

export default function DataTable({
  columns,
  data = [],
  keyField = '_id',
  loading = false,
  skeletonRows = 6,
  emptyTitle,
  emptyDescription,
  emptyIcon,
  emptyAction,
  onRowClick,
  rowClassName,
  className = '',
}) {
  if (loading) {
    return <TableSkeleton rows={skeletonRows} columns={columns.length} />;
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
    <div
      className={[
        'overflow-hidden rounded-2xl border border-border bg-white shadow-sm',
        className,
      ].join(' ')}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-text-muted">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={[
                    'px-4 py-3 font-medium',
                    col.align === 'end' ? 'text-end' : 'text-start',
                    col.headerClassName || '',
                  ].join(' ')}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.map((row) => {
              const key = row[keyField] ?? row.id;
              const extraClass = rowClassName?.(row) || '';
              return (
                <tr
                  key={key}
                  className={[
                    onRowClick ? 'cursor-pointer hover:bg-slate-50' : 'hover:bg-slate-50/80',
                    extraClass,
                  ].join(' ')}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={[
                        'px-4 py-3',
                        col.align === 'end' ? 'text-end' : 'text-start',
                        col.cellClassName || '',
                      ].join(' ')}
                    >
                      {col.render ? col.render(row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
